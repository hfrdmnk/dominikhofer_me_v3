// Live Bern clock + relative "last deployed" time for the shell chrome.
(function () {
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => {
      clock.textContent = fmt.format(new Date());
    };
    tick();
    setInterval(tick, 15000);
  }

  const deploy = document.querySelector("[data-deploy]");
  if (deploy) {
    const then = Number(deploy.dataset.deploy) * 1000;
    const render = () => {
      const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
      let ago;
      if (mins < 1) ago = "just now";
      else if (mins < 60) ago = `${mins} min ago`;
      else {
        const hours = Math.round(mins / 60);
        ago = hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
      }
      deploy.textContent = `last deployed ${ago}`;
    };
    render();
    setInterval(render, 30000);
  }

  const postsArchive = document.querySelector("[data-query-filter]");
  if (postsArchive) {
    const params = new URLSearchParams(window.location.search);
    const favoriteValue = params.get("favorite") ?? params.get("favorites");
    const favoriteOnly =
      (params.has("favorite") || params.has("favorites")) && favoriteValue !== "false";
    const tag = (params.get("tag") ?? params.get("tags"))?.trim().toLocaleLowerCase();

    if (favoriteOnly || tag) {
      postsArchive.querySelectorAll(".post-list__item").forEach((post) => {
        const tags = post.dataset.tags
          .split("|")
          .map((value) => value.trim().toLocaleLowerCase());
        post.hidden =
          (favoriteOnly && post.dataset.favorite !== "true") || (tag && !tags.includes(tag));
      });
    }

    const archiveNav = postsArchive.querySelector("[data-archive-nav]");
    const favoriteToggle = postsArchive.querySelector("[data-favorite-toggle]");
    const yearLinks = [...postsArchive.querySelectorAll("[data-archive-year-link]")];

    favoriteToggle.setAttribute("aria-pressed", String(favoriteOnly));
    favoriteToggle.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("favorites");
      if (favoriteOnly) url.searchParams.delete("favorite");
      else url.searchParams.set("favorite", "true");
      window.location.assign(url.toString());
    });

    const visibleYearLinks = yearLinks.filter((link) => {
      const hasVisiblePosts = [...postsArchive.querySelectorAll(`[data-post-year="${link.dataset.archiveYearLink}"]`)].some(
        (post) => !post.hidden,
      );
      link.hidden = !hasVisiblePosts;
      return hasVisiblePosts;
    });

    let scrollFrame;
    const updateActiveYear = () => {
      scrollFrame = undefined;
      const marker = archiveNav.getBoundingClientRect().bottom + 1;
      let activeLink = visibleYearLinks[0];

      visibleYearLinks.forEach((link) => {
        const anchor = document.getElementById(link.hash.slice(1));
        if (anchor.getBoundingClientRect().top <= marker) activeLink = link;
      });

      yearLinks.forEach((link) => {
        if (link === activeLink) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const requestYearUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(updateActiveYear);
    };

    updateActiveYear();
    window.addEventListener("scroll", requestYearUpdate, { passive: true });
    window.addEventListener("resize", requestYearUpdate);
  }

  document.querySelectorAll(".follow-card__form").forEach((form) => {
    const submit = form.querySelector(".follow-card__submit");
    const successDisplayTime = 5000;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      submit.setAttribute("aria-label", "Subscribing");
      submit.disabled = true;
      form.setAttribute("aria-busy", "true");

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
        });

        if (!response.ok) {
          throw new Error("Subscription failed");
        }

        form.reset();
        submit.dataset.state = "success";
        submit.setAttribute("aria-label", "Subscribed successfully");
        setTimeout(() => {
          submit.dataset.state = "idle";
          submit.setAttribute("aria-label", "Subscribe");
          submit.disabled = false;
        }, successDisplayTime);
      } catch {
        submit.dataset.state = "danger";
        submit.setAttribute("aria-label", "Subscription failed. Try again");
        submit.disabled = false;
      } finally {
        form.removeAttribute("aria-busy");
      }
    });

    form.addEventListener("input", () => {
      if (submit.dataset.state !== "danger") return;
      submit.dataset.state = "idle";
      submit.setAttribute("aria-label", "Subscribe");
    });
  });

  const root = document.documentElement;
  const updateScrollable = () => {
    root.dataset.scrollable = root.scrollHeight > root.clientHeight ? "true" : "false";
  };
  updateScrollable();
  window.addEventListener("load", updateScrollable, { once: true });
  new ResizeObserver(updateScrollable).observe(document.body);

  const tiltPointer = window.matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  let activeTilt;
  let activeRect;
  let pointerFrame;
  let pointerX = 0;
  let pointerY = 0;
  const maximumTilt = 7;
  const maximumEdgeShift = 12;
  const tiltForSize = (size) =>
    Math.min(maximumTilt, (Math.atan2(maximumEdgeShift, size / 2) * 180) / Math.PI);

  const resetTilt = () => {
    if (!activeTilt) return;
    activeTilt.removeAttribute("data-tilt-active");
    activeTilt.style.removeProperty("--mouse-local-x");
    activeTilt.style.removeProperty("--mouse-local-y");
    activeTilt.style.removeProperty("--tilt-rotate-x");
    activeTilt.style.removeProperty("--tilt-rotate-y");
    activeTilt = undefined;
    activeRect = undefined;
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;

      const nextTilt = tiltPointer.matches ? event.target.closest("[data-tilt]") : null;
      if (nextTilt !== activeTilt) {
        resetTilt();
        if (nextTilt) {
          activeTilt = nextTilt;
          activeRect = activeTilt.getBoundingClientRect();
          activeTilt.setAttribute("data-tilt-active", "");
        }
      }

      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        root.style.setProperty("--mouse-x", `${pointerX}px`);
        root.style.setProperty("--mouse-y", `${pointerY}px`);

        if (activeTilt && activeRect) {
          const x = Math.min(1, Math.max(0, (pointerX - activeRect.left) / activeRect.width));
          const y = Math.min(1, Math.max(0, (pointerY - activeRect.top) / activeRect.height));
          activeTilt.style.setProperty("--mouse-local-x", `${x * 100}%`);
          activeTilt.style.setProperty("--mouse-local-y", `${y * 100}%`);
          activeTilt.style.setProperty(
            "--tilt-rotate-x",
            `${(1 - y * 2) * tiltForSize(activeRect.height)}deg`,
          );
          activeTilt.style.setProperty(
            "--tilt-rotate-y",
            `${(x * 2 - 1) * tiltForSize(activeRect.width)}deg`,
          );
        }

        pointerFrame = undefined;
      });
    },
    { passive: true },
  );

  document.addEventListener("pointerleave", resetTilt);
  tiltPointer.addEventListener("change", resetTilt);

  const particleSource = document.querySelector(".topbar__particle");
  if (particleSource) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = new Set();
    let spawnTimer;

    const randomBetween = (min, max) => Math.random() * (max - min) + min;

    const scheduleParticle = () => {
      window.clearTimeout(spawnTimer);
      if (!reducedMotion.matches) {
        spawnTimer = window.setTimeout(spawnParticle, randomBetween(800, 1200));
      }
    };

    const spawnParticle = () => {
      if (document.hidden || reducedMotion.matches) {
        scheduleParticle();
        return;
      }

      const particle = document.createElement("span");
      particle.className = "topbar__particle-trail";
      particleSource.append(particle);

      const endX = randomBetween(-18, 18);
      const controlX = endX + randomBetween(-10, 10);
      const curveX = (progress) =>
        2 * (1 - progress) * progress * controlX + progress ** 2 * endX;
      const transformAt = (progress, scale) =>
        `translate3d(${curveX(progress)}px, ${-76 * progress}px, 0) scale(${scale})`;
      const animation = particle.animate(
        [
          { transform: transformAt(0, 1), opacity: 0.8 },
          { transform: transformAt(0.22, 0.92), opacity: 0.7, offset: 0.22 },
          { transform: transformAt(0.48, 0.75), opacity: 0.48, offset: 0.48 },
          { transform: transformAt(0.74, 0.5), opacity: 0.22, offset: 0.74 },
          { transform: transformAt(1, 0.2), opacity: 0 },
        ],
        {
          duration: randomBetween(3000, 4200),
          easing: "ease-out",
          fill: "forwards",
        },
      );

      const removeParticle = () => {
        particles.delete(animation);
        particle.remove();
      };

      particles.add(animation);
      animation.addEventListener("finish", removeParticle, { once: true });
      animation.addEventListener("cancel", removeParticle, { once: true });
      scheduleParticle();
    };

    reducedMotion.addEventListener("change", () => {
      window.clearTimeout(spawnTimer);
      if (reducedMotion.matches) {
        particles.forEach((animation) => animation.cancel());
      } else {
        scheduleParticle();
      }
    });

    scheduleParticle();
  }
})();
