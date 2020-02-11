---
layout: post
author: Nick Craver
title:  "Binding Redirects"
date:   2020-02-11
---
> This isn't part of the [series on Stack Overflow's architecture]({% post_url blog/2016-02-03-stack-overflow-a-technical-deconstruction %}), but is a topic that has bitten us many times. Hopefully some of this information helps you sort out issues you hit.

So you're probably here because of an error like this:

> Could not load file or assembly 'System.<...>, Version=4.x.x.x, Culture=neutral, PublicKeyToken=<...>' or one of its dependencies. The system cannot find the file specified.

And you likely saw a build warning like this:

> warning MSB3277: Found conflicts between different versions of "System.<...>" that could not be resolved.

Whelp, you're not alone. We're thinking about starting a survivors group. The most common troublemakers here are:

- `System.Memory` ([NuGet link](https://www.nuget.org/packages/System.Memory/))
- `System.Net.Http` ([NuGet link](https://www.nuget.org/packages/System.Net.Http/))
- `System.Numerics.Vectors` ([NuGet link](https://www.nuget.org/packages/System.Numerics.Vectors/))
- `System.Runtime.CompilerServices.Unsafe` ([NuGet link](https://www.nuget.org/packages/System.Runtime.CompilerServices.Unsafe/))
- `System.ValueTuple` ([NuGet link](https://www.nuget.org/packages/System.ValueTuple/))

If you just want out of this fresh version of DLL Hell you've found yourself in...

### The best fix

The best fix is "go to .NET Core". Since .NET Framework (e.g. 4.5, 4.8, etc.) has a heavy backwards compatibility burden, meaning that the assembly loader itself is basically made of unstable plutonium with a hair trigger coated in flesh eating bacteria behind a gate made of unobtanium above a moat of napalm filled with those jellyfish that kill you...that won't ever be really be fixed.

However, .NET Core's simplified assembly loading means it *just works*. I'm not saying a migration to .NET Core is trivial, that depends on your situation, but it is generally the best long-term play. We're almost done porting Stack Overflow to .NET Core, and this kind of pain is one of the things we're very much looking forward to not fighting ever again.

### The fix if you're using .NET Framework

The fix for .NET Framework is "[binding redirects](https://docs.microsoft.com/en-us/dotnet/framework/configure-apps/redirect-assembly-versions)". When you are trying to load an assembly (if it's [strongly named](https://docs.microsoft.com/en-us/dotnet/standard/assembly/strong-named), like the ones in the framework and many libs are), it'll try to load the *specific version* you specified. Unless it's told to load another (likely newer) version. Think of it as "Hey little buddy. It's okay! Don't cry! That API you want is still available...it's just over here". I don't want to replicate the official documentation here since it'll be updated much better by the awesome people on Microsoft Docs these days. Your options to fix it are:

- [Enable `<AutoGenerateBindingRedirects>`](https://docs.microsoft.com/en-us/dotnet/framework/configure-apps/how-to-enable-and-disable-automatic-binding-redirection) (this doesn't work for web projects - it doesn't handle `web.config`)
  - Note: this isn't always perfect, it doesn't handle all transitive cases especially around multi-targeting and conditional references.
- Build with Visual Studio and hope it has warnings and a click to fix (this *usually* works)
  - Note: this isn't always perfect either, hence the "hope".
- [**Manually edit your *.config file**](https://docs.microsoft.com/en-us/dotnet/framework/configure-apps/redirect-assembly-versions#manually-editing-the-app-config-file).
  - This is the surest way (and what Visual Studio is doing above), but also the most manual & fun on upgrades.

Unfortunately, what that help manual editing doesn't mention is the ***assembly versions are not the NuGet versions***. For instance [System.Runtime.CompilerServices.Unsafe 4.7.0](https://www.nuget.org/packages/System.Runtime.CompilerServices.Unsafe/4.7.0) on NuGet is _assembly_ version 4.0.6.0. The assembly version is what matters. The easiest way I use to figure this out on Windows is the [NuGet Package Explorer](https://github.com/NuGetPackageExplorer/NuGetPackageExplorer) ([Windows Store link](https://www.microsoft.com/en-us/p/nuget-package-explorer/9wzdncrdmdm3) - easiest install option) maintained by [Oren Novotny](https://github.com/onovotny). Either from within NPE's feed browser or from NuGet.org (there's a "Download package" option in the right sidebar), open the package. Select the framework you're loading (they should all match really) and double click the DLL. It'll have a section that says "Strong Name: Yes, version: `4.x.x.x`"

For example, if you had libraries wanting various versions of `System.Numerics.Vectors` a most likely fix is to prefer the latest (as of writing this, [4.7.0 on NuGet](https://www.nuget.org/packages/System.Runtime.CompilerServices.Unsafe/4.7.0) which is assembly version 4.0.6.0 from earlier) part of your config would look something like this:

```xml
<configuration>
  <runtime>
    <assemblyBinding xmlns="urn:schemas-microsoft-com:asm.v1">
      <dependentAssembly>
        <assemblyIdentity name="System.Runtime.CompilerServices.Unsafe" publicKeyToken="b03f5f7f11d50a3a" culture="neutral"/>
        <bindingRedirect oldVersion="0.0.0.0-4.0.6.0" newVersion="4.0.6.0"/>
      </dependentAssembly>
      <!-- ...and maybe some more... -->
    </assemblyBinding>
  </runtime>
</configuration>
```

This means "anyone asking for any version before 4.0.6.0, send them to that one...it's what in my `bin\` folder". For a quick practical breakdown of these fields:

- `name`: The name of the strongly named DLL
- `publicKeyToken`: The public key of the strongly named DLL (this comes from key used to sign it)
- `culture`: Pretty much always `neutral`
- `oldVersion`: A **range** of versions, starting at `0.0.0.0` (almost always what you want) means "redirect everything from X to Y"
- `newVersion`: The new version to "redirect" to, instead of any old one (usually matches end of the `oldVersion` range).

### When do I need to do this?

Any of the above approaches to fixing it need to be revisited when a conflict arises again. This can happen when:

- Updating a NuGet package (remember: transitive dependencies...so anything in the chain can cause it)
- Updating your target framework

Note that binding redirects are to remedy *differences* in the reference chain (more on that below), so when all of your things reference the same version down their transitive chains, you don't need one...so sometimes *removing* a binding redirect is the quick fix in an upgrade.

But seriously, .NET Core. Of all the reasons we're migrating over at Stack Overflow, binding redirects are in my top 5. We've lost soooo many days to this over the years.

### What's going on? Why do I need this?

The overall problem is that you have 2 different libraries ultimately wanting 2 different versions of one of these (and potentially anything else - this is a general case the 3 above are just the *most* common). Since dependencies are transitive, this means you just reference a library and the tooling will get what it needs (that's what `<PackageReference>` does in your projects). But what that means is you could have library `A → B → System.Vectors` (version 1.0), and another reference to something like `D → E → F → System.Vectors` (version 1.2).

Uh oh, we have 2 things wanting 2 different versions. Now you're probably thinking in Windows "but...won't they be the same file in the `bin\` directory? How can you have both? How does that *even work*?" You're not crazy. You're hitting the error because *one of those 2 versions won*. It _should_ be the newer one.

Okay so it's broken, the code wanting the *other* version is what's erroring. But maybe not on startup! That's another fun part. It happens *the first time you touch a type that references types in that assembly*. Bonus: if this is in a static constructor, that type you're trying to touch will most likely disappear. Poof. Gone. What does the app do without it? WHO KNOWS! But buckle up because you can bet your butt it'll be fun. Imagine the compiler said okay but that type wasn't really there later...because that's basically the situation you find yourself in.

So, we need to redirect things. In theory, the framework takes care of some of these indirections, but with some pieces deployed via NuGet it's a bit of a mess and it's far from perfect. That's why you're here. I hope this helped.

In some versions of the framework, things aren't quite right in what shipped - the few libraries up top are troublemakers more than all others for this reason, those are the versions that were glitched in various versions of .NET Framework. "Why don't you fix .NET 4.<version>??" is a question Microsoft gets a lot. They did, it's called "the next version". Being unable to break people, that's the only real way to fix it and not cause *other* damage. Keep in mind, we're talking about over a billion computers to update here. So, when you update to .NET 4.7.2 (most of the redirects are fixed here), .NET 4.8, etc. - more and more of the cases do go away. But with NuGet and later versions...yeah, they can come back. Generally speaking though, the later version of .NET Framework you're targeting and running on, the better. There has been progress.

Anyway, I hope this helps some people out there. I should have written this up 5 years ago, and wish I had this info available to me 10 years ago. Good luck on fixing what brought you here!