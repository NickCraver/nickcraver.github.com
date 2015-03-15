---
layout: post
author: Nick Craver
title:  "Growing pains and lessons learned"
date:   2012-01-04 12:00:00
categories: growth StackExchange
disqus_identifier: "1 http://nickcraver.com/blog/?p=1"
---
In this blog, I aim to give you some behind the scenes views of what goes on at [Stack Exchange](http://stackexchange.com/) and share some lessons we learn along the way.

Life at Stack Exchange is pretty busy at the moment; we have lots of projects in the air.  In short, [we're growing](http://www.quantcast.com/p-c1rF4kxgLUzNc), and growing fast. What effect does this have?

While growth is awesome (it's what almost every company wants to do), it's not without technical challenges.  A significant portion of our time is currently devoted to fighting fires in one way or another, whether it be software issues with community scaling (like the mod flag queue) or actual technical walls (like drive space, Ethernet limits).

Off the top of my head, these are just a few items from the past few weeks:

*   We managed to completely saturate our outbound bandwidth in New York (100mbps).  When we took an outage a few days ago to bump a database server from 96GB to 144GB of RAM, we served error pages without the backing of our CDN...turns out that's not something we're quite capable of doing anymore.  There were added factors here, but the bottom line is we've grown too far to serve even static HTML and a few small images off that 100mbps pipe. We _need_ a CDN at this point, but just to be safe we'll be upping that connection at the datacenter as well.
*   The Stack Overflow database server is running out of space.  Those [Intel X25-E SSD drives we went with](http://blog.serverfault.com/2011/02/09/our-storage-decision/) have performed superbly, but a raid 10 of 6x64GB (177GB usable) only goes so far.  We'll be bumping those drives up to [200GB Intel 710 SSDs](http://ark.intel.com/products/56584/Intel-SSD-710-Series-(200GB-2_5in-SATA-3Gbs-25nm-MLC)) for the next 12-18 months of growth.  Since we have to eat an outage to do the swap and memory is incredibly cheap, we'll be bumping that database server to 288GB as well.
*   Our original infrastructure in Oregon (which now hosts Stack Exchange chat) is too old and a bit disorganized - we're replacing it.  Oregon isn't only a home for [chat](http://chat.stackexchange.com/) and [data explorer](http://data.stackexchange.com/), it's the emergency failover if anything catastrophic were to happen in New York. [The old hardware](http://blog.stackoverflow.com/2009/01/new-stack-overflow-server-glamour-shots/) just has no chance of standing up to the current load of our network - so we're replacing it with shiny new goodies.
*   We've changed build servers - we're building lots of projects across the company now and we need something that scales and is a bit more extensible.  We moved from [CruiseControl.Net](http://sourceforge.net/projects/ccnet/) to [TeamCity](http://www.jetbrains.com/teamcity/) (still in progress, will be completed with the Oregon upgrade).
*   We're in process of changing core architecture to continue scaling.  The tag engine that runs on each web server is doing duplicate work and running multiple times.  The search engine (built on [Lucene.Net](http://incubator.apache.org/lucene.net/)) is both running from disk (not having the entire index bank loaded into memory) and duplicating work.  Both of these are solvable problems, but they need a fundamental change.  I'll discuss this further coming up; hopefully we'll have some more open source goodness to share with the community as a result.
*   [Version 2.0 on our API is rolling out](http://blog.stackoverflow.com/2011/12/stack-exchange-api-v2-0-public-beta/) (lots of SSL-related scaling fun around this behind the scenes).
*   A non-trivial amount of time has gone into our monitoring systems as of late.  We have a lot of servers running a lot of stuff, [we _need_ to see what's going on](http://blog.serverfault.com/2012/01/27/monitoring-systems-your-best-friend-really/).  I'll go into more detail on this later.  Since there seems to be at least some demand for open-sourcing the dashboard we've built, we will as soon as time permits.

There are lots of things going on around here, as I get time I'll try to share more detailed happenings like the above examples with you as we grow.  Not many companies grow as fast as we are with as little hardware or as much passion for performance.  I don't believe anyone runs the architecture we do at the scale we're running at (traffic-wise, we actually have very little hardware being utilized); we're both passionate and insane.

We'll go through some tough technical changes coming up, from both paying down technical debt and provisioning for the future.  I'll try and share as much as I can of that here, for those who are merely curious what happens behind the curtain and those who are going through the same troubles we already have, maybe our experiences can help you out.