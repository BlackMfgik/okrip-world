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

  if (savedTheme === "light" && !html.classList.contains("light-theme")) {
    html.classList.add("light-theme");
  }

  const initBg =
    document.querySelector(".home-day-bg") ||
    document.querySelector(".home-night-bg");
  if (initBg) {
    const removeInit = () => html.classList.remove("theme-init");
    initBg.addEventListener("animationend", removeInit, { once: true });
    setTimeout(removeInit, 3500);
  } else {
    html.classList.remove("theme-init");
  }

  toggles.forEach((toggle) => {
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isGoingLight = !html.classList.contains("light-theme");
        const nightBg = document.querySelector(".home-night-bg");

        if (isGoingLight && nightBg) {
          nightBg.style.opacity = "1";
          nightBg.style.animation = "none";
          nightBg.offsetHeight;
          nightBg.style.opacity = "";
          nightBg.style.animation = "";
        }

        const isLight = html.classList.toggle("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");
      });
    }
  });
})();

// ── Minecraft server status ───────────────────────────────────
(function () {
  // IP без порту — mcstatus.io знаходить порт через SRV-запис автоматично.
  // Порт 25594 вказуємо тільки в UI картки, не в запиті до API.
  const SERVERS = [
    { ip: "OkripWorld.mcserver.host" }, // хаб — Survival + Creative
    // { ip: "modded.OkripWorld.mcserver.host" }, // розкоментуй, коли запустиш
  ];

  const fetchStatus = async (ip) => {
    const res = await fetch(
      `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(ip)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const updateTotalDisplay = (total) => {
    const navEl = document.getElementById("nav-total-online");
    if (navEl) navEl.textContent = `ОНЛАЙН ${total}`;

    const statEl = document.getElementById("stat-total-online");
    if (statEl) statEl.textContent = total;
  };

  const refresh = () => {
    Promise.allSettled(SERVERS.map(({ ip }) => fetchStatus(ip))).then(
      (results) => {
        let totalOnline = 0;

        results.forEach((result, i) => {
          const ip = SERVERS[i].ip;
          const cards = document.querySelectorAll(
            `.server-card[data-server-ip="${ip}"]`,
          );

          if (result.status === "fulfilled" && result.value.online) {
            const count = result.value.players?.online ?? 0;
            totalOnline += count;

            cards.forEach((card) => {
              const badgeEl = card.querySelector(".server-badge");
              const onlineEl = card.querySelector(".server-online");
              if (badgeEl) badgeEl.innerHTML = `<div class="dot"></div> ONLINE`;
              if (onlineEl) onlineEl.textContent = `${count} ОНЛАЙН`;
            });
          } else {
            cards.forEach((card) => {
              const badgeEl = card.querySelector(".server-badge");
              const onlineEl = card.querySelector(".server-online");
              if (badgeEl) badgeEl.textContent = "OFFLINE";
              if (onlineEl) onlineEl.textContent = `0 ОНЛАЙН`;
            });
          }
        });

        updateTotalDisplay(totalOnline);
      },
    );
  };

  refresh(); // одразу при завантаженні
  setInterval(refresh, 30_000); // потім кожні 30 секунд
})();
