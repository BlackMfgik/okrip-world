// Перемикач типу мапи в стилі сайту замість бічної панелі Dynmap.
// Підключається проксі /dynmap/index.html; виконується всередині сторінки Dynmap.
(function () {
  var LABELS = { flat: "Мапа", surface: "3D", cave: "Печери", nether: "3D", the_end: "3D" };
  var bar;

  function render(dynmap) {
    var world = dynmap.world;
    if (!world) return;
    var maps = Object.keys(world.maps).map(function (name) { return world.maps[name]; });
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "okrip-maptypes";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "Тип мапи");
      document.body.appendChild(bar);
    }
    bar.hidden = maps.length < 2;
    bar.textContent = "";
    maps.forEach(function (map) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = LABELS[map.options.name] || map.options.title;
      button.setAttribute("aria-pressed", String(map === dynmap.maptype));
      button.addEventListener("click", function () {
        if (map !== dynmap.maptype) dynmap.selectMap(map);
      });
      bar.appendChild(button);
    });
  }

  function start() {
    var dynmap = window.dynmap;
    if (!dynmap || !dynmap.world || !window.jQuery) return setTimeout(start, 200);
    window.jQuery(dynmap).on("mapchanged worldchanged", function () { render(dynmap); });
    render(dynmap);
  }

  start();
})();
