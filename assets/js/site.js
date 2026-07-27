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

  const cover = document.querySelector(".topbar__cover");
  if (cover) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = new Set();
    let spawnTimer;

    const randomBetween = (min, max) => Math.random() * (max - min) + min;

    const scheduleParticle = () => {
      window.clearTimeout(spawnTimer);
      if (!reducedMotion.matches) {
        spawnTimer = window.setTimeout(spawnParticle, randomBetween(1400, 2600));
      }
    };

    const spawnParticle = () => {
      if (document.hidden || reducedMotion.matches) {
        scheduleParticle();
        return;
      }

      const particle = document.createElement("span");
      particle.className = "topbar__cover-particle";
      cover.append(particle);

      const x1 = randomBetween(-8, 8);
      const x2 = x1 + randomBetween(-12, 12);
      const x3 = x2 + randomBetween(-8, 8);
      const animation = particle.animate(
        [
          { transform: "translate3d(0, 0, 0)", opacity: 0.8 },
          { transform: `translate3d(${x1}px, -22px, 0)`, opacity: 0.6, offset: 0.3 },
          { transform: `translate3d(${x2}px, -48px, 0)`, opacity: 0.3, offset: 0.68 },
          { transform: `translate3d(${x3}px, -76px, 0)`, opacity: 0 },
        ],
        {
          duration: randomBetween(3000, 4200),
          easing: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
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
