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
