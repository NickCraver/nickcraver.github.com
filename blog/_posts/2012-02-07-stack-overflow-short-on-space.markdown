---
layout: post
title:  "Stack Overflow running short on space"
date:   2012-02-07 12:00:00
---
Stack Overflow handles a lot of traffic. [Quantcast](https://www.quantcast.com/) ranks us (at the time of this writing) [as the 274th largest website in the US](https://www.quantcast.com/stackoverflow.com), and that's rising.  That means everything that traffic relates to grows as well. With growth, there are 2 areas of concern I like to split problems into: technical and non-technical.

Non-technical would be things like community management, flag queues, moderator counts, spam protection, etc.  These might (and often do) end up with technical _solutions_ (that at least help, if not solve the problem), but I tend to think of them as "people problems." I won't cover those here for the most part, unless there's some technical solution that we can expose that may help others.
<!--more-->

So what about the technical?  Now _those_ are more interesting to programmers.  We have lots of things that grow along with traffic, to name a few:

*   Bandwidth (and by-proxy, CDN dependency)
*   Traffic logs (HAProxy logs)
*   CPU/Memory utilization (more processing/cache involved for more users/content)
*   Performance (inefficient things take more time/space, so we have to constantly look for wins in order to stay on the same hardware)
*   **Database Size**

I'll probably get to all of the above in the coming months, but today let's focus on what our current issue is. **Stack Overflow is running out of space**.  This isn't news, it isn't shocking; anything that grows is going to run out of room eventually.

This story starts a little over a year ago, right after I was hired.  One of the first things I was asked to do was growth analysis of the Stack Overflow DB. [You can grab a copy of it here]({{ site.contenturl }}SO-Growth-Analysis.xlsx) (excel format).  [Brent Ozar](https://www.brentozar.com/), our go-to DBA expert/database magician, told us you can't predict growth that accurately...and he was right.  There are so many unknowns: traffic from new sources, new features, changes in usage patterns (e.g. more editing caused a great deal more space usage than ever before).  I projected that right now we'd be at about **90GB** in Stack Overflow data; we are at **113GB**.  That's not a lot, right?  Unfortunately, it's all relative...and it _is_ a lot.  Also, we currently have a transaction log of **41GB**.  Yes, we could shrink it...but on the next re-org of the PK_Posts it'll just grow to the same size (edit: thanks to [Kendra Little](https://www.littlekendra.com/) on updating my knowledge base here, it was the cluster re-org _itself_ eating that much transaction space, other indexes on the table need not be rebuilt in the clustered's re-org since SQL 2000).

These projections were used to influence our direction on where we were going with scale,[ up vs. out](https://www.brentozar.com/archive/2011/02/scaling-up-or-scaling-out/).  We did a bit of both.  First let's look at the original problems we faced when the entire network ran off one SQL Server box:

*   Memory usage (even at 96GB, we were over-crammed, we couldn't fit everything in memory)
*   CPU (to be fair, this _had_ other factors like Full Text search eating most of the CPU)
*   **Disk IO** (this is the big one)

What happens when you have lots of databases is all your sequential performance goes to crap because _it's not sequential anymore_. For disk hardware, we had one array for the DB data files: a RAID 10, 6 drive array of magnetic disks. When dozens of DBs are competing in the disk queue, all performance is effectively random performance.  That means our read/write stalls were way higher than we liked.  We tuned our indexing and trimmed as much as we could (**you should _always_ do this before looking at hardware**), but it wasn't enough.  Even if it was enough there were the CPU/Memory issues of the shared box.

Ok, so we've outgrown a single box, now what?  We got a new one specifically for the purpose of giving Stack Overflow its own hardware.  At the time this decision was made, Stack Overflow was a few orders of magnitude larger than _any other site we have_.  Performance-wise, it's still the 800 lb. gorilla.  A very tangible problem here was that Stack Overflow was so large and "hot,"; it was a bully in terms of memory, forcing lesser sites out of memory and causing slow disk loads for queries after idle periods.  Seconds to load a home page? Ouch. Unacceptable.  It wasn't _just_ a hardware decision though, it had a psychological component.  Many people on our team just felt that Stack Overflow, being the huge central site in the network that it is, _deserved_ its own hardware...that's the best I can describe it.

Now, how does that new box solve our problems?  Let's go down the list:

*   Memory (we have another 96GB of memory _just_ for SO, and it's not using massive amounts on the original box, win)
*   CPU (fairly straightforward: it's now split and we have 12 new cores to share the load, win)
*   Disk IO (what's this? SSDs have come out, game. on.)

[We looked at a lot of storage options to solve that IO problem](http://blog.serverfault.com/2011/02/09/our-storage-decision/).  In the end, we went with the fastest SSDs money could buy.  The configuration on that new server is a RAID 1 for the OS (magnetic) and a RAID 10 6x [Intel X-25E 64GB](http://download.intel.com/design/flash/nand/extreme/extreme-sata-ssd-product-brief.pdf), giving us **177 GB** of usable space.  Now let's do the math of what's on that new box as of today:

*   **114** GB – StackOverflow.mdf
*   **41** GB – StackOverflow.ldf

With a few other miscellaneous files on there, we're up to **156 GB**.  155/177 = **12%** free space.  Time to panic? Not yet.  Time to plan? Absolutely.  So what is the plan?

We're going to be replacing these 64GB X-25E drives with [200GB Intel 710](https://ark.intel.com/products/56584/Intel-SSD-710-Series-(200GB-2_5in-SATA-3Gbs-25nm-MLC)) drives.  We're going with the 710 series mainly for the endurance they offer.  And we're going with 200GB and not 300GB because the price difference just isn't worth it, not with the high likelihood of rebuilding the entire server when we move to SQL Server 2012 (and possibly into a cage at that data center).  We simply don't think we'll need that space before we stop using these drives 12-18 months from now.

Since we're eating an outage to do this upgrade (unknown date, those 710 drives are on back-order at the moment) why don't we do some other upgrades?  Memory of the large capacity DIMM variety is getting cheap, crazy cheap.  As the database grows, less and less of it fits into memory, percentage-wise.  Also, the server goes to **288GB** (16GB x 18 DIMMs)...so why not?  For less than $3,000 we can take this server from 6x16GB to 18x16GB and just not worry about memory for the life of the server.  This also has the advantage of balancing all 3 memory channels on both processors, but that's secondary.  Do we feel silly putting _that_ much memory in a single server? Yes, we do...but it's so cheap compared to say **a single SQL Server license **that it seems silly _not_ to do it.

I'll do a follow-up on this after the upgrade (on [the Server Fault main blog](http://blog.serverfault.com/), with a stub here).