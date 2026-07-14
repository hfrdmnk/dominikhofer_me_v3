---
title: "My first wow experience in math class"
slug: "math-wow-experience"
date: 2024-10-12T13:30:00
description: "After 4 weeks of taking the calculus 1 class in university, I’ve had my first true [insert mindblown-emoji here] moment. And I want to share it with you."
tags: ["math", "explainer"]
archived: false
draft: false
favorite: false
---

After 4 weeks of taking the calculus 1 class in university, I’ve had my first true _[insert mindblown-emoji here]_ moment. And I want to share it with you.

Even if you are not a math-person, I think it’s still great to see that something like the thing I’m about to show you is possible. It feels like a magic trick, but with numbers and this (turns out _very_ important) concept called _infinity_.
It not only has the very cool symbol $\infty$, it also comes with some very cool properties, as you will see!

And, as a disclaimer, I won’t get too technical in this post and I will simplify some things. I just want to share the general idea, hopefully awe you a bit as well, and leave you with some further resources for learning more about it (if you’re interested).

## To infinity (and beyond)

In our very first lecture, our professor mentioned that **mathematics in general and calculus in particular essentially “tries to understand infinity”**. This already sounded intriguing to me, so I wrote it down. As you will see, working with infinity makes some interesting stuff possible.

## Back to basics

Even if you haven’t heard the term in a long time, you know about the commutative property of addition. It’s this thing here:

$$2+3=5=3+2$$

Or in words: No matter how you arrange the summands ($2$ and $3$), you’ll always get the same result ($5$).

## Infinite sums

As our professor already hinted at, though, in calculus, we’re not dealing with finite sums all the time. We’re also working with infinite sums. As the name suggests, in these sums, there is an infinite number of terms we have to add to each other.

These things are called “series”. They usually look something like this:

$$\sum_{i=1}^{\infty} a_i$$

Or in words: Let $i$ go from $1$ to $\infty$ and add all elements $a_i$ together.

So the sum in the end looks like this:

$$a_1 + a_2 + ... + a_i$$

Essentially, we’re adding together an infinite number of elements (since $i$ goes up to $\infty$).

## Nothing is as it seems

There is a subgroup of series called “conditionally convergent series”. Don’t worry about what that means, just trust me that the following series is one of them (the “alternating harmonic series”):

$$\sum_{n=1}^{\infty} \frac{(-1)^{n+1}}{n}$$

Or written differently:

$$1 - \frac{1}{2} + \frac{1}{3} - \frac{1}{4} + \frac{1}{5} - \frac{1}{6} + \cdots$$

This goes on infinitely, the sum has no end. But you’ll notice a pattern: Every odd summand is added ($+$), while every even summand is subtracted ($-$).

This leads us to the star of the show: The “[Riemann series theorem](https://en.wikipedia.org/wiki/Riemann_series_theorem)”.

It states (I’m simplifying it a bit here) that we can rearrange the terms in the series in a way, such that it converges to (“reaches”/gets arbitrarily close to[^1]) any arbitrary real number[^2].

A few examples of what that might mean:

- We can rearrange all the terms in a way, such that the sum converges to $\pi$.
- We can rearrange all the terms in a way, such that the sum converges to the current year (e.g. 2024).
- We can rearrange all the terms in a way, such that the sum converges to your age.
- We can rearrange all the terms in a way, such that the sum converges to _[insert random number here]_.

Wait, what?

🤯

## The difference

So while commutativity is a crucial property of finite sums, it isn’t the case for _all_ sums.

For finite sums, we are assured that $2+3$ and $3+2$ always equal the same thing: $5$.

But for infinite series of the before-mentioned subgroup, this is not true. The arrangement of terms matters very much and produces different results. Isn’t that crazy to think about?

## Further reading/watching

As promised, if you are keen to learn more about that phenomenon, here are two helpful links to dive deeper:

Wikipedia article (including the proof): [https://en.wikipedia.org/wiki/Riemann_series_theorem](https://en.wikipedia.org/wiki/Riemann_series_theorem)

A video that explains the theorem in-depth:

{{< youtube Mw7ocynGVmw >}}

## Tell me about your wow moments!

Has this post reminded you of your own mind-blowing mathematical discovery? Or perhaps you've encountered a fascinating mathematical concept that left you in awe? [I'd love to hear about it](/hello)!

Don't be shy – whether it's a simple insight or a complex theorem, all math wows are welcome! Who knows, your story might inspire the next post in this series.

[^1]: Again, I’m simplifying here.

[^2]: In the original arrangement, the series converges to $ln(2)$.
