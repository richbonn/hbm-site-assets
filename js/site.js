/* Mobile menu only. No tracking, no analytics, no third-party scripts. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var btn = document.querySelector(".hbm-nav-toggle");
  var nav = document.getElementById("site-nav");
  if (!btn || !nav) return;
  function setOpen(open) {
    nav.classList.toggle("hbm-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function () { setOpen(btn.getAttribute("aria-expanded") !== "true"); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("hbm-open")) { setOpen(false); btn.focus(); }
  });
})();

(function () {
  document.querySelectorAll("[data-yt]").forEach(function (box) {
    var btn = box.querySelector(".hbm-video-play");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + box.getAttribute("data-yt") + "?start=" + (box.getAttribute("data-start") || 0) + "&autoplay=1&rel=0";
      f.title = "Rich Bonn on Houston Life";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      f.allowFullscreen = true;
      box.innerHTML = "";
      box.appendChild(f);
    });
  });
})();
