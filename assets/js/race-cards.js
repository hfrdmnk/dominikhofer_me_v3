(function () {
  function hashLocation(location) {
    const normalized = location
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US")
      .replace(/\s+/g, " ");
    let hash = 2166136261;

    for (const character of normalized) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seed;

    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createPixels(field, location) {
    const random = seededRandom(hashLocation(location));
    const columns = 12;
    const rows = 8;
    const size = 42;
    const centerX = 7.1 + (random() - 0.5) * 1.8;
    const centerY = 2.4 + (random() - 0.5) * 1.2;
    const pixels = document.createDocumentFragment();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const horizontalDistance = (column - centerX) / 6.8;
        const verticalDistance = (row - centerY) / 4.6;
        const distance = Math.hypot(horizontalDistance, verticalDistance);
        const falloff = Math.max(0, 1 - distance);
        const probability = Math.max(0.04, falloff * 0.86 + random() * 0.22);

        if (random() > probability) continue;

        const pixel = document.createElement("span");
        const opacity = Math.min(0.24, 0.035 + falloff * 0.13 + random() * 0.075);
        pixel.style.setProperty("--pixel-x", `${column * size}px`);
        pixel.style.setProperty("--pixel-y", `${row * size}px`);
        pixel.style.setProperty("--pixel-opacity", opacity.toFixed(3));
        pixels.append(pixel);
      }
    }

    field.append(pixels);
  }

  document.querySelectorAll(".race-card").forEach((card) => {
    const field = card.querySelector(".race-card__pixels");
    if (field) createPixels(field, card.dataset.locationSeed);
  });
})();
