---
layout: post
author: Nick Craver
title:  "Stack Overflow: The Hardware - 2016 Edition"
date:   2016-03-29
---
> This is #2 in a [very long series of posts]({% post_url 2016-02-03-stack-overflow-a-technical-deconstruction %}) on Stack Overflow's architecture. Previous post: [Stack Overflow: The Architecture - 2016 Edition]({% post_url 2016-02-17-stack-overflow-the-architecture-2016-edition %})

Who loves hardware? Well, I do and this is my blog so I win. If you *don't* love hardware then I'd go ahead and close the browser.

Still here? Awesome. Or your browser is crazy slow, in which case you should think about some new hardware.

I've repeated many, *many* times: **[performance is a feature](http://blog.codinghorror.com/performance-is-a-feature/)**. Since your code is only as fast as the hardware it runs on, the hardware definitely matters. Just like any other platform, Stack Overflow's architecture comes in layers. Hardware is the foundation layer for us, and having it in-house affords us many luxuries not available in other scenarios...like running on someone else’s servers. It also comes with direct and indirect costs. But that's not the point of this post, [that comparison will come later](https://trello.com/c/4e6TOnA7/87-on-prem-vs-aws-azure-etc-why-the-cloud-isn-t-for-us). For now, I want to provide a detailed inventory of our infrastructure for reference and comparison purposes. And pictures of servers. Sometimes naked servers. This web page could have loaded much faster, but I couldn't help myself.

In many posts through this series I will give a lot of numbers and specs. When I say "our SQL server utilization is almost always at 5--10% CPU," well, that's great. But, 5--10% *of what?* That's when we need a point of reference. This hardware list is meant to both answer those questions and serve as a source for comparison when looking at other platforms and what utilization may look like there, how much capacity to compare to, etc.
<!--more-->

## How We Do Hardware

Disclaimer: I don't do this alone. George Beech ([@GABeech](https://twitter.com/GABeech)) is my main partner in crime when speccing hardware here at Stack. We carefully spec out each server for its intended purpose. What we don't do is order in bulk and assign tasks later. We're not alone in this process though; you have to know what's going to run on the hardware to spec it optimally. We'll work with the developer(s) and/or other site reliability engineers to best accommodate what is intended live on the box. 

We're also looking at what's best *in the system*. Each server is not an island. How it fits into the overall architecture is definitely a consideration. What services can share this platform? This data store? This log system? There is inherent value in managing fewer things, or at least fewer variations of anything.

When we spec out our hardware, we look at a myriad of requirements that help determine what to order. I've never really written this mental checklist down, so let's give it a shot:  

- Is this a scale up or scale out problem? (Are we buying one bigger machine, or a few smaller ones?)
  - How much redundancy do we need/want? (How much headroom and failover capability?)
