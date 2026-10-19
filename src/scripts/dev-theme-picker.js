(function () {
  const picker = document.querySelector("[data-dev-theme-picker]");
  if (!picker) return;

  const root = document.documentElement;
  const dayButtons = [...picker.querySelectorAll("[data-theme-day]")];
  const storageKey = "dev-theme-day";

  const applyDay = (day) => {
    root.dataset.day = day;
    dayButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeDay === day));
    });
  };

  picker.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-theme-day]");
    if (dayButton) {
      localStorage.setItem(storageKey, dayButton.dataset.themeDay);
      applyDay(dayButton.dataset.themeDay);
      return;
    }

    if (event.target.closest("[data-theme-reset]")) {
      localStorage.removeItem(storageKey);
      applyDay(root.dataset.currentDay);
    }
  });

  applyDay(root.dataset.day);
})();
