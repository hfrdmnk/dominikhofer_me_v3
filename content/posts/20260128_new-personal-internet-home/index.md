---
title: "My new personal home on the internet"
slug: "new-personal-internet-home"
date: 2026-01-28T17:25:00
description: "Process, thoughts and a look behind the scenes for the v2 launch of my personal website."
tags: ["personalwebsite", "indieweb", "siteupdate"]
cover: "personal-internet-home.webp"
archived: false
draft: false
favorite: false
---

Last Sunday, approximately 1.5 years [after its launch](/personal-internet-home), my old website got retired[^1], and this new one got published. Maybe you’ve seen it already these past couple of days – if not, then welcome!

In this post, I want to give you a glimpse behind the scenes, some decisions I made and why, and where we’re heading.

Enjoy :)

## The reason

I wasn’t really “unhappy” with my old website per se, there were just a few gripes I had with it. I still like the design and could’ve definitely used it on this new site as well, but I also wanted to go in another direction, ever since [posting a logo concept](https://bsky.app/profile/dominik.social/post/3m4dxuln32e2k) a couple of months ago.

The main “problems” with the old site were:
- It felt too “static” to me and the blog posts weren’t really first class citizens. 
- The content was managed via Git which is a simple method on one hand, on the other one, it meant that I could only really publish from my laptop and not really from e.g. my phone.

One place where you can see this pretty well is [/photos](/photos). Uploading a new one was just too much of a hassle: I had to manually resize and rename the image, drag it into [Darkmatter](https://getdarkmatter.dev/), find a unique slug and only then could I publish it. Just too many steps, which resulted in me not posting new photos for almost the entirety of the lifetime of the old site. 

Things had to change.

## The concept

The main goal was to make the dynamic content (a.k.a. posts, notes, photos & races) front and center. Which led me to design kind of my own personal social media profile on the internet. The main inspiration for that came from John, the Founder of Ghost (more on that later). If you [visit his website](https://john.onolan.org/), you will definitely see that.

The best decision I made regarding this dynamic content is the separation between posts and notes. Notes are my format to “just post” stuff without a high barrier. For example, notes don’t have a title, they just get an automatic slug. And also, notes can come from external places. Currently, it also includes all my Bluesky posts with the [#buildinpublic](/tag/buildinpublic) or ones, that have a link in them ([#link](/tag/link), this also includes reposts and quotes).

I also was able to backfill all my tweets from my now deleted X account, all the way back from 2018. Go visit [#tweet](/tag/tweet) for a trip down memory lane, it’s pretty interesting to see, what I’ve posted in the past[^2].

As with other social media profiles, you can also follow my site by hitting the big orange button on the top right. But instead of needing to have some sort of account, you can do it with two of the most open protocols the internet has to offer: Email[^3] and RSS.

The RSS feeds are now split up by content type as well, so you can just follow whatever interests you. The old feed at [/rss](/rss) is mapped to the “Everything”-Feed – [sorry if I spammed your reader on Sunday](/bm3d4h6ccgsrakrg).

One other part I want to highlight more on this new site are [slash pages](https://slashpages.net/). But that’s still a work in progress at the moment…

## The tech

The MVP of my new site is, undoubtedly, [Kirby](https://getkirby.com/). If you’re a web dev and want to tinker a bit with your site, I can’t imagine a better CMS to use. It is so flexible, has great plugins, is a one-time purchase and doesn’t even need a database! Everything is just flat files and PHP, nothing more. Pretty cool.

Having it be a server-side application built with PHP proves to be a great advantage for me. For one, I work with Laravel at my day job, so I’m very familiar with the language. Plus, the caching system is fantastic, the site [feels really fast](https://bsky.app/profile/neon.ink/post/3mdbdmqqaxc22). And I also don’t have to resize my images anymore, the site does it by itself! Once when I upload them, another time when they get served. This is such a quality of life improvement for me when it comes to publishing more!

The only reason I didn’t commit to Kirby earlier was, that I was a bit afraid to tinker too much and never finish launching the site. But luckily, Claude Code is so good by now, that I managed to build this whole site in roughly 2 weeks without any prior knowledge of the CMS (while being in exam season).

So yeah, sorry Kirby for not committing to you earlier…

…but the other options were all so tempting as well:

- **[Astro](https://astro.build/) + a new Backend:** This would have allowed me to essentially reuse 90% of the code and probably would’ve been a very efficient solution. On the other hand, I didn’t really feel like managing two moving parts and I also wanted to try something new.
- **[Ghost](https://ghost.org/):**[^4] Ghost is the most beautiful CMS out there and if I’m honest, this would’ve been the main reason for me to choose it. It’s a great CMS for classic blogs or publications, but I think for my setup with these different content types, I would’ve fought the system too many times. Their [social integrations](https://ghost.org/6/) are pretty cool though, and having a built-in newsletter is also very nice.
- **[Micro.Blog](https://micro.blog/):** Speaking of social integrations, Micro.Blog is the undisputed king of that and one of the indie web’s favorites. This platform gets you up to speed quickly, [POSSE](https://indieweb.org/POSSE) is built in, and you don’t need to have much technical knowledge to use it. That’s why this platform would probably be my recommendation if you’re a non-techie. But exactly this approach was just too restricting for me, as I found out. The developer experience wasn’t really great when I tried to build my own theme, so I discarded the idea again.
- **[Leaflet](https://leaflet.pub/):** This is an [atproto](https://atproto.com/)-based blogging platform, which means, it’s powered by the same protocol underlying Bluesky. I’m very interested into this protocol these days, so using Leaflet in conjunction with Astro was also an interesting choice to consider. But again, this felt like managing too many moving parts and when it comes to social publishing on the at protocol, I think I have a better idea (more on that below).

## The future

Talking about the future of this newly launched website, I plan to mainly evolve it into two directions:

First, I want to add more slash pages. I like the idea of just being able to say “Visit my /uses[^5] page to see all the products and tools I use in my life” and to hopefully help others discover cool stuff or learn more about me. The [/slash](/slash) page will be the hub of all these pages. Except for [/now](/now) and [/about](/about), which remain in the nav, as they are the most important ones in my opinion.

The other direction is the social layer of my web presence. I truly believe that the before mentioned at protocol has a huge potential to be that layer and helps us connect the indie web (and also the broader web in general). For example, there is this new lexicon (essentially just a schema to save data in atproto) called [standard.site](https://standard.site/), which aims to provide one unified interface for long-form content on the web. If I publish my posts not only as web pages but also as documents using this lexicon, the whole atmosphere (the collection of apps built on top of atproto) can be notified of and consume them. [There are already tools](https://docs.surf/) that allow you to see all, yes _really all_, the posts that are published this way[^6]. This is essentially the first step towards a [more social indie web](/social-indie-web) that I outlined in my last post.

But all these things are plans for the future. Right now, I’m happy that I was able to launch this new website in a relatively short amount of time and how it turned out. The next small steps are to add more basic slash pages and photos from the last 1.5 years. There’s a big catalog to go through :)

[^1]:	I archived it at [https://v1.dominikhofer.me/](https://v1.dominikhofer.me/) if you want to see how it looked like.

[^2]:	And also, how much I adopted the “Twitter speak” at that time.

[^3]:	Although this one is not yet properly set up, but you can still register :)

[^4]:	Fun fact: Not even a month ago, I was pretty sure I was gonna go with Ghost: https://dominikhofer.me/social-indie-web

[^5]:	Coming soon ;)

[^6]:	Steve wrote a couple of interesting posts about this topic the last couple of days, for example this one: [https://stevedylan.dev/posts/standard-site-the-publishing-gateway/](https://stevedylan.dev/posts/standard-site-the-publishing-gateway/)
