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
      if (favoriteOnly) {
        postsArchive
          .querySelectorAll(".post-list__title mark")
          .forEach((mark) => mark.replaceWith(mark.textContent));
      }

      postsArchive.querySelectorAll(".post-list__item").forEach((post) => {
        const tags = post.dataset.tags
          .split("|")
          .map((value) => value.trim().toLocaleLowerCase());
        post.hidden =
          (favoriteOnly && post.dataset.favorite !== "true") || (tag && !tags.includes(tag));
      });
    }
  }

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
          activeTilt.style.setProperty("--tilt-rotate-x", `${(1 - y * 2) * 7}deg`);
          activeTilt.style.setProperty("--tilt-rotate-y", `${(x * 2 - 1) * 7}deg`);
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
