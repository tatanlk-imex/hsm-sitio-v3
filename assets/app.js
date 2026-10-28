/* HSM Chile - comportamiento del sitio. El contenido ya viene en el HTML: este archivo solo agrega menús, carrusel, búsqueda, pestañas y formulario. */
(function () {
  "use strict";
  var O = window.HSM || {}, RAIZ = O.raiz || "/";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- cookies: el visitante elige qué activa; las etiquetas de Google se cargan solo si acepta (Ley 21.719) ---------- */
  var COOKIE = "hsm_cookies";
  function leerEleccion() {                       // {m: medición (Analytics), p: publicidad (Ads)} o null si aún no decidió (o si debe volver a preguntarse)
    try {
      var v = sessionStorage.getItem(COOKIE);      // rechazo hecho en esta visita
      if (v) { var r = JSON.parse(v); return { m: !!r.m, p: !!r.p }; }
      v = localStorage.getItem(COOKIE); if (!v) { return null; }
      if (v === "si") { return { m: true, p: true }; } if (v === "no") { return { m: false, p: false }; }
      var o = JSON.parse(v), rechazo = !o.m && !o.p;
      if (rechazo && O.ck_rep === "visita") { return null; }                                   // volver a preguntar en cada visita
      if (rechazo && O.ck_rep === "90" && o.t && (Date.now() - o.t) > 90 * 86400000) { return null; }   // o a los 90 días
      return { m: !!o.m, p: !!o.p };
    } catch (e) { return null; }
  }
  function guardarEleccion(m, p) {
    var d = JSON.stringify({ m: m, p: p, t: Date.now() });
    try {
      localStorage.removeItem(COOKIE); sessionStorage.removeItem(COOKIE);
      if (!m && !p && O.ck_rep === "visita") { sessionStorage.setItem(COOKIE, d); } else { localStorage.setItem(COOKIE, d); }
    } catch (e) {}
  }
  var cargadas = { m: false, p: false }, gtmCargado = false;
  function idDe(tipo) { return tipo === "m" ? O.ga4 : O.ads; }
  function cargarEtiquetas(el) {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) { window.gtag = function () { window.dataLayer.push(arguments); }; }
    ["m", "p"].forEach(function (t) {
      var id = idDe(t); if (!el[t] || !id || cargadas[t]) { return; }
      if (!gtmCargado) { var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id); document.head.appendChild(s); window.gtag("js", new Date()); gtmCargado = true; }
      window.gtag("config", id); cargadas[t] = true;
    });
    if (window.HSM_GRACIAS_PENDIENTE && cargadas.p) { window.HSM_GRACIAS_PENDIENTE(); }
  }
  function borrarCookiesGoogle() {
    var hosts = [location.hostname, "." + location.hostname, "." + location.hostname.split(".").slice(-2).join(".")];
    document.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim();
      if (/^(_ga|_gid|_gat|_gcl|FPLC|_dc_gtm)/.test(n)) { hosts.forEach(function (h) { document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + h; }); document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; }
    });
  }
  var aviso = document.getElementById("aviso-cookies"), panel = document.getElementById("panel-cookies");
  function ocultarTodo() { if (aviso) { aviso.hidden = true; } if (panel) { panel.hidden = true; } }
  function decidir(m, p) {
    guardarEleccion(m, p); ocultarTodo();
    if ((cargadas.m && !m) || (cargadas.p && !p)) { borrarCookiesGoogle(); location.reload(); return; }   // se quita lo que ya estaba activo
    cargarEtiquetas({ m: m, p: p });
  }
  function abrirPanel() {
    if (!panel) { return; }
    var e = leerEleccion() || { m: O.ck_pre !== false, p: O.ck_pre !== false };   // sin decisión previa: activados o no según el ajuste
    var cm = panel.querySelector("[data-cookie=m]"), cp = panel.querySelector("[data-cookie=p]");
    if (cm) { cm.checked = e.m; } if (cp) { cp.checked = e.p; }
    if (aviso) { aviso.hidden = true; } panel.hidden = false; var b = panel.querySelector(".pc-todas"); if (b) { b.focus(); }
  }
  function cerrarPanel() { panel.hidden = true; if (!leerEleccion() && aviso) { aviso.hidden = false; } }
  if (aviso && panel) {
    var e0 = leerEleccion();
    if (e0) { cargarEtiquetas(e0); } else { aviso.hidden = false; }
    aviso.querySelector(".ac-si").addEventListener("click", function () { decidir(true, true); });
    aviso.querySelector(".ac-admin").addEventListener("click", abrirPanel);
    panel.querySelector(".pc-todas").addEventListener("click", function () { decidir(true, true); });
    panel.querySelector(".pc-ninguna").addEventListener("click", function () { decidir(false, false); });
    panel.querySelector(".pc-seleccion").addEventListener("click", function () {
      var cm = panel.querySelector("[data-cookie=m]"), cp = panel.querySelector("[data-cookie=p]"); decidir(!!(cm && cm.checked), !!(cp && cp.checked));
    });
    panel.addEventListener("click", function (e) { if (e.target === panel) { cerrarPanel(); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { cerrarPanel(); } });
  }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".cambiar-cookies"); if (b) { abrirPanel(); } });

  /* ---------- medición (Google Analytics 4 y Google Ads) ---------- */
  window.dataLayer = window.dataLayer || [];
  function ev(nombre, datos, conv) {
    datos = datos || {};
    var o = { event: nombre }; for (var k in datos) { o[k] = datos[k]; }
    window.dataLayer.push(o);
    if (typeof window.gtag === "function") {
      window.gtag("event", nombre, datos);
      if (conv && O.ads && cargadas.p) { window.gtag("event", "conversion", { send_to: O.ads + "/" + conv }); }
    }
  }
  try {
    var q = new URLSearchParams(location.search), g = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"].forEach(function (k) { if (q.get(k)) { g[k] = q.get(k); } });
    if (Object.keys(g).length) { sessionStorage.setItem("hsm_utm", JSON.stringify(g)); }
  } catch (e) {}
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a"); if (!a) { return; }
    var h = a.getAttribute("href") || "";
    if (h.indexOf("tel:") === 0) { ev("click_llamar", { numero: h.slice(4) }, O.conv_llamada); }
    else if (h.indexOf("wa.me") > -1 || h.indexOf("api.whatsapp.com") > -1) { ev("click_whatsapp", {}, O.conv_wsp); }
    else if (h.indexOf("mailto:") === 0) { ev("click_correo", {}); }
    else if (/\.pdf(\?|#|$)/i.test(h)) { ev("ver_ficha_tecnica", { archivo: h.split("/").pop().split("#")[0] }); }
  });
  function conversionFormulario() {
    try { if (sessionStorage.getItem("hsm_lead_ok")) { return; } sessionStorage.setItem("hsm_lead_ok", "1"); } catch (e) {}
    ev("generate_lead", { form: "contacto" }, O.conv_form);
  }
  if (window.HSM_GRACIAS) { if (typeof window.gtag === "function" && cargadas.p) { conversionFormulario(); } else { window.HSM_GRACIAS_PENDIENTE = conversionFormulario; } }

  /* ---------- cabecera: menú móvil ---------- */
  var tog = $(".mobile-menu-toggle"), nav = $(".nav-header");
  if (tog && nav) {
    tog.addEventListener("click", function () { var a = nav.classList.toggle("open"); tog.setAttribute("aria-expanded", a ? "true" : "false"); });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); tog.setAttribute("aria-expanded", "false"); }); });
  }

  /* ---------- menú de categorías de la portada (acordeón en celulares; en escritorio se abre con el cursor) ---------- */
  var sm = $(".second-menu");
  if (sm) {
    var ABAJO = $(".accordion-icon", sm) ? $(".accordion-icon", sm).innerHTML : "";
    var ARRIBA = ABAJO.replace(/d="[^"]*"/, 'd="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"');
    function alternar(li, ev) {
      if (window.innerWidth > 900) { return; }
      var caja = li.querySelector(":scope > .second-menu__submenu, :scope > .second-menu__submenu-list"); if (!caja) { return; }
      if (ev) { ev.preventDefault(); }
      var abierto = caja.classList.toggle("open"); var u = caja.querySelector(":scope > .second-menu__submenu-list"); if (u && caja.classList.contains("second-menu__submenu")) { u.classList.toggle("open", abierto); }
      var ic = li.querySelector(":scope > .menu-item-wrapper > .accordion-icon"); if (ic) { ic.innerHTML = abierto ? ARRIBA : ABAJO; }
    }
    $$(".second-menu__item, .second-menu__submenu-item", sm).forEach(function (li) {
      var tiene = li.querySelector(":scope > .second-menu__submenu, :scope > .second-menu__submenu-list"); if (!tiene) { return; }
      var a = li.querySelector(":scope > .menu-item-wrapper > a"), ic = li.querySelector(":scope > .menu-item-wrapper > .accordion-icon");
      if (a) { a.addEventListener("click", function (e) { alternar(li, e); }); }
      if (ic) { ic.addEventListener("click", function (e) { e.stopPropagation(); if (window.innerWidth > 900) { return; } alternar(li, e); }); ic.addEventListener("keydown", function (e) { if (e.key === "Enter") { alternar(li, e); } }); }
    });
  }

  /* ---------- búsqueda (sugerencias al escribir; al enviar se abre la página de resultados) ---------- */
  var indice = null;
  function cargarIndice(cb) {
    if (indice) { return cb(indice); }
    fetch(RAIZ + "buscar-indice.json").then(function (r) { return r.json(); }).then(function (d) { indice = d; cb(d); }).catch(function () { indice = []; cb([]); });
  }
  function buscar(txt, d, max) {
    var t = norm(txt).split(" ").filter(Boolean); if (!t.length) { return []; }
    var r = d.filter(function (p) { return t.every(function (w) { return p.k.indexOf(w) > -1; }); });
    r.sort(function (a, b) { var x = norm(a.s) === norm(txt) ? 0 : 1, y = norm(b.s) === norm(txt) ? 0 : 1; return x - y; });
    return max ? r.slice(0, max) : r;
  }
  $$(".search-form").forEach(function (f) {
    var inp = $(".search-input", f), cont = f.parentNode, lista = null, t = null, sel = -1;
    function cerrar() { if (lista) { lista.remove(); lista = null; sel = -1; } }
    inp.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (inp.value.trim().length < 2) { cerrar(); return; }
        cargarIndice(function (d) {
          var r = buscar(inp.value, d, 6); cerrar(); if (!r.length) { return; }
          lista = document.createElement("ul"); lista.className = "search-suggestions";
          lista.innerHTML = r.map(function (p, i) { return '<li class="search-suggestion-item" data-u="' + esc(p.u) + '"><img src="' + esc(p.t) + '" alt="" class="suggestion-image" width="40" height="40"><div class="suggestion-info"><span class="suggestion-name">' + esc(p.n) + "</span>" + (p.s ? '<span class="suggestion-sku">SKU: ' + esc(p.s) + "</span>" : "") + "</div></li>"; }).join("");
          cont.appendChild(lista);
          $$("li", lista).forEach(function (li) { li.addEventListener("mousedown", function () { location.href = li.getAttribute("data-u"); }); });
        });
      }, 150);
    });
    inp.addEventListener("keydown", function (e) {
      if (!lista) { return; } var li = $$("li", lista);
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % li.length; } else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + li.length) % li.length; } else if (e.key === "Escape") { cerrar(); return; } else { return; }
      li.forEach(function (x, i) { x.classList.toggle("selected", i === sel); });
    });
    inp.addEventListener("blur", function () { setTimeout(cerrar, 200); });
    f.addEventListener("submit", function (e) {
      if (lista && sel >= 0) { e.preventDefault(); location.href = $$("li", lista)[sel].getAttribute("data-u"); return; }
      var v = inp.value.trim(); if (!v) { e.preventDefault(); }
    });
  });
  var rb = $("#buscar-resultados");
  if (rb) {
    var qq = new URLSearchParams(location.search).get("q") || "";
    $("#buscar-titulo").textContent = qq ? "Resultados para “" + qq + "”" : "Resultados de búsqueda";
    cargarIndice(function (d) {
      var r = buscar(qq, d);
      rb.innerHTML = r.map(function (p) { return '<div class="product-card"><a class="product-link" href="' + esc(p.u) + '"><img alt="' + esc(p.n) + '" loading="lazy" src="' + esc(p.t) + '" width="400" height="400"><h3>' + esc(p.n) + "</h3></a></div>"; }).join("");
      $("#buscar-vacio").hidden = r.length > 0;
    });
  }

  /* ---------- carrusel de la portada ---------- */
  var hero = $(".hero-container[data-slides]");
  if (hero) {
    var slides = JSON.parse(hero.getAttribute("data-slides")), img = $(".hero-image", hero), enlace = img.parentNode, dots = $$(".dot", hero), i = 0, timer = null;
    function ir(n) {
      i = (n + slides.length) % slides.length; var s = slides[i];
      img.srcset = s.d1 + " 1280w, " + s.d2 + " 2560w"; img.src = s.d1; img.alt = s.alt || ""; img.removeAttribute("fetchpriority"); enlace.setAttribute("href", s.href);
      dots.forEach(function (d, k) { d.classList.toggle("active", k === i); }); auto();
    }
    function auto() { clearInterval(timer); timer = setInterval(function () { ir(i + 1); }, 5000); }
    $(".nav-button.left", hero).addEventListener("click", function () { ir(i - 1); }); $(".nav-button.right", hero).addEventListener("click", function () { ir(i + 1); });
    dots.forEach(function (d, k) { d.addEventListener("click", function () { ir(k); }); d.addEventListener("keydown", function (e) { if (e.key === "Enter") { ir(k); } }); });
    // los demás banners se cargan después de que la página termina de pintarse
    window.addEventListener("load", function () { slides.slice(1).forEach(function (s) { (new Image()).src = s.d1; }); auto(); });
  }

  /* ---------- ficha de producto ---------- */
  var gal = $(".producto-gallery");
  if (gal) {
    var main = $(".main-image", gal), th = $$(".thumbnail", gal), k = 0;
    function mostrar(n) { if (!th.length) { return; } k = (n + th.length) % th.length; main.src = th[k].getAttribute("data-grande"); main.alt = th[k].getAttribute("data-alt") || th[k].alt; th.forEach(function (t, j) { t.classList.toggle("active", j === k); }); }
    th.forEach(function (t, j) { t.addEventListener("click", function () { mostrar(j); }); t.addEventListener("keydown", function (e) { if (e.key === "Enter") { mostrar(j); } }); });
    var pv = $(".nav-button.prev", gal), nx = $(".nav-button.next", gal);
    if (pv) { pv.addEventListener("click", function () { mostrar(k - 1); }); nx.addEventListener("click", function () { mostrar(k + 1); }); }
  }
  $$(".tabs-header button").forEach(function (b) {
    b.addEventListener("click", function () {
      var cont = b.closest(".producto-detalle-tabs"), t = b.getAttribute("data-tab");
      $$(".tabs-header button", cont).forEach(function (x) { var on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      $$("[data-panel]", cont).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== t; });
      $$("iframe[data-src]", cont).forEach(function (f) { if (!f.src || f.src === "about:blank") { f.src = f.getAttribute("data-src"); } });   // la ficha PDF se carga solo al abrir la pestaña
    });
  });

  /* ---------- formulario de contacto ---------- */
  $$("form.formulario, form[data-v3]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = ""; try { u = sessionStorage.getItem("hsm_utm") || ""; } catch (x) {}
      f.elements.utm.value = u; var btn = $("button[type=submit]", f); btn.disabled = true; btn.textContent = "ENVIANDO…";
      fetch(f.action, { method: "POST", body: new FormData(f), headers: { "X-Requested-With": "fetch" } })
        .then(function (r) { return r.json(); })
        .then(function (r) { if (r && r.ok) { location.href = RAIZ + "gracias/"; } else { throw new Error("x"); } })
        .catch(function () {
          // sin servidor de formularios (por ejemplo, en pruebas estáticas): se abre el correo del visitante con el mensaje listo
          var d = new FormData(f), cuerpo = "Nombre: " + d.get("nombre") + "\nCorreo: " + d.get("email") + "\nTeléfono: " + d.get("telefono") + "\nEmpresa: " + d.get("empresa") + "\n\n" + d.get("mensaje");
          location.href = "mailto:" + (O.correo || "contacto@hsm.cl") + "?subject=" + encodeURIComponent("Contacto desde el sitio HSM Chile") + "&body=" + encodeURIComponent(cuerpo);
          btn.disabled = false; btn.textContent = "ENVIAR";
        });
    });
  });
})();

