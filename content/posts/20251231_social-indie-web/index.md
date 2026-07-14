---
title: "A more social IndieWeb"
slug: "social-indie-web"
date: 2025-12-31T08:24:11
lastmod: 2026-01-02T08:32:29
description: "My entry for the IndieWeb Carnival of December 2025 about the IndieWeb in 2030."
tags: ["indieweb carnival", "social web", "at protocol", "activitypub"]
archived: false
draft: false
favorite: false
---

If I had to choose one direction, that I could push the IndieWeb towards for the next couple of years, it would be the social route. Just having a personal website, which already makes you part of the movement, can be incredibly lonely without any additional tools. This is definitely something we need to improve.

Sure, there are standards like [Webmentions](https://indieweb.org/Webmention), which lets one website notify another when it for example links to it in a comment. But this particular one is just too niche and challenging to implement. Heck, I’m a dev, and I’m not even sure if I have implemented them correctly.

A standard that has stood its test of time is [RSS](https://aboutfeeds.com/). I would argue that it is, in absolute numbers, more widespread than during its glory days 10 or 20 years ago – mainly because of podcasts. But it’s still a one-way street. Someone publishes content, and you get to consume it in a central place – that’s it.

What if RSS or an RSS-like format got more social? Some sort of RSS 2.0[^1]. I’m mainly talking about two things:

- Social interactions
- Discovery

Having a way to quickly reply and provide feedback without having to use another platform would be a game changer. Sure, email feels more personal, [and I love it, when someone writes me in response to a post](/joy-of-writing-online). But let’s be real; people just don’t do that very often. Having likes would also be great. Not as a vanity metric, but more as a signal that you are not posting into the void and people actually took the time to read what you had to say.

Discovery would also help with the problem of people not knowing where to start when adopting RSS. They could just subscribe to one feed and similar ones would be recommended. The key difference to a social media algorithm here would be that you still have full control of your RSS reader. Nothing gets pushed on you, and only posts from subscribed websites show up – still in reverse chronological order.

I’m not sure yet how this would be implemented exactly on a technical level, and especially how to still make it privacy-preserving. But what I do know is that some interesting developments are being made.

Primarily within the Open Social Web. Protocols like [ActivityPub](https://dominikhofer.me/diving-into-the-fediverse-once-again) and [AT Protocol](https://dominikhofer.me/diving-into-the-atmosphere) are the future. Maybe the latter even more so than the former for what I’m describing.

If you don’t know what AT is, I can only recommend you to read this phenomenal post by Dan Abramov: [Open Social](https://overreacted.io/open-social/)

But in short, in this protocol, each user controls their data in a thing called “PDS”, short for “Personal Data Server”. No matter what data type, a [Bluesky](https://bsky.app/profile/dominik.social) Post, a book logged on [Bookhive](https://bookhive.buzz/profile/dominik.social) a repo hosted over on [Tangled](https://tangled.org/) or even a [simple static website](https://wisp.place/) – everything is in there[^2]. And you can pretty easily host it yourself, especially compared to let’s say a full-fledged ActivityPub server.

Back to the topic of a more social IndieWeb. The good news is: There is some progress being made in this space. I especially wanted to highlight three projects here:

[Micro.blog](https://micro.blog/) is the OG of making personal websites more social. If you post your content on there, it is automatically distributed to Mastodon, Bluesky et al. But it still feels more like a social media profile than a personal website.

[Ghost](https://ghost.org/) made some considerable improvements as well with their [v6 release](https://ghost.org/6/). Now, all websites running with this CMS are essentially connected to each other and part of the wider Fediverse. Sadly, the ATproto feature only works via a bridge for now. But I still think this is the best tool right now if you want to make your personal website more social[^3]. 

The project I’m most excited about though is called [Leaflet](https://leaflet.pub/discover). It’s a blogging platform that lives on the AT Protocol. And you can already see the advantages of that regarding social interactions: When you comment on a Leaflet link over on Bluesky, the comment automatically shows up in the Leaflet [comment section](https://underreacted.leaflet.pub/3m23gqakbqs2j?interactionDrawer=comments). You can also easily share quotes on Bluesky, and they again show up in Leaflet. Their creators are actively [exploring on how to make a more social RSS](https://bsky.app/profile/schlage.town/post/3m4jiee4qoc2e), and I am very much rooting for them!

Still, a long way to go, though. But maybe, until 2030, some of these imaginations will turn into reality. The Open Social Web will have succeeded over the walled gardens, and the IndieWeb is thriving like never before. I certainly hope this will be the case!

What can _you_ do right now?

Join the IndieWeb! [Start your own personal website](/personal-internet-home), start sharing what you’re working on over on [Mastodon](https://mastodon.social/) or [Bluesky](https://bsky.app/), blog on [Micro.blog](https://micro.blog/), [Ghost](https://ghost.org/) or [Leaflet](https://leaflet.pub/). We can all help to make the IndieWeb feel more social :)

_This is my entry for the [IndieWeb Carnival of December 2025](https://vhbelvadi.com/indieweb-carnival-future) about the IndieWeb in 2030 (hosted by V.H. Belvadi). If you have a blog, consider writing an entry yourself._

[^1]:	As V.H. [rightfully pointed out](https://vhbelvadi.com/indieweb-carnival-round-up-dec-2025), it should actually be RSS 3.0 – 2.0 is the current spec.

[^2]:	Also, [domains are the handles](https://internethandle.org/) in this protocol. How cool is that?

[^3]:	Can you guess on which platform I’m building v2 of this website? ;)
