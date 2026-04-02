// ── Active nav link ──────────────────────────────────────────
(function () {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === page || (page === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });
})();

// ── Copy to clipboard helper ──────────────────────────────────
let toastTimer = null;

function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

function copyText(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("СКОПІЙОВАНО"))
    .catch(() => showToast("ПОМИЛКА"));
}

// ── Nav IP copy (map / other pages) ──────────────────────────
const ipBlock = document.getElementById("ip-block");
if (ipBlock) {
  const ipText = document.getElementById("ip-address")?.innerText;
  if (ipText) {
    ipBlock.addEventListener("click", () => copyText(ipText));
  }
}

// ── Server card IP copy ───────────────────────────────────────
document.querySelectorAll(".server-ip-block").forEach((el) => {
  el.addEventListener("click", () => {
    const ip = el.querySelector(".ip-value")?.innerText;
    if (ip) copyText(ip);
  });
});

// ── Theme toggle ──────────────────────────────────────────────
(function () {
  const html = document.documentElement;
  const toggles = document.querySelectorAll("#theme-toggle");
  const savedTheme = localStorage.getItem("theme") || "dark";

  // Apply saved theme on load
  if (savedTheme === "light") {
    html.classList.add("light-theme");
  }

  // Toggle theme on any toggle button
  toggles.forEach((toggle) => {
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isLight = html.classList.toggle("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");
      });
    }
  });
})();
