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

  // Apply saved theme on load (клас вже міг бути застосований inline-скриптом у <head>)
  if (savedTheme === "light" && !html.classList.contains("light-theme")) {
    html.classList.add("light-theme");
  }

  // Прибираємо theme-init після завершення анімації появлення фону.
  // theme-init гарантує, що анімація bgReveal грає тільки при першому завантаженні,
  // а не при кожному перемиканні теми.
  const initBg =
    document.querySelector(".home-day-bg") ||
    document.querySelector(".home-night-bg");
  if (initBg) {
    const removeInit = () => html.classList.remove("theme-init");
    initBg.addEventListener("animationend", removeInit, { once: true });
    // Запасний таймер на випадок, якщо анімація не спрацює
    setTimeout(removeInit, 3500);
  } else {
    // Сторінка без фонових елементів — прибираємо одразу
    html.classList.remove("theme-init");
  }

  // Toggle theme on any toggle button
  toggles.forEach((toggle) => {
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isGoingLight = !html.classList.contains("light-theme");
        const nightBg = document.querySelector(".home-night-bg");

        if (isGoingLight && nightBg) {
          // Проблема: animation-fill-mode:forwards тримає opacity:1,
          // але коли CSS застосовує animation:none — fill зникає миттєво
          // і opacity стрибає до 0 без transition.
          // Рішення: зафіксувати поточний opacity через inline style
          // до видалення анімації, щоб transition мав від чого плавно відходити.
          nightBg.style.opacity = "1";
          nightBg.style.animation = "none";
          // Примусовий reflow — браузер фіксує "from" стан
          nightBg.offsetHeight; // eslint-disable-line no-unused-expressions
          // Прибираємо inline стилі — CSS light-theme правила вступають в дію,
          // і transition плавно переходить opacity: 1 → 0
          nightBg.style.opacity = "";
          nightBg.style.animation = "";
        }

        const isLight = html.classList.toggle("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");
      });
    }
  });
})();
