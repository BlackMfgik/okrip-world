// ── BlueMap iframe loader ─────────────────────────────────────
const frame = document.getElementById("bluemap-frame");
const placeholder = document.getElementById("placeholder");
const errorBanner = document.getElementById("map-error");
const pulseDot = document.getElementById("pulse-dot");

if (frame && placeholder) {
  const timeout = setTimeout(() => {
    if (!frame.classList.contains("loaded")) {
      if (errorBanner) errorBanner.classList.add("visible");
      if (pulseDot) pulseDot.style.animationPlayState = "paused";
    }
  }, 15000);

  frame.addEventListener("load", () => {
    frame.classList.add("loaded");
    placeholder.classList.add("hidden");
    clearTimeout(timeout);
  });
}
