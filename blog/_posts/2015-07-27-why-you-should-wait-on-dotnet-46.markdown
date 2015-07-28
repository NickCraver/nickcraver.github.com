---
layout: post
author: Nick Craver
title:  "Why you should wait on upgrading to .Net 4.6"
date:   2015-07-27
---
What follows is the work of several people: [Marc Gravell](http://blog.marcgravell.com/) and I have taken lead on this at Stack Overflow and we continue to coordinate with Microsoft on a resolution. They have fixed the bug internally, but not for users. Given the severity, we can't in good conscience let such a subtle yet high-impact bug linger silently. **We are not upgrading Stack Overflow to .Net 4.6**, and you shouldn't upgrade yet either. You can find [the issue we opened on GitHub (for public awareness) here](https://github.com/dotnet/coreclr/issues/1296). I will update this post as soon as a fix is relased.

**Update #1 (July 27th):** [A pull request has been posted by Matt Michell (Microsoft)](https://github.com/dotnet/coreclr/pull/1298).

**Update #2 (July 28th):** There are several smaller repros now ([including a small console app](https://github.com/dotnet/coreclr/issues/1296#issuecomment-125568026)). Microsoft has confirmed they are working on an expedited hotfix release but we don't have details yet.

**Update #3 (July 28th):** Microsoft's Rich Lander has posted an update: [RyuJIT Bug Advisory in the .NET Framework 4.6](http://blogs.msdn.com/b/dotnet/archive/2015/07/28/ryujit-bug-advisory-in-the-net-framework-4-6.aspx).

This critical bug is specific to .Net 4.6 and RyuJIT (64-bit). I'll make this big and bold so we get to the point quickly:  

### The methods you call can get different parameter values than you passed in.  
<p></p>
The JIT (Just-in-Time compiler) in .Net (and many platforms) does something called Tail Call optimization. This happens to alleviate stack load on the last-called method in a chain. I won't go into what a tail call is [because there's already an excellent write up by David Broman](http://blogs.msdn.com/b/davbr/archive/2007/06/20/enter-leave-tailcall-hooks-part-2-tall-tales-of-tail-calls.aspx).

The issue here is a bug in how RyuJIT x64 implements this optimization in certain situations. Let's look at the specific example we hit at Stack Overflow ([we have uploaded a minimal version of this reproduction to GitHub](https://github.com/StackExchange/RyuJIT-TailCallBug)).

We noticed that [MiniProfiler](http://miniprofiler.com/) (which we use to track performance) was showing only on the first page load. The profiler then failed to show again until an application recycle. This turned out to be a caching bug based on the HTTP Cache usage locally. HTTP Cache is our "L1" cache at Stack Overflow; [redis](http://redis.io/) is typically the "L2." After over a day of debugging (and sanity checking), we tracked the crazy to here:

{% highlight csharp %}
void Set<T>(string key, T val, int? durationSecs, bool sliding, bool broadcastRemoveFromCache = false)
{
    SetWithPriority<T>(key, val, durationSecs, sliding, CacheItemPriority.Default);
}

void SetWithPriority<T>(string key, T val, int? durationSecs, bool isSliding, CacheItemPriority priority)
{
    key = KeyInContext(key);

    RawSet(key, val, durationSecs, isSliding, priority);
}

void RawSet(string cacheKey, object val, int? durationSecs, bool isSliding, CacheItemPriority priority)
{
    var absolute = !isSliding && durationSecs.HasValue 
                   ? DateTime.UtcNow.AddSeconds(durationSecs.Value) 
                   : Cache.NoAbsoluteExpiration;
    var sliding = isSliding && durationSecs.HasValue 
                  ? TimeSpan.FromSeconds(durationSecs.Value) 
                  : Cache.NoSlidingExpiration;

    HttpRuntime.Cache.Insert(cacheKey, val, null, absolute, sliding, priority, null);
}
{% endhighlight %}

What was happening? We were setting the MiniProfiler cache duration (passed to `Set<T>`) as 3600 seconds. But often (~98% of the time), we were seeing it immediately expire from HTTP cache. Next we narrowed this down to being a bug **only when optimizations are enabled** (the "Optimize Code" checkbox on your project's build properties). At this point sanity is out the window and you debug *everything*.

Here's what that code looks like now. Note: I have slightly shortened it to fit this page. [The unaltered code is on GitHub here](https://github.com/StackExchange/RyuJIT-TailCallBug/blob/master/StackRedis/Caches.Local.cs#L403).


{% highlight csharp %}
void Set<T>(string key, T val, int? durationSecs, bool sliding, bool broadcastRemoveFromCache = false)
{
    LocalCache.OnLogDuration(key, durationSecs, "LocalCache.Set");
    SetWithPriority<T>(key, val, durationSecs, sliding, CacheItemPriority.Default);
}

void SetWithPriority<T>(string key, T val, int? durationSecs, bool isSliding, CacheItemPriority priority)
{
    LocalCache.OnLogDuration(key, durationSecs, "LocalCache.SetWithPriority");
    key = KeyInContext(key);

    RawSet(key, val, durationSecs, isSliding, priority);
}

void RawSet(string cacheKey, object value, int? durationSecs, bool isSliding, CacheItemPriority priority)
{
    LocalCache.OnLogDuration(cacheKey, durationSecs, "RawSet");
    var absolute = !isSliding && durationSecs.HasValue 
                   ? DateTime.UtcNow.AddSeconds(durationSecs.Value) 
                   : Cache.NoAbsoluteExpiration;
    var sliding = isSliding && durationSecs.HasValue 
                  ? TimeSpan.FromSeconds(durationSecs.Value) 
                  : Cache.NoSlidingExpiration;

    HttpRuntime.Cache.Insert(cacheKey, value, null, absolute, sliding, priority, Removed);
    var evt = Added;
    if(evt != null) evt(cacheKey, value, absolute, sliding, priority, durationSecs, isSliding);
}
{% endhighlight %}

This is nothing fancy, all we have is some methods calling each other. Here's the scary result of those `LocalCache.OnLogDuration` calls:

 - LocalCache.Set: 3600
 - LocalCache.SetWithPriority: 3600
 - RawSet: *null*, or 114, or 97, or some other seemingly random value
 
 Here's an example test run from [the GitHub repo](https://github.com/StackExchange/RyuJIT-TailCallBug):
 ![RyuJIT Tail Tests]({{ site.contenturl }}Blog-RyuJIT-Results.png)
 
 **The method we called did not get the parameters we passed**. That's it. The net result of this is that local cache (which we use *very* heavily) is either unreliable or non-existent. This would add a tremendous amount of load to our entire infrastructure, making Stack Overflow much slower and likely leading to a full outage.
 
 That's not why we're telling you about this though. Let's step back and look at the big picture. What are some other variable names we could use?
 
 - `amountToWithdraw`
 - `qtyOfStockToBuy`
 - `carbonCopyToAccountId`
 - `voltage`
 - `targetAltitude`
 - `rotorVelocity`
 - `oxygenPressure`
 - `dosageMilliliters`
 
 Does that help put things in perspective?
 
 This bug is not obvious for several reasons:  
 
  - It only happens with optimizations enabled. For most developers and projects, that's not in `DEBUG` and won't show locally. 
    - That means you'll only see this in `RELEASE`, which for most people is **only production**. 
  - Attaching a debugger alters the behavior. This almost always hides the issue.
  - Adding a `Debug.WriteLine()` will often fix the issue because of the tail change.
  - It won't reproduce in certain scenarios (e.g. we can't repro this in a console application or VS hosting, only IIS).
  - Given the nature of the bug, as far as we can tell, it can equally affect any framework library as well.
  - It can happen in a NuGet library (most of which are `RELEASE`); the issue may not be in your code at all.
  
To address an obvious question: is this a security issue? Answer: it can be. It's not something you could actively exploit in almost all cases, since stack variables are the things being swapped around here. However, it can be an issue indirectly. For example, if your code makes an assumption with a `null` param like `if (user == null) { user = SystemUser; }`, then a `null` passed in will certainly be a problem, giving other users that access sporadically. A more common example of this would be a value for a `Role` enum being passed incorrectly.

## Recommendations
1. Do not install .Net 4.6 in production.
2. If you have installed .Net 4.6, disable RyuJIT immediately (**this is a temporary fix and should be removed when an update is released**). You can disable RyuJIT via a registry setting (note: this requires an application pool recycle to take effect).
 - Under `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\.NETFramework` add a `useLegacyJit` `DWORD` with a value of `1`
 - Or via PowerShell:  
 
{% highlight powershell %}
Set-ItemProperty -Path HKLM:\Software\Microsoft\.NETFramework -Name useLegacyJit -Type DWord -Value 1
{% endhighlight %}

Be aware, [the `web.config` method (#3)](https://github.com/Microsoft/dotnet/blob/master/docs/testing-with-ryujit.md) of disabling RyuJIT **does not work**. Outside of IIS hosting, applying this fix via `app.config` *does* work.

We are talking with and pushing Microsoft to get a fix for this shipped ASAP. We recognize releasing a fix for .Net on the Microsoft side isn't a small deal. Our disclosure is prompted by the reality that a fix cannot be released, distributed, and applied immediately.

