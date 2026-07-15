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
})();