/* HSM Chile V3: cuenta regresiva de la Ley 21.719, autodiagnóstico, asistente de cotización por pasos y armado del mensaje de los formularios. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- cuenta regresiva (vigencia plena: 1 de diciembre de 2026) ---------- */
  var dias = Math.max(0, Math.ceil((new Date(2026, 11, 1) - new Date()) / 86400000));
  $$("[data-v3-dias]").forEach(function (el) { el.textContent = dias; });
  $$("[data-v3-dias-txt]").forEach(function (el) { el.textContent = dias === 0 ? "ya está vigente" : dias === 1 ? "falta 1 día" : "faltan " + dias + " días"; });

  /* ---------- armado del mensaje de los formularios (se ejecuta antes del envío) ---------- */
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f || !f.hasAttribute || !f.hasAttribute("data-v3")) { return; }
    var lineas = [], vistos = {};
    $$("[data-etq]", f).forEach(function (c) {
      var n = c.getAttribute("data-etq"), v = "";
      if (c.type === "radio" || c.type === "checkbox") { if (!c.checked) { return; } v = c.value; if (vistos[n] && c.type === "checkbox") { lineas[vistos[n] - 1] += ", " + v; return; } }
      else { v = (c.value || "").trim(); }
      if (v) { lineas.push(n + ": " + v); vistos[n] = lineas.length; }
    });
    var libre = f.elements.detalle ? (f.elements.detalle.value || "").trim() : "";
    if (libre) { lineas.push("Comentario: " + libre); }
    if (f.elements.mensaje) { f.elements.mensaje.value = (f.getAttribute("data-titulo") || "Solicitud desde el sitio") + "\n" + lineas.join("\n"); }
  }, true);

  /* ---------- autodiagnóstico Ley 21.719 ---------- */
  var diag = $("#v3-diag");
  if (diag) {
    var NIVELES = {
      alto: { cls: "v3-r-alto", t: "Riesgo alto", d: "Hoy hay varios puntos sin resolver. Conviene ordenar primero qué documentos manejas y cómo los eliminas, y dejar un procedimiento escrito con registro." },
      medio: { cls: "v3-r-medio", t: "Riesgo medio", d: "Vas por buen camino, pero quedan brechas que se pueden cerrar con un procedimiento de destrucción controlado y con evidencia." },
      bajo: { cls: "v3-r-bajo", t: "Riesgo bajo", d: "Tu organización está bien encaminada. Revisa que el procedimiento se cumpla siempre y que el equipo de destrucción cubra el nivel de seguridad necesario." }
    };
    var TXT = { p1: "Sabe qué documentos con datos personales maneja", p2: "Política escrita de conservación y eliminación", p3: "Destruye de forma ilegible los documentos que ya no necesita", p4: "Deja registro de cada eliminación", p5: "Destruye de forma segura discos duros y equipos en desuso", p6: "Su equipo sabe qué nivel de seguridad usar" };
    var CONSEJO = { p1: "Haz un inventario simple de los documentos con datos personales (clientes, trabajadores, pacientes).", p2: "Define por escrito cuánto tiempo guardas cada tipo de documento y cuándo se elimina.", p3: "Reemplaza el papelero o el reciclaje por destrucción en origen con una destructora de corte en partículas.", p4: "Anota fecha, responsable y tipo de documento en cada eliminación.", p5: "Incluye los discos duros y soportes digitales en el procedimiento de baja.", p6: "Usa la norma DIN 66399: para datos personales, nivel P-4 o superior." };
    diag.addEventListener("submit", function (e) {
      e.preventDefault();
      var si = 0, faltan = [], sin = [];
      for (var i = 1; i <= 6; i++) {
        var c = diag.querySelector("input[name=p" + i + "]:checked");
        if (!c) { sin.push(i); continue; }
        if (c.value === "si") { si++; } else { faltan.push("p" + i); }
      }
      var out = $("#v3-diag-res");
      if (sin.length) { out.className = "v3-res"; out.innerHTML = "Falta responder la pregunta " + sin.join(", ") + "."; out.hidden = false; return; }
      var nivel = si <= 2 ? "alto" : si <= 4 ? "medio" : "bajo", N = NIVELES[nivel];
      out.className = "v3-res " + N.cls;
      out.innerHTML = '<div class="v3-sem">' + N.t + " · " + si + " de 6 puntos resueltos</div><div class=\"v3-barra\"><i style=\"width:" + Math.round(si / 6 * 100) + '%"></i></div><p>' + N.d + "</p>" +
        (faltan.length ? "<p><strong>Qué te falta resolver:</strong></p><ul class=\"v3-lista\">" + faltan.map(function (k) { return "<li>" + CONSEJO[k] + "</li>"; }).join("") + "</ul>" : "") +
        '<p class="v3-aviso">Es una orientación general, no asesoría legal. Consulta a tu equipo legal o de seguridad de la información.</p><div class="v3-acciones"><a class="v3-btn" href="#v3-asesoria">Pedir asesoría sin costo</a></div>';
      out.hidden = false; out.scrollIntoView({ behavior: "smooth", block: "nearest" });
      var d = $("#v3-diag-msg"); if (d) { d.value = "Autodiagnóstico Ley 21.719: " + N.t + " (" + si + " de 6).\nPuntos por resolver: " + (faltan.map(function (k) { return TXT[k]; }).join("; ") || "ninguno") + "."; }
      var cp = $("#v3-diag-resumen"); if (cp) { cp.value = d ? d.value : ""; }
    });
  }

  /* ---------- asistente de cotización por pasos ---------- */
  var wiz = $("#v3-wiz");
  if (wiz) {
    var pasos = $$(".v3-paso-w", wiz), prog = $$(".v3-prog i", wiz), idx = 0;
    var RECO = {
      "destruir-documentos": function (v) {
        var l = v.volumen || "", s = v.seguridad || "";
        var linea = /Hasta 100/.test(l) ? "Compact o HomeOffice" : /100 a 500/.test(l) ? "OfficePro" : /500 a 2\.000/.test(l) ? "Departamental" : /Más de 2\.000/.test(l) ? "Industrial Powerline" : "una línea según tu volumen";
        var nivel = /personales|financiera|confidencial/i.test(s) ? "corte en partículas (nivel P-4 o superior de la norma DIN 66399)" : "corte en tiras o partículas según tu necesidad";
        return "Por lo que cuentas, te conviene mirar la línea <strong>" + linea + "</strong> con " + nivel + ". Un ejecutivo confirma el modelo exacto.";
      },
      "discos-duros": function () { return "Para discos duros y soportes digitales hay destructoras específicas de la línea Industrial. Un ejecutivo te indica el modelo según el tipo de disco."; },
      "prensas": function (v) { return "Para <strong>" + (v.material || "tu material") + "</strong> hay prensas verticales y horizontales (semiautomáticas y automáticas). Un ejecutivo calcula el modelo según tu volumen."; },
      "profipack": function () { return "La recicladora de cartón ProfiPack convierte el cartón en material de relleno y amortiguación. Un ejecutivo te explica el modelo y el ahorro en embalaje."; },
      "arriendo": function () { return "Arrendamos destructoras y prensas por días, meses o hasta un año, con servicio técnico propio. Un ejecutivo coordina la visita en terreno."; },
      "servicio": function () { return "Nuestro servicio técnico propio atiende mantención, reparación y repuestos de equipos HSM."; }
    };
    var mostrar = function (i) {
      idx = Math.max(0, Math.min(pasos.length - 1, i));
      pasos.forEach(function (p, k) { p.classList.toggle("on", k === idx); });
      prog.forEach(function (b, k) { b.classList.toggle("on", k <= idx); });
      if (idx === pasos.length - 1) { resumen(); }
      window.scrollTo({ top: wiz.getBoundingClientRect().top + window.pageYOffset - 90, behavior: "smooth" });
    };
    var valores = function () {
      var v = {};
      $$("[data-etq]", wiz).forEach(function (c) { if ((c.type === "radio" && !c.checked) || (c.type === "checkbox" && !c.checked)) { return; } var val = (c.value || "").trim(); if (val) { v[c.getAttribute("data-clave") || c.getAttribute("data-etq")] = val; } });
      return v;
    };
    var resumen = function () {
      var v = valores(), k = v.necesidad, key = { "Destruir documentos": "destruir-documentos", "Destruir discos duros": "discos-duros", "Compactar cartón, PET o film": "prensas", "Recicladora de cartón ProfiPack": "profipack", "Arrendar un equipo": "arriendo", "Servicio técnico o repuestos": "servicio" }[k];
      var r = $("#v3-reco"); if (r) { r.innerHTML = key && RECO[key] ? "<strong>Orientación:</strong> " + RECO[key](v) : ""; r.hidden = !r.innerHTML; }
    };
    var valida = function () {
      var p = pasos[idx], ok = true;
      $$("input[type=radio]", p).forEach(function (r) { if (r.required || r.hasAttribute("data-req")) { var n = r.name; if (!p.querySelector("input[name=" + n + "]:checked")) { ok = false; } } });
      if (!ok) { alert("Elige una opción para continuar."); }
      return ok;
    };
    $$("[data-sig]", wiz).forEach(function (b) { b.addEventListener("click", function () { if (valida()) { adaptar(); mostrar(idx + 1); } }); });
    $$("[data-ant]", wiz).forEach(function (b) { b.addEventListener("click", function () { mostrar(idx - 1); }); });
    var adaptar = function () {
      var nec = (wiz.querySelector("input[name=necesidad]:checked") || {}).value || "";
      $$("[data-para]", wiz).forEach(function (g) { g.hidden = g.getAttribute("data-para").split("|").indexOf(nec) < 0; });
    };
    $$("input[name=necesidad]", wiz).forEach(function (r) { r.addEventListener("change", adaptar); });
    var qs = new URLSearchParams(location.search), pre = qs.get("interes");
    var MAPA = { "destruccion-documentos": "Destruir documentos", "discos": "Destruir discos duros", "prensas": "Compactar cartón, PET o film", "profipack": "Recicladora de cartón ProfiPack", "arriendo": "Arrendar un equipo", "servicio": "Servicio técnico o repuestos" };
    if (pre && MAPA[pre]) { var rr = $$("input[name=necesidad]", wiz).filter(function (x) { return x.value === MAPA[pre]; })[0]; if (rr) { rr.checked = true; adaptar(); mostrar(1); } }
    var eq = qs.get("equipo"); if (eq && wiz.elements && wiz.elements.detalle) { wiz.elements.detalle.value = "Equipo de interés: " + eq; }
    adaptar(); if (!(pre && MAPA[pre])) { mostrar(0); }
  }

  /* ---------- enlaces con equipo prellenado hacia el asistente ---------- */
  $$("a[data-prellenar]").forEach(function (a) { a.addEventListener("click", function () { try { sessionStorage.setItem("hsm_prellenar", a.getAttribute("data-prellenar")); } catch (x) {} }); });
})();

