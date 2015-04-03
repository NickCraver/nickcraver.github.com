---
layout: post
title:  "Stack Exchange: Planning for failure, part 1"
date:   2012-02-15 12:00:00
disqus_identifier: "133 http://nickcraver.com/blog/?p=133"
---
This will be the first in an series of interspersed posts about how our backup/secondary infrastructure is built and designed to work.

Stack Overflow started as the only site we had. That was over 3 years ago (August 2008) in a data center called [PEAK Internet](http://www.peakinternet.com/) in Corvallis, Oregon.  Since them we've grown a lot, [moved the primary network to New York](http://blog.serverfault.com/2010/10/23/1383845452/), and [added room to grow in the process](http://blog.serverfault.com/2010/10/29/1432571770/).  A lot has changed since then in both locations, but much of the activity has stuck to the New York side of things.  The only services we're currently running out of Oregon are [chat ](http://chat.stackexchange.com/)and [data explorer](http://data.stackexchange.com/) (so if you're wondering why chat still runs during most outages, that's why).
<!--more-->

Back a few months ago we outgrew our [CruiseControl.Net ](http://www.cruisecontrolnet.org/)build system, changing over to [TeamCity](http://www.jetbrains.com/teamcity/) by JetBrains.  We did this for manageability, scalability, extensibility and because it's just generally a better product (for our needs at least)  These build changes were pretty straightforward in the NY datacenter because we have a homogeneous web tier.  Our sysadmins _insist_ that all the web servers be identical in configuration, and it pays off in many ways...such as when you change them all to a new build source. Once NY was converted, it was time to set our eyes on Oregon.  This was going to net us several benefits: a consistent build, a single URL (NY and OR CC.Net instances were in no way connected, the same version, etc.), and a single build system managing it all - including notifications, etc.

So what's the problem?  Oregon is, for lack of a more precise description, a mess.  No one here forgets it's where we started out, and the configuration there was just fine at the time, but as you grow things need to be in order.  We felt the time has come to do that organization.  Though some cleanup and naming conventions were applied when we joined OR to the new domain a few months ago, many things were all over the place.  Off the top of my head:

*   Web tier is on Windows 2k8, not 2k8 SP1
*   Web tier is not homogeneous

*   OR-WEB01 &#8211; Doesn't exist, this became a DNS server a looooong time ago
*   OR-WEB02 &#8211; Chat, or.sstatic.net
*   OR-WEB03 &#8211; Stack Exchange Data Explorer, CC.Net primary build server
*   OR-WEB04 &#8211; or.sstatic.net
*   OR-WEB05 &#8211; or.sstatic.net, used to be a VM server (we can't get this to uninstall, heh)
*   OR-WEB06 &#8211; Chat*   The configuration looks nothing like NY
*   Automatic updates are a tad bit flaky
*   Missing several components compared to NY (such as physical redis, current &amp; upcoming service boxes)

So we're doing what any reasonable person would do. ** NUKE. EVERYTHING.** New hardware for the web tier and primary database server has already been ordered by our Sysadmin team ([Kyle's](http://serverfault.com/users/2561/kyle-brandt) lead on this one) and racked by our own [Geoff Dalgas](http://stackoverflow.com/users/2/geoff-dalgas).  Here's the plan:

*   Nuke the web tier, format it all
*   Replace OR-DB01 with the new database server with plenty of space on 6x [Intel 320 Series 300GB ](http://ark.intel.com/products/56567/Intel-SSD-320-Series-(300GB-2_5in-SATA-3Gbs-25nm-MLC))drives
*   Re-task 2 of the web tier as Linux load balancers running HAProxy (failover config)
*   Re-task the old OR-DB01 as a service box (upcoming posts on this &#8211; unused at the moment, but it has plenty of processing power and memory, so it fits)
*   Install 4 new web tier boxes as OR-WEB01 through OR-WEB04

Why all of this work just for Stack Exchange Chat & Data Explorer?  Because it's not _just_ for that.  Oregon is also our failover in case of catastrophic failure in New York.  We send backups of all databases there every night.  In a pinch, we want to switch DNS over and get Oregon up ASAP (probably in read-only mode though, until we're sure NY can't be recovered any time soon). The OR web tier will tentatively look something like this:

*   OR-WEB01 &#8211; Chat, or.sstatic.net
*   OR-WEB02 &#8211; Chat, or.sstatic.net
*   OR-WEB03 &#8211; Data Explorer
*   OR-WEB04 &#8211; Idle

Now that doesn't look right, does it?  I said earlier that the web tier should be homogeneous and that's true.  The above list is what's _effectively_ running on each server.  In reality (just like New York) they'll have identical IIS configs, all running the same app pools.  The only difference is which ones get traffic for which sites via HAProxy.  Ones that don't get traffic, let's say OR-WEB04 for chat, simply won't spin up that app pool. In addition to the above, each of the servers will be running everything else we have in New York, just not active/getting any traffic.  This includes things like every Q&A site in the network (including Stack Overflow), stackexchange.com, careers.stackoverflow.com, area51.stackexchange.com, openid.stackexchange.com, sstatic.net, etc.  All of these will be in a standby state of some sort...we're working on the exact details.  In any case, it won't be drastically different from the New York load balancing setup, which I'll cover in detail in a future post.

Things will also get more interesting on the backup/restore side with the SQL 2012 move.  I'll also do a follow-up post on our initial plans around the SQL upgrade in the coming weeks - we're waiting on some info around new hardware in that department.