- Storage:
  - Will this server/application touch disk? (Do we need anything besides the spinny OS drives?)
    - If so, how much? (How much bandwidth? How many small files? Does it need SSDs?)
    - If SSDs, what's the write load? (Are we talking Intel S3500/3700s? P360x? P3700s?)
      - How much SSD capacity do we need? (And should it be a 2-tier solution with HDDs as well?)
      - Is this data totally transient? (Are SSDs without capacitors, which are far cheaper, a better fit?)
  - Will the storage needs likely expand? (Do we get a 1U/10-bay server, or a 2U/26-bay server?)
  - Is this a data warehouse type scenario? (Are we looking at 3.5" drives? If so, in a 12 or 16 drives per 2U chassis?)
    - Is the storage trade-off for the 3.5" backplane worth the 120W TDP limit on processing?
  - Do we need to expose the disks directly? (Does the controller need to support pass-through?)
- Memory:
  - How much memory does it need? (What *must* we buy?)
  - How much memory *could* it use? (What's *reasonable* to buy?)
  - Do we think it will need more memory later? (What memory channel configuration should we go with?)
  - Is this a memory-access-heavy application? (Do we want to max out the clock speed?)
    - Is it highly parallel access? (Do we want spread the same space across more DIMMs?)
- CPU:
  - What kind of processing are we looking at? (Do we need base CPUs or power?)
  - Is it heavily parallel? (Do we want fewer, faster cores? Or, does it call for more, slower cores?)
    - In what ways? Will there be heavy L2/L3 cache contention? (Do we need a huge L3 cache for performance?)
  - Is it mostly single core performance? (Do we want maximum clock?)
    - If so, how many processes at once? (Which turbo spread do we want here?)
- Network:
  - Do we need additional 10Gb network connectivity? (Is this a "through" machine, such as a load balancer?)
  - How much balance do we need on Tx/Rx buffers? (What CPU core count balances best?)
- Redundancy:
  - Do we need servers in the DR data center as well?
    - Do we need the same number, or is less redundancy acceptable?
- Do we need a power cord? No. No we don't.

Now, let's see what hardware in our New York QTS data center serves the sites. Secretly, it's really New Jersey, but let's just keep that between us. Why do we say it's the NY data center? Because we don't want to rename all those NY- servers. I'll note in the list below when and how Denver differs slightly in specs or redundancy levels.

<a href="#" class="button toggle-{{ page.slug }}" style="min-width: 110px;">Hide Pictures</a> (in case you're using this as a hardware reference list later)

## Servers Running Stack Overflow & Stack Exchange Sites

A few global truths so I need not repeat them in each server spec below:  

- OS drives are not included unless they're special. Most servers use a pair of 250 or 500GB SATA HDDs for the OS partition, **always** in a RAID 1. Boot time is not a concern we have and *even if it were*, the vast majority of our boot time on any physical server isn't dependent on drive speed (for example, checking 768GB of memory). 
- All servers are connected by 2 or more 10Gb network links in active/active [LACP](https://en.wikipedia.org/wiki/Link_aggregation#Link_Aggregation_Control_Protocol). 
- All servers run on 208V single phase power (via 2 PSUs feeding from 2 PDUs backed by 2 sources).
- All servers in New York have cable arms, all servers in Denver do not (local engineer's preference).
- All servers have both an [iDRAC](http://en.community.dell.com/techcenter/systems-management/w/wiki/3204.dell-remote-access-controller-drac-idrac) connection (via the management network) and a KVM connection.

#### Network
- 2x Cisco Nexus [5596UP](http://www.cisco.com/c/en/us/products/switches/nexus-5596up-switch/index.html) core switches (96 SFP+ ports each at 10 Gbps)
- 10x Cisco Nexus [2232TM](http://www.cisco.com/c/en/us/products/switches/nexus-2232tm-10ge-fabric-extender/index.html) Fabric Extenders (**2 per rack** - each has 32 BASE-T ports each at 10Gbps + 8 SFP+ 10Gbps uplinks)
- 2x Fortinet [800C](http://www.fortinet.com/products/fortigate/enterprise-firewalls.html) Firewalls
- 2x Cisco [ASR-1001](http://www.cisco.com/c/en/us/products/routers/asr-1001-router/index.html) Routers
- 2x Cisco [ASR-1001-x](http://www.cisco.com/c/en/us/products/routers/asr-1001-x-router/index.html) Routers
- 6x Cisco [2960S-48TS-L](http://www.cisco.com/c/en/us/support/switches/catalyst-2960s-48ts-l-switch/model.html) Management network switches (**1 Per Rack** - 48 1Gbps ports + 4 SFP 1Gbps)
- 1x Dell [DMPU4032](http://accessories.us.dell.com/sna/productdetail.aspx?c=us&l=en&s=bsd&cs=04&sku=A7546775) KVM
- 7x Dell [DAV2216](http://accessories.us.dell.com/sna/productdetail.aspx?c=us&l=en&s=bsd&cs=04&sku=A7546777) KVM Aggregators (**1--2 per rack** - each uplinks to the DPMU4032)

*Note: Each FEX has 80 Gbps of uplink bandwidth to its core, and the cores have a 160 Gbps port channel between them. Due to being a more recent install, the hardware in our Denver data center is slightly newer. All 4 routers are [ASR-1001-x](http://www.cisco.com/c/en/us/products/routers/asr-1001-x-router/index.html) models and the 2 cores are [Cisco Nexus 56128P](http://www.cisco.com/c/en/us/products/switches/nexus-56128p-switch/index.html), which have 96 SFP+ 10Gbps ports and 8 QSFP+ 40Gbps ports each. This saves 10Gbps ports for future expansion since we can bond the cores with 4x 40Gbps links, instead of eating 16x 10Gbps ports as we do in New York.*

<div class="pics-{{ page.slug }}">
Here's what the network gear looks like in New York:

<a href="{{ site.contenturl }}SO-Hardware-Network-NewYork-Rack.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Network-NewYork-Rack-Small.jpg" width="477" height="708" style="float: right;" /></a>
<a href="{{ site.contenturl }}SO-Hardware-Network-NewYork-Fiber.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Network-NewYork-Fiber-Small.jpg" width="477" height="346" style="padding-right: 16px; padding-bottom: 16px;" /></a>
<a href="{{ site.contenturl }}SO-Hardware-Network-NewYork-Fortinet.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Network-NewYork-Fortinet-Small.jpg" width="477" height="346" /></a>

...and in Denver:

[![Denver network before install]({{ site.contenturl }}SO-Hardware-Network-Denver-Raw-Small.jpg)]({{ site.contenturl }}SO-Hardware-Network-Denver-Raw.jpg)

<a href="{{ site.contenturl }}SO-Hardware-Network-Denver-Racked.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Network-Denver-Racked-Small.jpg" width="477" height="620" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Network-Denver-Installed.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Network-Denver-Installed-Small.jpg" width="477" height="620" /></a>

Give a shout to [Mark Henderson](https://twitter.com/thefarseeker), one of our Site Reliability Engineers who made a special trip to the New York DC to get me some high-res, current photos for this post.
</div>

#### SQL Servers (Stack Overflow Cluster)
- 2 Dell [R720xd](http://www.dell.com/us/business/p/poweredge-r720xd/pd) Servers, each with:
- Dual [E5-2697v2](http://ark.intel.com/products/75283/Intel-Xeon-Processor-E5-2697-v2-30M-Cache-2_70-GHz) Processors (12 cores @2.7--3.5GHz each)
- 384 GB of RAM (24x 16 GB DIMMs)
- 1x Intel [P3608](http://www.intel.com/content/www/us/en/solid-state-drives/solid-state-drives-dc-p3608-series.html) 4 TB NVMe PCIe SSD (RAID 0, 2 controllers per card)
- 24x Intel [710](http://ark.intel.com/products/56584/Intel-SSD-710-Series-200GB-2_5in-SATA-3Gbs-25nm-MLC) 200 GB SATA SSDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### SQL Servers (Stack Exchange "...and everything else" Cluster)
- 2 Dell [R730xd](http://www.dell.com/us/business/p/poweredge-r730xd/pd) Servers, each with:
- Dual [E5-2667v3](http://ark.intel.com/products/83361/Intel-Xeon-Processor-E5-2667-v3-20M-Cache-3_20-GHz) Processors (8 cores @3.2--3.6GHz each)
- 768 GB of RAM (24x 32 GB DIMMs)
- 3x Intel [P3700](http://ark.intel.com/products/79620/Intel-SSD-DC-P3700-Series-2_0TB-12-Height-PCIe-3_0-20nm-MLC) 2 TB NVMe PCIe SSD (RAID 0)
- 24x 10K Spinny 1.2 TB SATA HDDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)

*Note: Denver SQL hardware is identical in spec, but there is only 1 SQL server for each corresponding pair in New York.*

<div class="pics-{{ page.slug }}">
Here's what the SQL Servers in New York looked like while getting their PCIe SSD upgrades in February:

<a href="{{ site.contenturl }}SO-Hardware-SQL-Inside.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-SQL-Inside-Small.jpg" width="477" height="354" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-SQL-SSDs.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-SQL-SSDs-Small.jpg" width="477" height="354" /></a>
<a href="{{ site.contenturl }}SO-Hardware-SQL-Front.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-SQL-Front-Small.jpg" width="477" height="354" style="padding-right: 16px; padding-top: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-SQL-Top.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-SQL-Top-Small.jpg" width="477" height="354" style="padding-top: 16px;" /></a>
</div>

#### Web Servers
- 11 Dell [R630](http://www.dell.com/us/business/p/poweredge-r630/pd) Servers, each with:
- Dual [E5-2690v3](http://ark.intel.com/products/81713/Intel-Xeon-Processor-E5-2690-v3-30M-Cache-2_60-GHz) Processors (12 cores @2.6--3.5GHz each)
- 64 GB of RAM (8x 8 GB DIMMs)
- 2x Intel [320](http://ark.intel.com/products/56567/Intel-SSD-320-Series-300GB-2_5in-SATA-3Gbs-25nm-MLC) 300GB SATA SSDs (RAID 1)
- Dual 10 Gbps network (Intel X540/I350 NDC)

<div class="pics-{{ page.slug }}">
<a href="{{ site.contenturl }}SO-Hardware-Web-Tier-Front.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Web-Tier-Front-Small.jpg" width="477" height="354" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Web-Tier-Back.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Web-Tier-Back-Small.jpg" width="477" height="354" /></a>
<a href="{{ site.contenturl }}SO-Hardware-Web-Tier-Unboxed.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Web-Tier-Unboxed-Small.jpg" width="477" height="354" style="padding-right: 16px; padding-top: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Web-Tier-Front2.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Web-Tier-Front2-Small.jpg" width="477" height="354" style="padding-top: 16px;" /></a>
</div>

#### Service Servers (Workers)
- 2 Dell [R630](http://www.dell.com/us/business/p/poweredge-r630/pd) Servers, each with:
  - Dual [E5-2643 v3](http://ark.intel.com/products/81900/Intel-Xeon-Processor-E5-2643-v3-20M-Cache-3_40-GHz) Processors (6 cores @3.4--3.7GHz each)
  - 64 GB of RAM (8x 8 GB DIMMs)
- 1 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Server, with:
  - Dual [E5-2667](http://ark.intel.com/products/64589/Intel-Xeon-Processor-E5-2667-15M-Cache-2_90-GHz-8_00-GTs-Intel-QPI) Processors (6 cores @2.9--3.5GHz each)
  - 32 GB of RAM (8x 4 GB DIMMs)
- 2x Intel [320](http://ark.intel.com/products/56567/Intel-SSD-320-Series-300GB-2_5in-SATA-3Gbs-25nm-MLC) 300GB SATA SSDs (RAID 1)
- Dual 10 Gbps network (Intel X540/I350 NDC)

*Note: NY-SERVICE03 is still an R620, due to not being old enough for replacement at the same time. It will be upgraded later this year.*

#### Redis Servers (Cache)
- 2 Dell [R630](http://www.dell.com/us/business/p/poweredge-r630/pd) Servers, each with:
- Dual [E5-2687W v3](http://ark.intel.com/products/81909/Intel-Xeon-Processor-E5-2687W-v3-25M-Cache-3_10-GHz) Processors (10 cores @3.1--3.5GHz each)
- 256 GB of RAM (16x 16 GB DIMMs)
- 2x Intel [520](http://ark.intel.com/products/66250/Intel-SSD-520-Series-240GB-2_5in-SATA-6Gbs-25nm-MLC) 240GB SATA SSDs (RAID 1)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### Elasticsearch Servers (Search)
- 3 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Servers, each with:
- Dual [E5-2680](http://ark.intel.com/products/64583/Intel-Xeon-Processor-E5-2680-20M-Cache-2_70-GHz-8_00-GTs-Intel-QPI) Processors (8 cores @2.7--3.5GHz each)
- 192 GB of RAM (12x 16 GB DIMMs)
- 2x Intel [S3500](http://ark.intel.com/products/75685/Intel-SSD-DC-S3500-Series-800GB-2_5in-SATA-6Gbs-20nm-MLC) 800GB SATA SSDs (RAID 1)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### HAProxy Servers (Load Balancers)
- 2 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Servers (CloudFlare Traffic), each with:
  - Dual [E5-2637 v2](http://ark.intel.com/products/81900/Intel-Xeon-Processor-E5-2643-v3-20M-Cache-3_40-GHz) Processors (4 cores @3.5--3.8GHz each)
  - 192 GB of RAM (12x 16 GB DIMMs)
  - 6x Seagate [Constellation 7200RPM](http://www.amazon.com/SEAGATE-ST91000640NS-Constellation-6-0Gb-internal/dp/B004HZEF2I) 1TB SATA HDDs (RAID 10) (Logs)
  - Dual 10 Gbps network (Intel X540/I350 NDC) - Internal (DMZ) Traffic
  - Dual 10 Gbps network (Intel X540) - External Traffic
- 2 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Servers (Direct Traffic), each with:
  - Dual [E5-2650](http://ark.intel.com/products/64590/Intel-Xeon-Processor-E5-2650-20M-Cache-2_00-GHz-8_00-GTs-Intel-QPI) Processors (8 cores @2.0--2.8GHz each)
  - 64 GB of RAM (4x 16 GB DIMMs)
  - 2x Seagate [Constellation 7200RPM](http://www.amazon.com/SEAGATE-ST91000640NS-Constellation-6-0Gb-internal/dp/B004HZEF2I) 1TB SATA HDDs (RAID 10) (Logs)
  - Dual 10 Gbps network (Intel X540/I350 NDC) - Internal (DMZ) Traffic
  - Dual 10 Gbps network (Intel X540) - External Traffic

*Note: These servers were ordered at different times and as a result, differ in spec. Also, the two CloudFlare load balancers have more memory for a memcached install we no longer run today for CloudFlare's [Railgun](https://www.cloudflare.com/railgun/).*

<div class="pics-{{ page.slug }}">
The service, redis, search, and load balancer boxes above are all 1U servers in a stack. Here's what that stack looks like in New York:

<a href="{{ site.contenturl }}SO-Hardware-Service-Redis-Search-Front.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Service-Redis-Search-Front-Small.jpg" width="477" height="354" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Service-Rear.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Service-Rear-Small.jpg" width="477" height="354" /></a>
<a href="{{ site.contenturl }}SO-Hardware-Redis-Inside.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Redis-Inside-Small.jpg" width="477" height="354" style="padding-right: 16px; padding-top: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Service-Inside.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Service-Inside-Small.jpg" width="477" height="354" style="padding-top: 16px;" /></a>
</div>

## Servers for Other Bits

We have other servers not directly or indirectly involved in serving site traffic. These are either only tangentially related (e.g., domain controllers which are seldom used for application pool authentication and run as VMs) or are for nonessential purposes like monitoring, log storage, backups, etc.

Since this post is meant to be an appendix for many future posts [in the series]({% post_url 2016-02-03-stack-overflow-a-technical-deconstruction %}), I'm including all of the interesting "background" servers as well. This also lets me share more server porn with you, and who doesn't love that?

#### VM Servers (VMWare, Currently)
- 2 Dell [FX2s](http://www.dell.com/us/business/p/poweredge-fx/pd) Blade Chassis, each with 2 of 4 blades populated
  - 4 Dell [FC630](http://www.dell.com/us/business/p/poweredge-fx/pd#Misc) Blade Servers (2 per chassis), each with:
    - Dual [E5-2698 v3](http://ark.intel.com/products/81900/Intel-Xeon-Processor-E5-2643-v3-20M-Cache-3_40-GHz) Processors (16 cores @2.3--3.6GHz each)
    - 768 GB of RAM (24x 32 GB DIMMs)
    - 2x 16GB SD Cards (Hypervisor - no local storage)
  - Dual 4x 10 Gbps network (FX IOAs - BASET)
- 1 EqualLogic [PS6210X](http://www.dell.com/us/business/p/equallogic-ps6210-series/pd) iSCSI SAN
  - 24x Dell 10K RPM 1.2TB SAS HDDs (RAID10)
  - Dual 10Gb network (10-BASET)
- 1 EqualLogic [PS6110X](http://www.dell.com/us/business/p/equallogic-ps6110x/pd) iSCSI SAN
  - 24x Dell 10K RPM 900GB SAS HDDs (RAID10)
  - Dual 10Gb network (SFP+)
  
<div class="pics-{{ page.slug }}">
<a href="{{ site.contenturl }}SO-Hardware-VMs-Blades.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-VMs-Blades-Small.jpg" width="477" height="708" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-VMs-Blades2.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-VMs-Blades2-Small.jpg" width="477" height="708" /></a>
<a href="{{ site.contenturl }}SO-Hardware-VMs-Front.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-VMs-Front-Small.jpg" width="477" height="708" style="padding-right: 16px; padding-top: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-VMs-Rear.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-VMs-Rear-Small.jpg" width="477" height="708" style="padding-top: 16px;" /></a>
</div>
  
There a few more noteworthy servers behind the scenes that aren't VMs. These perform background tasks, help us troublehsoot with logging, store tons of data, etc.

#### Machine Learning Servers (Providence)
These servers are idle about 99% of the time, but do heavy lifting for a nightly processing job: refreshing Providence. They also serve as an inside-the-datacenter place to test new algorithms on large datasets.

- 2 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Servers, each with:
- Dual [E5-2697 v2](http://ark.intel.com/products/75283/Intel-Xeon-Processor-E5-2697-v2-30M-Cache-2_70-GHz) Processors (12 cores @2.7--3.5GHz each)
- 384 GB of RAM (24x 16 GB DIMMs)
- 4x Intel [530](http://ark.intel.com/products/75336/Intel-SSD-530-Series-480GB-2_5in-SATA-6Gbs-20nm-MLC) 480GB SATA SSDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### Maching Learning Redis Servers (Still Providence)
This is the redis data store for Providence. The usual setup is one master, one slave, and one instance used for testing the latest version of our ML algorithms. While not used to serve the Q&A sites, this data is used when serving job matches on Careers as well as the sidebar job listings.

- 3 Dell [R720xd](http://www.dell.com/us/business/p/poweredge-r720xd/pd) Servers, each with:
- Dual [E5-2650 v2](http://ark.intel.com/products/75269/Intel-Xeon-Processor-E5-2650-v2-20M-Cache-2_60-GHz) Processors (8 cores @2.6--3.4GHz each)
- 384 GB of RAM (24x 16 GB DIMMs)
- 4x Samsung [840 Pro](http://www.samsung.com/semiconductor/products/flash-storage/client-ssd) 480 GB SATA SSDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### Logstash Servers (For ya know...logs)
Our Logstash cluster (using Elasticsearch for storage) stores logs from, well, everything. We plan to replicate HTTP logs in here but are hitting performance issues. However, we do aggregate all network device logs, syslogs, and Windows and Linux system logs here so we can get a network overview or search for issues very quickly. This is also used as a data source in Bosun to get additional information when alerts fire. The total cluster's raw storage is 6x12x4 = 288 TB.

- 6 Dell [R720xd](http://www.dell.com/us/business/p/poweredge-r720xd/pd) Servers, each with:
- Dual [E5-2660 v2](http://ark.intel.com/products/75272/Intel-Xeon-Processor-E5-2660-v2-25M-Cache-2_20-GHz) Processors (10 cores @2.2--3.0GHz each)
- 192 GB of RAM (12x 16 GB DIMMs)
- 12x 7200 RPM Spinny 4 TB SATA HDDs (RAID 0 x3 - 4 drives per)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### HTTP Logging SQL Server
This is where we log every single HTTP hit to our load balancers (sent from HAProxy via syslog) to a SQL database. We only record a few top level bits like URL, Query, UserAgent, timings for SQL, Redis, etc. in here -- so it all goes into a Clustered Columnstore Index per day. We use this for troubleshooting user issues, detecting botnets, etc.

- 1 Dell [R730xd](http://www.dell.com/us/business/p/poweredge-r730xd/pd) Server with:
- Dual [E5-2660 v3](http://ark.intel.com/products/81706/Intel-Xeon-Processor-E5-2660-v3-25M-Cache-2_60-GHz) Processors (10 cores @2.6--3.3GHz each)
- 256 GB of RAM (16x 16 GB DIMMs)
- 2x Intel [P3600](http://ark.intel.com/products/80995/Intel-SSD-DC-P3600-Series-2_0TB-2_5in-PCIe-3_0-20nm-MLC) 2 TB NVMe PCIe SSD (RAID 0)
- 16x Seagate [ST6000NM0024](http://www.seagate.com/internal-hard-drives/enterprise-hard-drives/hdd/enterprise-capacity-3-5-hdd/?sku=ST6000NM0024) 7200RPM Spinny 6 TB SATA HDDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)

#### Development SQL Server
We like for dev to simulate production as much as possible, so SQL matches as well...or at least it used to. We've upgraded production processors since this purchase. We'll be refreshing this box with a 2U solution at the same time as we upgrade the Stack Overflow cluster later this year.

- 1 Dell [R620](http://www.dell.com/us/business/p/poweredge-r620/pd) Server with:
- Dual [E5-2620](http://ark.intel.com/products/64594/Intel-Xeon-Processor-E5-2620-15M-Cache-2_00-GHz-7_20-GTs-Intel-QPI) Processors (6 cores @2.0--2.5GHz each)
- 384 GB of RAM (24x 16 GB DIMMs)
- 8x Intel [S3700](http://ark.intel.com/products/71916/Intel-SSD-DC-S3700-Series-800GB-2_5in-SATA-6Gbs-25nm-MLC) 800 GB SATA SSDs (RAID 10)
- Dual 10 Gbps network (Intel X540/I350 NDC)
  
<div class="pics-{{ page.slug }}">

That's it for the hardware actually serving the sites or that's generally interesting. We of course have other servers for the background tasks such as logging, monitoring, backups, etc. If you're especially curious about specs of any other systems, just ask in comments and I'm happy to detail them out. Here's what the full setup looks like in New York as of a few weeks ago:

<a href="{{ site.contenturl }}SO-Hardware-Racks2.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Racks2-Small.jpg" width="477" height="708" style="padding-right: 16px;" /></a><a href="{{ site.contenturl }}SO-Hardware-Racks.jpg" target="_blank"><img src="{{ site.contenturl }}SO-Hardware-Racks-Small.jpg" width="477" height="708" /></a>

</div>

What's next? The way [this series]({% post_url 2016-02-03-stack-overflow-a-technical-deconstruction %}) works is I blog in order of what the community wants to know about most. Going by [the Trello board](https://trello.com/b/0zgQjktX/blog-post-queue-for-stack-overflow-topics), it looks like [Deployment](https://trello.com/c/bh4GZ30c/25-deployment) is the next most interesting topic. So next time expect to learn how code goes from a developers machine to production and everything involved along the way. I'll cover database migrations, rolling builds, CI infrastructure, how our dev environment is set up, and share stats on all things deployment.

<script>
(function () {
    var pics = document.querySelectorAll('.pics-{{ page.slug }}'), a = document.querySelector('.toggle-{{ page.slug }}');
    a.addEventListener('click', function(e) { 
        e.preventDefault();
        var hide = this.innerHTML === 'Hide Pictures';
        for (var i = 0; i < pics.length; i++) {
            pics[i].style.display = hide ? 'none' : 'block';
        }
        this.innerHTML = hide ? 'Show Pictures' : 'Hide Pictures';
        localStorage.setItem('hide-{{ page.slug }}', hide);
        return false;
    }, false);
    if (localStorage.getItem('hide-{{ page.slug }}') === 'true') {
        a.dispatchEvent(new Event('click'));
    }
})();
</script>