/* Asistente de HSM Chile (ventana de chat del sitio). Usa la misma conversación que el bot de WhatsApp: assets/flujo-bot.json (ver herramientas/crear_flujo_bot.py). */
(function () {
  "use strict";
  var B = window.HSM_BOT, O = window.HSM || {}, RAIZ = O.raiz || "/";
  if (!B) { return; }
  var $ = function (s) { return document.getElementById(s); };
  var btnAbrir = $("v3-chat-abrir"), ventana = $("v3-chat"), msgs = $("v3-chat-msgs"), form = $("v3-chat-form"), txt = $("v3-chat-txt");
  if (!btnAbrir || !ventana) { return; }
  var F = null, E = { nodo: "", vars: {}, miss: 0, log: [], derivado: false };
  var BASE = location.origin + RAIZ, CLAVE = "hsm_bot_v3";

  var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.@ ]+/g, " ").replace(/\s+/g, " ").trim(); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var html = function (t) { return esc(t).replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>").replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); };
  var guardar = function () { try { sessionStorage.setItem(CLAVE, JSON.stringify(E)); } catch (x) {} };
  var cargarEstado = function () { try { var d = JSON.parse(sessionStorage.getItem(CLAVE) || "null"); if (d && d.nodo) { E = d; return true; } } catch (x) {} return false; };

  /* ---------- horario de atención (hora de Chile) ---------- */
  function enHorario() {
    try {
      var p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var dia = { Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6", Sun: "7" }[p.weekday], h = F.horario[dia]; if (!h) { return false; }
      var m = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10), a = h[0].split(":"), c = h[1].split(":");
      return m >= parseInt(a[0], 10) * 60 + parseInt(a[1], 10) && m < parseInt(c[0], 10) * 60 + parseInt(c[1], 10);
    } catch (x) { return true; }
  }
  var diasLey = function () { var n = Math.max(0, Math.ceil((new Date(F.vigencia_ley + "T00:00:00") - new Date()) / 86400000)); return n === 0 ? "ya está vigente" : n === 1 ? "falta 1 día" : "faltan " + n + " días"; };

  /* ---------- plantillas ---------- */
  function plantilla(t, v) {
    return String(t).replace(/\{SITIO\}/g, BASE).replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined && v[k] !== "" ? v[k] : (k === "dias_txt" ? diasLey() : ""); });
  }

  /* ---------- mensajes en pantalla ---------- */
  var FB = []; try { FB = JSON.parse(localStorage.getItem("hsm_bot_feedback") || "[]"); } catch (x) {}
  function guardarFb() { try { localStorage.setItem("hsm_bot_feedback", JSON.stringify(FB)); } catch (x) {} var c = $("demo-contador"); if (c) { c.textContent = FB.length; } }
  function ultimoCliente() { for (var i = E.log.length - 1; i >= 0; i--) { if (E.log[i][0] === "yo") { return E.log[i][1]; } } return ""; }
  function voto(texto, pregunta, v, nota) { FB.push({ fecha: new Date().toISOString(), pregunta: pregunta, respuesta_bot: texto, voto: v, deberia_responder: nota || "" }); guardarFb(); }
  function burbuja(rol, t, noGuardar) {
    var d = document.createElement("div"); d.className = "v3-m " + (rol === "bot" ? "bot" : "yo"); d.innerHTML = html(t); msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    if (!noGuardar) { E.log.push([rol, t]); guardar(); }
    if (B.demo && rol === "bot" && !noGuardar) {
      var q = ultimoCliente(), f = document.createElement("div"); f.className = "v3-fb";
      f.innerHTML = '<button type="button" data-v="bien" aria-label="Respuesta buena" title="Respuesta buena">👍</button><button type="button" data-v="mal" aria-label="Respuesta mala" title="Respuesta mala">👎</button>';
      f.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) { return; }
        var nota = ""; if (b.getAttribute("data-v") === "mal") { nota = window.prompt("¿Cómo debió responder el bot? (opcional)", "") || ""; }
        voto(t, q, b.getAttribute("data-v"), nota); f.innerHTML = '<span>' + (b.getAttribute("data-v") === "bien" ? "👍 Gracias" : "👎 Anotado") + "</span>";
      });
      d.appendChild(f);
    }
  }
  function chips(lista) {
    quitarChips(); if (!lista || !lista.length) { return; }
    var c = document.createElement("div"); c.className = "v3-chips"; c.id = "v3-chips";
    lista.forEach(function (o) { var b = document.createElement("button"); b.type = "button"; b.className = "v3-chip"; if (o.href) { b.textContent = o.t; b.addEventListener("click", function () { window.open(o.href, "_blank", "noopener"); }); } else { b.textContent = o.t; b.addEventListener("click", function () { elegir(o); }); } c.appendChild(b); });
    msgs.appendChild(c); msgs.scrollTop = msgs.scrollHeight;
  }
  function quitarChips() { var c = $("v3-chips"); if (c) { c.parentNode.removeChild(c); } }

  /* ---------- motor ---------- */
  function diagnostico() {
    var v = E.vars, pts = 0, falta = [], TX = ["conocer qué documentos con datos personales manejas", "tener una política escrita de conservación y eliminación", "destruir de forma ilegible lo que ya no necesitas", "dejar registro de cada eliminación", "destruir de forma segura discos duros y equipos en desuso", "definir el nivel de seguridad según la información"];
    for (var i = 1; i <= 6; i++) { if (v["d" + i] === "si") { pts++; } else { falta.push(TX[i - 1]); } }
    v.pts = String(pts); v.nivel_diag = pts <= 2 ? "Riesgo alto" : pts <= 4 ? "Riesgo medio" : "Riesgo bajo";
    v.faltan = falta.length ? "\nTe falta resolver: " + falta.join("; ") + ".\n" : "";
  }
  function calculoAhorro() {
    var v = E.vars, r = parseInt(v.retiros || "0", 10), c = parseInt(v.costo_ret || "0", 10), anual = r * 12 * c;
    var f = function (n) { return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
    v.gasto_anual = anual > 0 ? f(anual) : "";
    v.roi_txt = anual > 0 ? "Hoy gastas unos *" + f(anual) + " al año* solo en retiros (" + r + " al mes × " + f(c) + ").\n\nSi una prensa te permitiera reducir los retiros en 30 %, 50 % o 70 % (escenarios *ilustrativos*, no una promesa), ahorrarías unos *" + f(anual * 0.3) + "*, *" + f(anual * 0.5) + "* o *" + f(anual * 0.7) + "* al año, sin contar el posible ingreso por vender el material compactado ni el costo del equipo." : "Con esos datos no puedo estimar un monto, pero un ejecutivo puede calcularlo contigo.";
  }
  function resumenLead() {
    var v = E.vars, ocultas = { estado_horario: 1, dias_txt: 1, __pedirTel: 1, nombre: 1, empresa: 1, email: 1, tel: 1, url: 1, pts: 1, nivel_diag: 1, faltan: 1, motivo: 1, roi_txt: 1, d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, d6: 1 };
    var l = ["Solicitud desde el asistente del sitio", "Motivo: " + plantilla(v.motivo || "Consulta general", v)];
    Object.keys(v).forEach(function (k) { if (!ocultas[k] && v[k]) { l.push(k + ": " + v[k]); } });
    if (v.pts) { l.push("Autodiagnóstico Ley 21.719: " + v.nivel_diag + " (" + v.pts + " de 6)"); }
    return l.join("\n");
  }
  function derivar() {
    if (E.derivado === E.vars.motivo + "|" + E.vars.nombre) { return; }
    E.derivado = E.vars.motivo + "|" + E.vars.nombre;
    if (B.demo) { setTimeout(function () { burbuja("bot", "🧪 Simulación: aquí se registraría la solicitud en el administrador y se avisaría al ejecutivo correspondiente.\n\n" + resumenLead()); }, 900); return; }
    var d = new FormData(), v = E.vars, u = ""; try { u = sessionStorage.getItem("hsm_utm") || ""; } catch (x) {}
    d.append("nombre", v.nombre || ""); d.append("email", v.email || ""); d.append("telefono", v.tel || ""); d.append("empresa", v.empresa || ""); d.append("mensaje", resumenLead()); d.append("origen", "asistente-web"); d.append("web", ""); d.append("utm", u);
    var fallo = function () {
      var cuerpo = "Nombre: " + (v.nombre || "") + "\nEmpresa: " + (v.empresa || "") + "\nCorreo: " + (v.email || "") + "\nTeléfono: " + (v.tel || "") + "\n\n" + resumenLead();
      burbuja("bot", "No pude enviar la solicitud desde aquí. Para no perderla, usa este correo ya redactado: mailto:" + (O.correo || "contacto@hsm.cl") + "?subject=" + encodeURIComponent("Solicitud desde el asistente de HSM") + "&body=" + encodeURIComponent(cuerpo) + "\n(o llama al (02) 2396 4723)");
    };
    fetch(RAIZ + "api/contacto.php", { method: "POST", body: d, headers: { "X-Requested-With": "fetch" } }).then(function (r) { return r.json(); }).then(function (r) { if (!r || !r.ok) { fallo(); } }).catch(fallo);
  }
  function mostrarNodo(id) {
    var n = F.nodos[id]; if (!n) { id = F.inicio; n = F.nodos[id]; }
    if (n.pide && n.si_falta && E.vars[n.si_falta]) { return mostrarNodo(n.sig); }
    E.nodo = id; E.miss = 0;
    if (n.accion === "diag") { diagnostico(); }
    var v = E.vars; v.estado_horario = enHorario() ? F.en_horario : F.fuera_horario.replace("{h}", F.horario_txt);
    if (n.accion === "roi") { calculoAhorro(); }
    if (n.accion === "derivar") { derivar(); }
    var ops = (n.op || []).map(function (o) { return { t: o[0], a: o[1], s: o[2] || {} }; });
    if (n.accion === "derivar" && B.wsp) { ops.unshift({ t: "Seguir por WhatsApp", href: "https://wa.me/" + B.wsp + "?text=" + encodeURIComponent(resumenLead()) }); }
    setTimeout(function () { burbuja("bot", plantilla(n.t, v)); chips(ops); }, 350);
    guardar();
  }
  function elegir(o) {
    quitarChips(); burbuja("yo", o.t);
    Object.keys(o.s || {}).forEach(function (k) { E.vars[k] = plantilla(o.s[k], E.vars); });
    mostrarNodo(o.a);
  }
  function irA(id, set) { Object.keys(set || {}).forEach(function (k) { E.vars[k] = plantilla(set[k], E.vars); }); mostrarNodo(id); }
  function tiene(t, lista, corto) {
    return lista.some(function (p) { p = norm(p); if (!p) { return false; } return new RegExp("(^| )" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)").test(t); });
  }
  function texto(libre) {
    quitarChips(); burbuja("yo", libre);
    var t = norm(libre), n = F.nodos[E.nodo] || {};
    if (n.pide) {
      if (tiene(t, F.comandos.menu, true) && t.length <= 12) { return mostrarNodo(F.inicio); }
      var val = libre.trim(), v = E.vars;
      if (/^omitir$/i.test(norm(val)) && n.omitir && !(n.pide === "tel" && !v.email)) { if (n.pide === "email" && !v.tel) { burbuja("bot", "Necesito al menos un dato de contacto: déjame tu correo o, si prefieres, tu teléfono."); E.vars.__pedirTel = 1; return mostrarNodo("der_tel"); } val = ""; }
      else if (/^omitir$/i.test(norm(val)) && n.pide === "tel" && !v.email) { return setTimeout(function () { burbuja("bot", "Necesito al menos un dato para contactarte: escribe tu teléfono con código (ej.: +56 9 1234 5678)."); }, 250); }
      else if (n.val === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { return setTimeout(function () { burbuja("bot", "Ese correo no parece válido. Escríbelo de nuevo (ej.: nombre@empresa.cl)" + (n.omitir ? " o escribe «omitir»." : ".")); }, 250); }
      else if (n.val === "num" && !/^\s*\$?\s*(\d{1,3}(\.\d{3})+|\d+)\s*$/.test(val)) { return setTimeout(function () { burbuja("bot", "Necesito solo un número, por ejemplo: 4 o 80000."); }, 250); }
      else if (n.val === "tel" && (val.replace(/\D/g, "").length < 8 || val.replace(/\D/g, "").length > 15)) { return setTimeout(function () { burbuja("bot", "Ese teléfono no parece válido. Escríbelo con código (ej.: +56 9 1234 5678)" + (n.omitir ? " o escribe «omitir»." : ".")); }, 250); }
      if (n.val === "num") { val = val.replace(/[^\d]/g, ""); } E.vars[n.pide] = val.slice(0, 200); return mostrarNodo(n.sig);
    }
    var ops = n.op || [], k = parseInt(t, 10);
    if (k >= 1 && k <= ops.length && /^\d+$/.test(t)) { return irA(ops[k - 1][1], ops[k - 1][2]); }
    for (var i = 0; i < ops.length; i++) { var l = norm(ops[i][0]); if (l && (t === l || (t.length > 3 && l.indexOf(t) === 0))) { return irA(ops[i][1], ops[i][2]); } }
    if (/^(si|sí|yes|claro|dale|ok)$/.test(t) && ops.length === 2 && norm(ops[0][0]) === "si") { return irA(ops[0][1], ops[0][2]); }
    if (/^no$/.test(t) && ops.length === 2 && norm(ops[1][0]) === "no") { return irA(ops[1][1], ops[1][2]); }
    if (tiene(t, F.comandos.ejecutivo)) { return irA("derivar", { motivo: E.vars.motivo || "Consulta general" }); }
    if (t.length <= 30 && tiene(t, F.comandos.fin) && !tiene(t, F.comandos.menu)) { return mostrarNodo("fin"); }
    if (t.length <= 30 && tiene(t, F.comandos.menu)) { return mostrarNodo(/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hi|hello)( .*)?$/.test(t) && F.bienvenida ? F.bienvenida : F.inicio); }
    for (var j = 0; j < F.intenciones.length; j++) { if (tiene(t, F.intenciones[j].p)) { return irA(F.intenciones[j].va, F.intenciones[j].set); } }
    E.miss++; if (E.miss >= 2) { E.miss = 0; return mostrarNodo("no_entiendo"); }
    setTimeout(function () { burbuja("bot", "No te entendí del todo. Elige una de las opciones o escribe «menú» para volver al inicio."); chips(ops.map(function (o) { return { t: o[0], a: o[1], s: o[2] || {} }; })); }, 300);
  }

  /* ---------- abrir, cerrar y enviar ---------- */
  function iniciar() {
    if (F) { return; }
    fetch(B.flujo).then(function (r) { return r.json(); }).then(function (d) {
      F = d;
      if (cargarEstado() && E.log.length) { E.log.forEach(function (m) { burbuja(m[0], m[1], true); }); var n = F.nodos[E.nodo]; if (n && n.op) { chips(n.op.map(function (o) { return { t: o[0], a: o[1], s: o[2] || {} }; })); } }
      else { mostrarNodo(F.bienvenida || F.inicio); }
    }).catch(function () { burbuja("bot", "No pude cargar el asistente. Llámanos al (02) 2396 4723 o escribe a contacto@hsm.cl.", true); });
  }
  function abrir() { ventana.classList.add("on"); btnAbrir.style.display = "none"; iniciar(); setTimeout(function () { txt.focus(); }, 50); }
  function cerrar() { ventana.classList.remove("on"); btnAbrir.style.display = ""; }
  btnAbrir.addEventListener("click", abrir); $("v3-chat-cerrar").addEventListener("click", cerrar);
  form.addEventListener("submit", function (e) { e.preventDefault(); var t = txt.value.trim(); if (!t || !F) { return; } txt.value = ""; texto(t); });
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("[data-abrir-bot]"); if (a) { e.preventDefault(); abrir(); } });
  if (location.hash === "#asistente") { abrir(); }
  if (B.demo) {
    window.HSM_BOT_DEMO = {
      abrir: abrir,
      total: function () { return FB.length; },
      reiniciar: function () { try { sessionStorage.removeItem(CLAVE); } catch (x) {} location.reload(); },
      exportar: function (quien) {
        var conv = E.log.map(function (m) { return (m[0] === "yo" ? "CLIENTE: " : "BOT: ") + m[1]; }).join("\n");
        return { probador: quien || "", fecha: new Date().toISOString(), version: B.version || "", comentarios: FB, conversacion: conv };
      },
      texto: function (quien) {
        var x = this.exportar(quien), l = ["PRUEBAS DEL BOT DE HSM", "Probador: " + (quien || "(sin nombre)"), "Versión: " + (x.version || ""), "Fecha: " + x.fecha, "", "COMENTARIOS (" + x.comentarios.length + "):"];
        x.comentarios.forEach(function (c, i) { l.push((i + 1) + ". [" + (c.voto === "bien" ? "BIEN" : "MAL") + "] Pregunta: " + c.pregunta + "\n   Bot: " + String(c.respuesta_bot).replace(/\n/g, " ").slice(0, 300) + (c.deberia_responder ? "\n   Debió responder: " + c.deberia_responder : "")); });
        l.push("", "CONVERSACIÓN:", x.conversacion); return l.join("\n");
      }
    };
    guardarFb();
  }
})();
