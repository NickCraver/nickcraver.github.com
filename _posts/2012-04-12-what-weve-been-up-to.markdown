---
layout: post
title:  "What we've been up to"
date:   2012-04-12 12:00:00
categories: opensource status
disqus_identifier: "196 http://nickcraver.com/blog/?p=196"
---
For starters, let's get a bad assumption I personally had before being hired out of the way: **you don't see most features we deploy**.  In fact a small percentage of features we deploy are for regular users, or seen directly.  Aside from user-facing features, there exists a great deal of UI and infrastructure for our moderators, and even more for developers.  Besides features directly on the site, a lot more goes on behind the scenes. <!--more-->Here's a quick list of what's underway right now:

*   Moving [search ](http://blog.stackoverflow.com/2011/01/stack-overflow-search-now-81-less-crappy/ "Stack Overflow Search — Now 81% Less Crappy")off the web tier, a little over a year after putting it there.
*   Moving [the tag engine](http://samsaffron.com/archive/2011/10/28/in-managed-code-we-trust-our-recent-battles-with-the-net-garbage-collector "Sam Saffron: In managed code we trust, our recent battles with the .NET Garbage Collector") off the web tier (you may have not even heard this exists).
*   [Real-time updates](http://meta.stackoverflow.com/questions/125677/new-feature-real-time-updates-to-questions-answers-and-inbox "New Feature: real time updates to questions, answers, and inbox") to a number of site elements (voting, new answers, comments, your rep changes, etc.)
*   Deploying [Oregon failover cluster]({% post_url 2012-02-15-planning-for-failure %} "Stack Exchange: Planning for failure, part 1") (and other related infrastructure changes)
*   [redacted] sidebar project
*   [redacted] profile project
*   Home-grown TCP Server
*   Home-grown WebSockets server (built on the base TCP)
*   Home-grown error handler (similar to [elmah](http://code.google.com/p/elmah/) but suited for our needs)
*   Monitoring dashboard improvements (on the way to open source)
*   Major network infrastructure changes (next Saturday, 4/14/2012)

That's just the major stuff in process _right now_, of course there are a lot of other minor features and bug fixes being rolled out all the time.  There are some inter-connected pieces here, let's first look at the how some of these groups of projects came to be.

When you visit a tag page, or pretty much anything to do with finding or navigating via a tag, you're hitting our tag engine.  This little gem was cooked up by [Marc Gravell](http://stackoverflow.com/users/23354/marc-gravell) and [Sam Saffron](http://stackoverflow.com/users/17174/sam-saffron) to take the load off SQL Server (where it was Full Text Search-based previously) and do it much more efficiently on the web tier, inside the app domain.  This has been a tremendous performance win, but can we do it better? absolutely.  We can _always_ do it better, the question is: at what cost?  The tag engine is now used a few times on each web server, for example inside the API as well as the main Q&A application (which handles all SE site requests, including Stack Overflow).  This is duplicate work...as is running it on all 11 web servers.  This same duplicate work wastefulness is true of our search indexing.  While it's quite redundant, it's too much so, and in practice doesn't gain us anything...so what do we do?

We need to move some things into a service-oriented architecture, tag engine and search are first up.  Yes, there are other approaches, but this is how we're choosing to do it.  So how do we go about this? We ask Marc what he can cook up, and he comes back with awesome every time.

There are a two things in play here, websockets and internal traffic...both have very different behavior and needs.  Internal API requests (tag engine, search) are a few clients (the web tier) getting a *lot* of data across those connections.  Websockets is a _lot_ of consumers (tens of thousands or more) getting a little data.  We can optimize each case, but they are different and need independent love (possibly with separate implementations).

Enter our in-house TCP server, still a work in progress. This is what's _already_ powering our websockets/real-time functionality, so it's optimized for the many clients/little data case.  If we start using this internally, it may very well be a different implementation optimized for the other end of the spectrum.  I won't go into more detail on this because things change greatly with the next .Net release, and the TCP server can be much more efficient by being based on [HttpListener](http://msdn.microsoft.com/en-us/library/system.net.httplistener.aspx) (though it's _crazy_ efficient right now, Marc and normal humans have different definitions, so by his standards it needs improvement).  Accordingly, we'll wait to open source this until that large refactor happens, the same goes for the websockets server impersonation built on top of it.

I've also spent a bit of my time lately replacing our exception handler, which we'll be open sourcing after testing in production for a bit.  Currently it's file system based and...well, it melts if we are in a high velocity error-throwing situation.  Instead we'll be moving to a SQL-based error store (with JSON file and memory support for those who want it, it's pluggable so we can add more stores later...like redis) with an in-memory backup buffer that'll handle SQL being down as well.  This was needed because we monitor exceptions across all applcations in our monitoring dashboard...and we also want to open source _that_.  That means there's a few dominos to get in place first.  For the same reasoning as projects above, the real-time websockets based real-time monitoring will have to wait for a future release (hopefully not too long)...but that's a separate post, also coming soon.

There are some good things coming, especially in terms of open sourcing some of our goodies.  While we have [some things out there already](http://blog.stackoverflow.com/2012/02/stack-exchange-open-source-projects/), we'll be adding more...and a few improvements to the existing projects.  Also, we'll be creating a central place where you find all these things.  [That blog post](http://blog.stackoverflow.com/2012/02/stack-exchange-open-source-projects/) is a good start, but we plan on giving our open source creations a permanent home so the community can find and help us improve them, so everyone can benefit.