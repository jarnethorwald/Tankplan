(function () {
  'use strict';
  var T = window.TP, CFG = window.TP_CONFIG || {}, KEY = 'tankplan.v2';
  var FOODS = T.parseFoods(window.FOODS_RAW);
  var esc = T.esc, de = T.de, r0 = T.r0;

  function blank() {
    return { profile: { w: 72, h: 178, a: 34, sex: 'm', goal: 'keep', mt: {}, lvls: {}, lib: [], sets: [] }, profileU: 0, plan: [], acts: [], meals: [], custom: [], del: [],
      cfg: { iid: '0', ikey: '', token: '', ilast: 0, istat: '' }, auth: null, last: 0 };
  }
  function fixProfile(p) {
    if (!p.mt) p.mt = {}; if (!p.lvls) p.lvls = {}; if (!Array.isArray(p.lib)) p.lib = []; if (!Array.isArray(p.sets)) p.sets = [];
    var rm = p.restMacros;
    if (rm && !p.macroPct) {
      var k = 4 * +rm.c + 4 * +rm.p + 9 * +rm.f;
      if (k > 0) p.macroPct = { p: Math.round(400 * +rm.p / k), f: Math.round(900 * +rm.f / k) };
    }
    delete p.restMacros; delete p.restMacroPal;
    return p;
  }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.profile) { var b = blank(); s.cfg = Object.assign(b.cfg, s.cfg || {}); s = Object.assign(b, s); fixProfile(s.profile); return s; }
    } catch (e) {}
    return blank();
  }
  var S = loadState();
  var view = 'heute', cur = T.today(), sel = null, selG = 100, ctx = null;
  var q = '', planText = '', planDesc = '', planTitle = '', planUpd = false, xFrom = T.addDays(T.today(), -6), xTo = T.today(), planDay = T.addDays(T.today(), 1), planTime = '', range = 30;
  var lastToday = T.today(), banner = '', busy = false, syncTimer = null, eanMsg = '', isyncBusy = false;
  var barcode = { active: false, busy: false, msg: '' }, barcodeScanner = null, barcodeStartPromise = null, barcodeScriptPromise = null;
  var KIND_ORDER = ['frueh', 'mittag', 'abend', 'snack', 'pre', 'during', 'post'];

  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function save() { persist(); schedSync(); }
  function model() { return { profile: S.profile, plan: S.plan, acts: S.acts, meals: S.meals, today: T.today() }; }
  function nowHM() { return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
  function flash(msg) {
    banner = msg; render(); clearTimeout(flash.t);
    flash.t = setTimeout(function () { banner = ''; var el = document.querySelector('.alert.flash'); if (el) el.remove(); }, 6000);
  }

  /* ---------- Supabase (REST, ohne Bibliothek) ---------- */
  var SB = {
    ready: function () { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); },
    url: function () { return CFG.SUPABASE_URL.replace(/\/$/, ''); },
    auth: function (path, body) {
      return fetch(SB.url() + '/auth/v1/' + path, { method: 'POST', headers: { apikey: CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Anmeldung fehlgeschlagen'); return j; }); });
    },
    setSession: function (j) {
      if (!j.access_token) return false;
      S.auth = { access: j.access_token, refresh: j.refresh_token, exp: Math.floor(Date.now() / 1000) + (j.expires_in || 3600), uid: j.user && j.user.id, mail: j.user && j.user.email };
      persist(); return true;
    },
    token: function () {
      if (!S.auth) return Promise.reject(new Error('Nicht angemeldet'));
      if (Date.now() / 1000 < S.auth.exp - 60) return Promise.resolve(S.auth.access);
      return SB.auth('token?grant_type=refresh_token', { refresh_token: S.auth.refresh }).then(function (j) { SB.setSession(j); return S.auth.access; });
    },
    rest: function (path, opts) {
      return SB.token().then(function (tk) {
        opts = opts || {};
        return fetch(SB.url() + '/rest/v1/' + path, { method: opts.method || 'GET', body: opts.body, headers: Object.assign({ apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, opts.headers || {}) })
          .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 200)); }); return r; });
      });
    }
  };
  var COLS = {
    meals: ['id', 'day', 't', 'name', 'g', 'kcal', 'c', 'p', 'f', 'fi', 'grp', 'col', 'vit', 'slot'],
    plan: ['id', 'day', 'title', 'type', 'min', 'lv', 'tm', 'tss', 'kj', 'descr'],
    acts: ['id', 'ext', 'day', 'type', 'name', 'min', 'kcal', 'load', 'lv', 'net', 'tm']
  };
  function pick(o, cols) { var x = {}; cols.forEach(function (c) { x[c] = o[c] === undefined ? null : o[c]; }); return x; }

  function syncNow() {
    if (!SB.ready() || !S.auth || busy || !navigator.onLine) return Promise.resolve(false);
    busy = true;
    var start = Date.now(), since = S.last, chain = Promise.resolve();
    function post(tbl, rows, conflict) {
      if (!rows.length) return;
      chain = chain.then(function () {
        var send = function (r) { return SB.rest(tbl + '?on_conflict=' + conflict, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(r) }); };
        return send(rows).catch(function (e) {
          if (tbl !== 'plan' || !/tss|kj|descr|column/i.test(e.message)) throw e;
          return send(rows.map(function (r) { var o = Object.assign({}, r); delete o.tss; delete o.kj; delete o.descr; return o; }));
        });
      });
    }
    Object.keys(COLS).forEach(function (tbl) {
      post(tbl, S[tbl].filter(function (r) { return (r.u || 0) > since; }).map(function (r) { return pick(r, COLS[tbl]); }), 'user_id,id');
    });
    post('custom', S.custom.filter(function (r) { return (r.u || 0) > since; }).map(function (r) { return { id: r.id, data: r }; }), 'user_id,id');
    if ((S.profileU || 0) > since) post('profile', [{ data: S.profile }], 'user_id');
    if (S.cfg.token && (S.cfg.tokenU || 0) > since) post('shares', [{ token: S.cfg.token }], 'user_id');
    var dels = S.del.slice();
    ['meals', 'plan', 'acts', 'custom'].forEach(function (tbl) {
      var ids = dels.filter(function (d) { return d.t === tbl; }).map(function (d) { return d.id; });
      if (ids.length) chain = chain.then(function () { return SB.rest(tbl + '?id=in.(' + ids.join(',') + ')', { method: 'DELETE' }); });
    });
    return chain.then(function () {
      S.last = start; S.del = S.del.filter(function (d) { return dels.indexOf(d) < 0; }); persist(); busy = false; return true;
    }).catch(function (e) { busy = false; throw e; });
  }
  function schedSync() {
    if (!SB.ready() || !S.auth) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncNow().catch(function () {}); }, 2500);
  }
  function pullAll() {
    var tasks = Object.keys(COLS).map(function (tbl) {
      return SB.rest(tbl + '?select=*&limit=5000').then(function (r) { return r.json(); }).then(function (rows) {
        var have = {}; S[tbl].forEach(function (x) { have[x.id] = 1; });
        rows.forEach(function (x) { if (!have[x.id]) { delete x.user_id; x.u = Date.now(); S[tbl].push(x); } });
      });
    });
    tasks.push(SB.rest('custom?select=*').then(function (r) { return r.json(); }).then(function (rows) {
      var have = {}; S.custom.forEach(function (x) { have[x.id] = 1; });
      rows.forEach(function (x) { if (!have[x.id] && x.data) { x.data.id = x.id; S.custom.push(x.data); } });
    }));
    tasks.push(SB.rest('profile?select=data').then(function (r) { return r.json(); }).then(function (rows) { if (rows[0] && rows[0].data && !S.profileU) { S.profile = fixProfile(rows[0].data); } }));
    return Promise.all(tasks).then(function () { persist(); });
  }

  /* ---------- intervals.icu ---------- */
  function syncIntervals(days) {
    var id = (S.cfg.iid || '0').trim() || '0', key = (S.cfg.ikey || '').trim();
    if (!key) return Promise.reject(new Error('Bitte zuerst den API-Schlüssel im Profil eintragen.'));
    var oldest = T.addDays(T.today(), -(days || 30)), newest = T.addDays(T.today(), 1);
    var url = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(id) + '/activities?oldest=' + oldest + '&newest=' + newest;
    return fetch(url, { headers: { Authorization: 'Basic ' + btoa('API_KEY:' + key) } })
      .then(function (r) { if (!r.ok) throw new Error('intervals.icu antwortet mit ' + r.status + (r.status === 401 || r.status === 403 ? ' (Schlüssel oder Athleten-ID falsch)' : '')); return r.json(); })
      .catch(function (e) {
        if (/antwortet mit 40[13]/.test(e.message)) throw e;
        if (!SB.ready()) throw new Error('Abruf nicht möglich (' + e.message + '). Ohne Supabase-Weiterleitung kann der Browser intervals.icu eventuell nicht direkt erreichen.');
        return fetch(SB.url() + '/functions/v1/intervals', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY }, body: JSON.stringify({ athlete: id, key: key, oldest: oldest, newest: newest }) })
          .then(function (r) { if (!r.ok) throw new Error('Der direkte Abruf vom Handy wurde vom Browser blockiert (' + e.message + '). Die Ersatz-Weiterleitung über Supabase antwortet mit ' + r.status + (r.status === 404 ? ': Die Funktion „intervals“ ist in Supabase nicht eingerichtet.' : '.')); return r.json(); });
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Unerwartete Antwort von intervals.icu');
        var n = 0, byId = {}, strava = 0, shortOnes = 0, other = 0; S.acts.forEach(function (a) { byId[a.id] = a; });
        data.forEach(function (a) {
          if (a && !a.start_date_local && /strava/i.test(JSON.stringify(a))) { strava++; return; }
          if (!a || !a.start_date_local || !a.moving_time) { other++; return; }
          if (a.moving_time < 600) { shortOnes++; return; }
          var min = r0(a.moving_time / 60), type = T.mapType(a.type);
          var kcal = null, net = false;
          if (type === 'Rad' && a.icu_joules > 0) { kcal = a.icu_joules / 1000; net = true; }
          else if (a.calories) kcal = a.calories;
          else if (a.icu_joules) { kcal = a.icu_joules / 1000; net = true; }
          var tm = String(a.start_date_local).length >= 16 ? String(a.start_date_local).slice(11, 16) : null;
          var o = { id: 'ic_' + a.id, ext: String(a.id), day: String(a.start_date_local).slice(0, 10), type: type, name: a.name || type, min: min, tm: tm,
            kcal: kcal ? r0(kcal) : null, load: a.icu_training_load || null, lv: T.lvFromLoad(a.icu_training_load, min), net: net, u: Date.now() };
          var old = byId[o.id];
          if (old) { var same = ['day', 'type', 'name', 'min', 'kcal', 'load', 'lv', 'tm'].every(function (k) { return old[k] === o[k]; }); if (same) return; Object.assign(old, o); } else { S.acts.push(o); }
          n++;
        });
        S.cfg.ilast = Date.now(); S.cfg.istat = 'Aktualisiert um ' + nowHM() + ' Uhr, ' + data.length + ' Einheiten gefunden' +
          (strava ? ', davon ' + strava + ' von Strava (Strava erlaubt keinen Abruf, bitte Garmin oder Gerät direkt mit intervals.icu verbinden)' : '') + (shortOnes ? ', ' + shortOnes + ' unter 10 Minuten übersprungen' : '') + (other ? ', ' + other + ' ohne Daten übersprungen' : ''); save();
        return n;
      });
  }
  function isyncNow(manual) {
    if (isyncBusy) { if (manual) render(); return; }
    isyncBusy = true; if (manual) { S.cfg.istat = 'Lade…'; render(); }
    syncIntervals(manual ? 30 : 14).then(function (n) {
      isyncBusy = false;
      if (manual || n) flash(n ? n + ' Workout' + (n === 1 ? '' : 's') + ' neu oder geändert.' : 'Keine neuen Workouts.'); else render();
    }).catch(function (e) { isyncBusy = false; S.cfg.istat = 'Fehler: ' + e.message; persist(); if (manual) flash(e.message); else render(); });
  }

  /* ---------- Open Food Facts ---------- */
  function lookupEan(ean) {
    ean = String(ean).replace(/\D/g, '');
    if (ean.length < 8) return Promise.reject(new Error('Der erkannte Strichcode ist ungültig. Bitte erneut scannen.'));
    return fetch('https://world.openfoodfacts.org/api/v2/product/' + ean + '.json?fields=product_name,brands,nutriments,serving_quantity')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status !== 1 || !j.product) throw new Error('Produkt nicht gefunden.');
        var p = j.product, n = p.nutriments || {};
        var k = n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : (n.energy_100g ? +n.energy_100g / 4.184 : 0);
        var f = { id: uid(), n: (p.product_name || 'Produkt') + (p.brands ? ' (' + String(p.brands).split(',')[0] + ')' : ''), k: k, c: +n.carbohydrates_100g || 0, p: +n.proteins_100g || 0, f: +n.fat_100g || 0, fi: +n.fiber_100g || 0, gr: '', co: '', v: '', pn: 'Portion', pg: +p.serving_quantity || 100, u: Date.now() };
        S.custom.push(f); save();
        return f;
      });
  }

  /* ---------- Barcode-Scanner ---------- */
  function loadBarcodeLibrary() {
    if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode);
    if (barcodeScriptPromise) return barcodeScriptPromise;
    barcodeScriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = function () {
        if (window.Html5Qrcode) resolve(window.Html5Qrcode);
        else {
          barcodeScriptPromise = null;
          reject(new Error('Der Barcode-Scanner konnte nicht gestartet werden.'));
        }
      };
      script.onerror = function () {
        barcodeScriptPromise = null;
        reject(new Error('Die Scanner-Bibliothek konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.'));
      };
      document.head.appendChild(script);
    });
    return barcodeScriptPromise;
  }
  function stopBarcodeScanner() {
    var scanner = barcodeScanner, pending = barcodeStartPromise;
    if (!scanner) return Promise.resolve();
    return Promise.resolve(pending).catch(function () {}).then(function () {
      barcodeStartPromise = null;
      if (scanner.isScanning) return scanner.stop();
    }).catch(function () {}).then(function () {
      try { scanner.clear(); } catch (e) {}
      if (barcodeScanner === scanner) barcodeScanner = null;
    });
  }
  function handleBarcode(code) {
    if (!barcode.active || barcode.busy) return;
    barcode.active = false; barcode.busy = true; barcode.msg = 'Strichcode erkannt. Produkt wird gesucht …';
    stopBarcodeScanner().then(function () {
      render();
      return lookupEan(code);
    }).then(function (f) {
      barcode.busy = false; barcode.msg = ''; eanMsg = ''; sel = f; selG = f.pg; render();
      var card = document.getElementById('selcard'); if (card) card.scrollIntoView({ block: 'center' });
    }).catch(function (e) {
      barcode.busy = false; barcode.msg = ''; eanMsg = e.message || 'Produkt konnte nicht gefunden werden.'; render();
    });
  }
  function startBarcodeScanner() {
    eanMsg = '';
    barcode = { active: true, busy: true, msg: 'Kamera wird geöffnet …' };
    render();
    loadBarcodeLibrary().then(function () {
      if (!barcode.active) return;
      var reader = document.getElementById('barcode-reader');
      if (!reader) throw new Error('Scannerbereich nicht gefunden. Bitte erneut starten.');
      var formats = [window.Html5QrcodeSupportedFormats.EAN_13, window.Html5QrcodeSupportedFormats.EAN_8,
        window.Html5QrcodeSupportedFormats.UPC_A, window.Html5QrcodeSupportedFormats.UPC_E];
      barcodeScanner = new window.Html5Qrcode('barcode-reader', { formatsToSupport: formats });
      barcodeStartPromise = barcodeScanner.start({ facingMode: 'environment' }, {
        fps: 10,
        qrbox: function (width) {
          var boxWidth = Math.min(360, Math.max(160, width - 24));
          return { width: boxWidth, height: Math.min(135, Math.max(80, Math.round(boxWidth * 0.36))) };
        },
        aspectRatio: 1.7778
      }, handleBarcode, function () {});
      return barcodeStartPromise.then(function () {
        barcodeStartPromise = null;
        if (!barcode.active) return stopBarcodeScanner();
        barcode.busy = false; barcode.msg = 'Halte den Strichcode ruhig in den Rahmen.';
        var status = document.getElementById('barcodemsg'); if (status) status.textContent = barcode.msg;
      });
    }).catch(function (e) {
      return stopBarcodeScanner().then(function () {
        barcode.active = false; barcode.busy = false; barcode.msg = '';
        eanMsg = e && e.name === 'NotAllowedError' ? 'Bitte erlaube den Kamerazugriff in deinem Browser und starte den Scanner erneut.' : (e.message || 'Kamera konnte nicht gestartet werden. Öffne Tankplan über HTTPS und erlaube den Kamerazugriff.');
        render();
      });
    });
  }

  /* ---------- Hilfen ---------- */
  function allFoods() { return S.custom.concat(FOODS); }
  function recents() {
    var seen = {}, out = [];
    for (var i = S.meals.length - 1; i >= 0 && out.length < 8; i--) {
      var m = S.meals[i]; if (seen[m.name]) continue; seen[m.name] = 1;
      var f = allFoods().filter(function (x) { return x.n === m.name; })[0];
      if (f) out.push(f);
    }
    return out;
  }
  function macroRow(label, c, t, color) {
    var pct = Math.min(100, t ? c / t * 100 : 0);
    return '<div class="macro"><div class="mrow"><b>' + label + '</b><span>' + r0(c) + ' / ' + t + ' g</span></div><div class="bar" role="img" aria-label="' + label + ' ' + r0(c) + ' von ' + t + ' Gramm"><i style="--c:' + color + ';width:' + pct + '%"></i></div></div>';
  }
  function dayNav() {
    var lbl = cur === T.today() ? 'Heute, ' + T.dayLabel(cur) : T.dayLabelLong(cur);
    return '<div class="top"><div><div class="brand">Tankplan</div><div class="date">' + esc(lbl) + '</div></div><div class="daynav"><button data-a="day" data-d="-1" aria-label="Vortag">‹</button><button data-a="day" data-d="0" aria-label="Heute">•</button><button data-a="day" data-d="1" aria-label="Folgetag">›</button></div></div>';
  }
  function bannerHtml() { return banner ? '<div class="alert flash" role="status">' + esc(banner) + '</div>' : ''; }
  function kindOptions(selected) {
    return KIND_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(T.KINDS[k]) + '</option>'; }).join('');
  }
  var MEAL_TIME_KEYS = { frueh: 'b', mittag: 'l', abend: 'd', snack: 's' };
  function usualMealTime(kind) {
    var key = MEAL_TIME_KEYS[kind];
    return key ? (S.profile.mt[key] || T.DEF_MT[key]) : '';
  }
  function dayTrs() { var r = T.analyze(model(), cur, cur)[0]; return T.trainWin(r.t); }
  function defaultTime() { return cur === T.today() ? nowHM() : '12:00'; }
  /* Uhrzeit für eine Mahlzeit: bestehende Mahlzeit dieser Art an diesem Tag, sonst jetzt (heute) oder die übliche Zeit */
  function mealTimeFor(kind, exceptIds) {
    var same = S.meals.filter(function (m) { return m.day === cur && m.slot === kind && m.t && (!exceptIds || exceptIds.indexOf(m.id) < 0); });
    if (same.length) { same.sort(function (a, b) { return a.t < b.t ? 1 : -1; }); return same[0].t; }
    return cur === T.today() ? nowHM() : (usualMealTime(kind) || '12:00');
  }
  function ctxInit(force) {
    if (force || !ctx || ctx.day !== cur) {
      var currentTime = defaultTime(), kind = T.guessKind(T.tmin(currentTime), dayTrs());
      ctx = { day: cur, kind: kind, time: mealTimeFor(kind), manual: false };
    }
  }
  function ctxTime() { if (!ctx.manual) ctx.time = mealTimeFor(ctx.kind); return ctx.time; }
  function curLvl() { return (S.profile.lvls || {})[cur] || 3; }

  /* ---------- Ansichten ---------- */
  function slotHtml(ms, nowMin) {
    var s = ms.s, it = ms.items, ec = 0, ep = 0, ef = 0;
    it.forEach(function (m) { ec += m.c; ep += m.p; ef += m.f; });
    var pill;
    if (it.length && s.c > 0) { var qv = ec / s.c; pill = '<span class="pill ' + (qv >= 0.8 ? 'ok' : qv >= 0.4 ? 'mid' : 'low') + '"><i></i>' + r0(qv * 100) + ' %</span>'; }
    else if (it.length) pill = '<span class="pill ok"><i></i>erledigt</span>';
    else pill = '<span class="pill"><i></i>' + (nowMin !== null && s.at + 90 < nowMin ? 'verpasst' : 'offen') + '</span>';
    var macros = s.kind === 'during' ? r0(s.c) + ' g Carbs' : r0(s.c) + ' C · ' + r0(s.p) + ' P · ' + r0(s.f) + ' F';
    var vf = [];
    if (s.veg >= 20) vf.push('Gemüse ca. ' + (Math.round(s.veg / 10) * 10) + ' g');
    if (s.fruit >= 20) vf.push('Obst ca. ' + (Math.round(s.fruit / 10) * 10) + ' g');
    var pc = it.length ? [ec, ep, ef] : [s.c, s.p, s.f];
    var h = '<article class="card slot"><div class="slot-top"><span class="clock">' + esc(s.time) + '</span><div class="slot-main"><div class="slot-title">' + esc(s.label) + '</div>' +
      '<div class="slot-sub">' + macros + (vf.length ? ' · ' + vf.join(' · ') : '') + '</div>' + (s.rel ? '<div class="slot-sub">' + esc(s.rel) + (s.assumed ? ' (Uhrzeit angenommen)' : '') + '</div>' : '') + '<div style="margin-top:6px">' + pill + '</div></div>' +
      '<div class="pie-box">' + T.pieSvg(pc[0], pc[1], pc[2], 48) + '<div class="pie-cap">' + (it.length ? 'Ist' : 'Plan') + '<br>' + esc(T.pieCaption(pc[0], pc[1], pc[2])) + '</div></div></div>' +
      '<p class="note">' + esc(s.focus) + '</p>';
    if (it.length) {
      h += '<div class="items">' + it.map(function (m) { return '<div class="item"><span>' + esc(m.t || '') + ' ' + esc(m.name) + '</span><span>' + r0(m.c) + ' C</span></div>'; }).join('') + '</div>';
    }
    h += '<button class="btn ghost sm" data-a="logslot" data-k="' + s.kind + '" data-tm="' + esc(s.time) + '">' + (it.length ? 'Mehr eintragen' : 'Eintragen') + '</button></article>';
    return h;
  }

  function lvlCard() {
    var n = curLvl(), bmr = T.bmr(S.profile), difference = r0(bmr * (T.PAL[4] - T.PAL[1]));
    var h = '<section class="card lvl"><div class="eyebrow">Alltagsaktivität am ' + esc(T.dayLabel(cur)) + ', ohne Training</div><div class="seg5" role="group" aria-label="Alltagsaktivität">';
    [1, 2, 3, 4, 5].forEach(function (i) { h += '<button data-a="lvl" data-n="' + i + '" aria-pressed="' + (n === i) + '"><b>' + i + '</b><span>' + esc(T.LVL_NAME[i]) + '</span></button>'; });
    return h + '</div><p class="note"><b>' + n + ' · ' + esc(T.LVL_NAME[n]) + ':</b> ' + esc(T.LVL_DESC[n]) + '</p><p class="note lvl-difference">Für dein Profil: Stufe 1 → 4 = ca. <b>+' + difference + ' kcal pro Tag</b> in der Alltagsbasis (PAL 1,20 → 1,48). Im Profil kannst du Ruhetag-Makros festlegen; Trainingsaufschläge berechnet Tankplan automatisch.</p></section>';
  }
  function syncStatus() {
    if (!S.cfg.ikey) return '';
    return '<div class="status"><span>intervals.icu: ' + esc(S.cfg.istat || 'noch nicht abgerufen') + '</span><button class="btn ghost sm" data-a="isyncnow"' + (isyncBusy ? ' disabled' : '') + '>Aktualisieren</button></div>';
  }

  function viewHeute() {
    var m = model(), rows = T.analyze(m, cur, T.addDays(cur, 1)), r = rows[0], t = r.t, st = r.st, nx = rows[1];
    var rem = t.c - r0(st.c), a = T.ampel(st), isToday = cur === T.today();
    var nowMin = isToday ? T.nowMinutes() : null;
    var h = dayNav() + bannerHtml() + syncStatus() + lvlCard();
    h += '<section class="card hero" aria-label="Carb-Ziel"><div class="eyebrow">' + esc(t.dayType) + ' · ' + String(t.gkg).replace('.', ',') + ' g/kg</div><div class="big">' + t.c + '<small>g Carbs</small></div>' +
      '<div class="sub">' + (rem >= 0 ? 'Noch ' + rem + ' g offen' : 'Ziel um ' + (-rem) + ' g überschritten') + '</div>' +
      '<div class="meta"><span>Ziel <b>' + t.kcal + ' kcal</b></span><span>Alltag <b>' + t.base + '</b></span><span>Training <b>' + t.trainKcal + '</b></span><span>Gegessen <b>' + r0(st.k) + '</b></span></div></section>';
    if (t.note) h += '<div class="alert">' + esc(t.note) + '</div>';
    var fibNeed = Math.max(30, r0(14 * t.kcal / 1000));
    h += '<section class="card">' + macroRow('Kohlenhydrate', st.c, t.c, 'var(--carb)') + macroRow('Eiweiß', st.p, t.p, 'var(--prot)') + macroRow('Fett', st.f, t.f, 'var(--fat)') + macroRow('Ballaststoffe', st.fi, fibNeed, 'var(--accent)') +
      '<p class="note" style="margin:6px 0 0">Ballaststoffe: ' + r0(st.fi) + ' g gegessen, Richtwert ' + fibNeed + ' g (mindestens 30 g, bei hohem Kalorienziel 14 g je 1000 kcal). ' + (st.fi >= fibNeed ? 'Erreicht.' : 'Noch ' + (fibNeed - r0(st.fi)) + ' g offen.') + ' Vor und während harten Einheiten lieber wenig Ballaststoffe, dafür mehr über den Tag verteilt.</p></section>';
    var pk = function (c, p, f) { var k = 4 * c + 4 * p + 9 * f; return k > 0 ? [r0(4 * c / k * 100), r0(4 * p / k * 100), r0(9 * f / k * 100)] : [0, 0, 0]; };
    var pl = pk(t.c, t.p, t.f), pa = pk(st.c, st.p, st.f);
    h += '<section class="card"><div class="eyebrow" style="margin-bottom:8px">Makroverteilung · Soll &amp; Ist</div><div class="pies">' +
      [['Soll', t.c, t.p, t.f, pl, t.kcal], ['Ist', st.c, st.p, st.f, pa, r0(st.k)]].map(function (x) {
        var has = x[1] + x[2] + x[3] > 0;
        return '<div class="pie2"><div class="pie2-h">' + x[0] + '</div>' + T.pieSvg(x[1], x[2], x[3], 110) +
          (has ? '<ul class="pie2-l"><li><i class="lc"></i>Carbs ' + r0(x[1]) + ' g · ' + x[4][0] + ' %</li><li><i class="lp"></i>Eiweiß ' + r0(x[2]) + ' g · ' + x[4][1] + ' %</li><li><i class="lf"></i>Fett ' + r0(x[3]) + ' g · ' + x[4][2] + ' %</li><li class="pie2-k">' + r0(x[5]) + ' kcal</li></ul>' : '<p class="note">Noch nichts gegessen.</p>') + '</div>';
      }).join('') + '</div><p class="note" style="margin:8px 0 0">Anteile an den Kalorien: Carbs und Eiweiß 4 kcal je g, Fett 9 kcal je g.</p></section>';
    if (t.pct) h += '<p class="note">Makroverteilung: ' + t.pct.c + ' % Carbs · ' + t.pct.p + ' % Eiweiß · ' + t.pct.f + ' % Fett der Kalorien.</p>';
    h += '<section class="card"><div class="eyebrow" style="margin-bottom:6px">Essens-Timing · Soll &amp; Gegessen</div>' + T.dayChartHtml(r) + '</section>';
    if (cur <= T.today()) h += '<section class="card"><div class="eyebrow" style="margin-bottom:6px">Tagesauswertung</div>' + T.reviewHtml(T.dayReview(r, nowMin)) + '</section>';

    h += '<div class="sec-head"><h2>Training</h2><span class="note">' + (t.info.length ? t.trainCarbs + ' g Carbs rund ums Training' : 'Keine Einheit') + '</span></div>';
    if (!t.info.length) h += '<div class="card empty">Keine Einheit an diesem Tag. Im Reiter „Plan“ trägst du kommende Workouts mit Uhrzeit ein, die Einheiten aus intervals.icu kommen von selbst.</div>';
    t.info.forEach(function (x) {
      var s = x.s, done = s.src === 'act';
      h += '<article class="card sess"><div class="sess-top"><div><div class="sess-title">' + esc(s.title || s.type) + '<span class="tag ' + (done ? 'done' : '') + '">' + (done ? 'absolviert' : 'geplant') + '</span></div>' +
        '<div class="sess-sub">' + (s.tm ? esc(s.tm) + ' Uhr · ' : '') + esc(s.type) + ' · ' + T.INT[s.lv] + ' · ' + s.min + ' min · ca. ' + r0(x.kcal) + ' kcal' + (x.tss ? ' · ' + r0(x.tss) + ' TSS' : '') + (done ? '' : ' (' + x.basis + ')') + '</div></div>' +
        (!done && s.id ? '<button class="x" data-a="delplan" data-id="' + s.id + '" aria-label="Einheit löschen">×</button>' : '') + '</div></article>';
    });

    h += '<div class="sec-head"><h2>Mahlzeitenplan</h2><span class="note">' + r.mp.length + ' Punkte</span></div>' + T.pieLegend();
    if (r.mp.some(function (s) { return s.assumed; })) h += '<p class="note" style="margin:0">Für Einheiten ohne Uhrzeit nehme ich 17:00 an. Trage die Uhrzeit im Plan ein, dann passt sich alles an.</p>';
    r.match.slots.forEach(function (ms) { h += slotHtml(ms, nowMin); });
    if (r.match.extra.length) {
      h += '<section class="card"><div class="eyebrow">Zusätzlich gegessen</div>' + r.match.extra.map(function (e) { return '<div class="item"><span>' + esc(e.t || '') + ' ' + esc(e.name) + '</span><span>' + r0(e.c) + ' C</span></div>'; }).join('') + '</section>';
    }

    var cols = Object.keys(st.cols);
    h += '<section class="card"><div class="eyebrow" style="margin-bottom:10px">Gemüse, Obst und Vitamine</div>' + macroRow('Gemüse', st.veg, T.GOALS.veg, 'var(--prot)') + macroRow('Obst', st.fruit, T.GOALS.fruit, 'var(--fat)') +
      '<div class="ampel">' + Object.keys(T.VITN).map(function (k) { return '<span class="pill ' + a.vit[k].lv + '"><i></i>' + esc(T.VITN[k]) + '</span>'; }).join('') + '</div>' +
      '<div class="dots">' + (cols.length ? cols.map(function (c) { return '<i class="c-' + c + '" title="' + T.COLN[c] + '"></i>'; }).join('') : '') + '<span>' + cols.length + ' von 6 Farben</span></div>' +
      '<p class="note">Einschätzung aus dem Logbuch: Grün heißt, dass reichlich Lebensmittel mit diesem Vitamin gegessen wurden. Kein Messwert.</p></section>';

    if (nx && nx.sess.length) {
      h += '<section class="card"><div class="eyebrow">Morgen</div><p style="margin:6px 0 0"><b>' + esc(nx.sess.map(function (s) { return (s.tm ? s.tm + ' ' : '') + (s.title || s.type); }).join(', ')) + '</b></p>' +
        '<p class="note">' + esc(nx.t.dayType) + ', Ziel ' + nx.t.c + ' g Carbs' + (nx.t.gkg >= 8 ? '. Heute Abend ausreichend Carbs essen.' : '.') + '</p></section>';
    }
    h += '<p class="note">Richtwerte für Ausdauersport nach gängigen Sporternährungs-Empfehlungen, keine medizinische Beratung.</p>';
    return h;
  }

  function libFind(title) {
    var t = String(title || '').trim().toLowerCase(); if (!t) return null;
    return (S.profile.lib || []).filter(function (x) { return x.title.trim().toLowerCase() === t; })[0] || null;
  }
  function effDesc() { var l = libFind(planTitle); return planDesc.trim() || (l ? l.descr : ''); }
  function libSave(title, descr, type, update) {
    var l = libFind(title);
    if (l) { if (!update) return false; l.descr = descr; l.type = type || l.type; l.u = Date.now(); }
    else S.profile.lib.push({ id: uid(), title: title.trim(), descr: descr, type: type || 'Rad', u: Date.now() });
    S.profileU = Date.now(); return true;
  }
  function libOptions() {
    return '<option value="">Vorlage aus Bibliothek wählen …</option>' + S.profile.lib.slice().sort(function (a, b) { return a.title.localeCompare(b.title, 'de'); }).map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (libFind(planTitle) && libFind(planTitle).id === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>';
    }).join('');
  }
  function descSummary(d) {
    if (!d) return '';
    var z = d.zmin.map(function (m, i) { return m >= 0.5 ? 'Z' + (i + 1) + ' ' + r0(m) + ' min' : ''; }).filter(Boolean).join(', ');
    return 'Beschreibung erkannt: ' + d.steps + ' Abschnitte, ' + r0(d.min) + ' min, ' + r0(d.kj) + ' kJ (≈ ' + r0(d.kj) + ' kcal), Ø ' + r0(d.avg) + ' W, NP ' + r0(d.np) + ' W' +
      (d.hasFtp ? ', IF ' + d.ifactor.toFixed(2) + ', ' + r0(d.tss) + ' TSS' + (z ? '. Zonen: ' + z : '') : '. Mit FTP im Profil kommen IF, TSS und Zonen dazu.') + (d.warn.length ? ' (' + d.warn.join('; ') + ')' : '');
  }
  function planPreview() {
    var lines = planText.split('\n').map(function (l) { return T.parseLine(l, planDay); }).filter(Boolean);
    var ed = effDesc(), dsc = ed ? T.parseWorkoutText(ed, S.profile) : null, lb = libFind(planTitle);
    var dhtml = ed ? ((lb && !planDesc.trim() ? 'Vorlage „' + esc(lb.title) + '“ gefunden. ' : '') + (planTitle.trim() && !lb && planDesc.trim() ? 'Neuer Titel, wird in der Bibliothek gespeichert. ' : '') + (lb && planDesc.trim() && planDesc.trim() !== lb.descr.trim() && !planUpd ? 'Die Beschreibung weicht von der Vorlage ab und wird nicht überschrieben (Haken „Vorlage aktualisieren“ setzen, oder neuen Titel wählen). ' : '') + (dsc ? esc(descSummary(dsc)) + (lines.length ? '<br>' : '') : 'In der Beschreibung habe ich keine Abschnitte mit Watt-Angabe gefunden (erwartet: „10 min @ 150-180 W“).' + (lines.length ? '<br>' : ''))) : '';
    if (!lines.length && dhtml) return dhtml + '<br>Wird eingetragen für ' + esc(T.dayLabel(planDay)) + (planTime ? ', ' + esc(planTime) + ' Uhr' : ', ohne Uhrzeit') + '.';
    if (!lines.length) return 'Pro Zeile: Sportart und Dauer; optional TSS und kJ, z. B. „Morgen 17:30 Rad Intervalle 75 min 90 TSS 650 kJ“. TSS steuert die Intensität; kJ prognostiziert den Energieverbrauch (Faustregel: 1 kJ ≈ 1 kcal).';
    return dhtml + lines.map(function (x) {
      if (x.rest) return esc(T.dayLabel(x.day)) + ': Ruhetag';
      var tssIntensity = x.tss ? T.intensityFromTss(x.tss, x.min) : null;
      var details = tssIntensity ? ', ' + x.tss + ' TSS · IF ' + tssIntensity.factor.toFixed(2) + ' · ' + T.INT[tssIntensity.lv] : ', ' + T.INT[x.lv];
      if (x.kj) details += ' · ' + x.kj + ' kJ ≈ ' + r0(x.kj) + ' kcal';
      return esc(T.dayLabel(x.day)) + ': ' + ((x.tm || planTime) ? esc(x.tm || planTime) + ' Uhr, ' : 'keine Uhrzeit, ') + x.type + ', ' + x.min + ' min' + details;
    }).join('<br>');
  }
  function viewPlan() {
    var m = model(), tdy = T.today(), rows = T.analyze(m, tdy, T.addDays(tdy, 9));
    var h = '<div class="top"><div><div class="brand">Plan</div><div class="date">Kommende Workouts</div></div></div>' + bannerHtml();
    h += '<form class="card form" id="planform"><div class="full eyebrow">Workouts eintragen</div>' +
      '<label class="f" for="plandate">Datum, wenn nichts in der Zeile steht<input id="plandate" type="date" value="' + planDay + '"></label>' +
      '<label class="f" for="plantime">Uhrzeit, wenn nichts in der Zeile steht<input id="plantime" type="time" value="' + esc(planTime) + '"></label>' +
      '<label class="f full" for="planlib">Einheit aus Bibliothek<select id="planlib">' + libOptions() + '</select></label>' +
      '<label class="f full" for="plantitle">Titel der Einheit<input id="plantitle" type="text" maxlength="80" autocomplete="off" placeholder="z. B. LIT 2h oder 30/30" value="' + esc(planTitle) + '"></label>' +
      '<label class="f full" for="plantext">Tag, Uhrzeit, Dauer (eine Zeile pro Einheit)<textarea id="plantext" rows="2" placeholder="morgen 17:30 120 min&#10;Sa 9 Uhr 90 min&#10;(ohne Titel: Rad Intervalle 75 min 90 TSS 650 kJ)">' + esc(planText) + '</textarea></label>' +
      '<label class="f full" for="plandesc">TP-Beschreibung (Schritte aus TrainingPeaks). Bei gewählter Vorlage vorausgefüllt und änderbar, zum Beispiel „Repeat 8 times“ auf 10<textarea id="plandesc" placeholder="Warm up 15 min @ 150-180 W&#10;Repeat 8 times&#10;Hard 30 sec @ 360-435 W&#10;Easy 30 sec @ 150-180 W&#10;Cool Down 7 min @ 120-180 W">' + esc(planDesc) + '</textarea></label>' +
      '<label class="chk full"><input type="checkbox" id="planupd"' + (planUpd ? ' checked' : '') + '> Vorlage mit dieser Beschreibung aktualisieren</label>' +
      '<div class="full note" id="planprev">' + planPreview() + '</div><button class="btn full" type="submit">Hinzufügen</button></form>';
    if (S.profile.lib.length) {
      h += '<details class="card"><summary><b>Bibliothek (' + S.profile.lib.length + ')</b></summary>' + S.profile.lib.slice().sort(function (a, b) { return a.title.localeCompare(b.title, 'de'); }).map(function (x) {
        var pd = T.parseWorkoutText(x.descr, S.profile);
        return '<div class="item"><span>' + esc(x.title) + (pd ? ' · ' + r0(pd.min) + ' min · ' + r0(pd.kj) + ' kJ' : '') + '</span><span><button class="chip" data-a="libload" data-id="' + esc(x.id) + '">Laden</button> <button class="x" data-a="libdel" data-id="' + esc(x.id) + '" aria-label="Vorlage löschen">×</button></span></div>';
      }).join('') + '</details>';
    }
    h += '<section class="card"><div class="eyebrow" style="margin-bottom:4px">Nächste 10 Tage</div>';
    rows.forEach(function (r) {
      h += '<div class="planday"><div class="h"><div>' + esc(T.dayLabel(r.day)) + '</div><span>' + r.t.c + ' g Carbs · ' + esc(r.t.dayType) + '</span></div>';
      if (!r.sess.length) h += '<div class="note">Keine Einheit</div>';
      r.sess.forEach(function (s) {
        var si = T.sessInfo(s, m.profile), ti = s.tss ? T.intensityFromTss(s.tss, s.min) : null;
        var summary = s.min + ' min · ' + T.INT[si.lv] + (si.tss ? ' · ' + r0(si.tss) + ' TSS' : '') + (si.ifactor ? ' · IF ' + si.ifactor.toFixed(2) : '') + ' · ca. ' + r0(si.kcal) + ' kcal (' + si.basis + ')';
        var displayTitle = (s.title || s.type).replace(/\b\d+(?:[.,]\d+)?\s*(?:min|minuten|h|std|stunden?)\b/ig, ' ').replace(/\s{2,}/g, ' ').trim() || s.type;
        h += '<div class="plan-workout"><div class="plan-workout-head"><span class="plan-workout-name">' + (s.tm ? esc(s.tm) + ' · ' : '') + esc(displayTitle) + '<span class="tag ' + (s.src === 'act' ? 'done' : '') + '">' + (s.src === 'act' ? 'absolviert' : 'geplant') + '</span></span>' +
          (s.src === 'plan' ? '<button class="x" data-a="delplan" data-id="' + esc(s.id) + '" aria-label="Löschen">×</button>' : '') + '<span class="plan-workout-summary">' + summary + '</span></div>';
        if (s.src === 'plan') h += '<div class="plan-metrics"><label class="plan-metric">Geplante TSS<input type="number" inputmode="decimal" min="1" max="1000" step="1" data-plan-id="' + esc(s.id) + '" data-plan-metric="tss" aria-label="Geplante TSS für ' + esc(displayTitle) + '" placeholder="TSS" value="' + (s.tss ? esc(s.tss) : '') + '"></label><label class="plan-metric">Geplante kJ<input type="number" inputmode="decimal" min="1" max="10000" step="1" data-plan-id="' + esc(s.id) + '" data-plan-metric="kj" aria-label="Geplante kJ für ' + esc(displayTitle) + '" placeholder="kJ" value="' + (s.kj ? esc(s.kj) : '') + '"></label><span class="plan-metric-hint">Änderung direkt gespeichert · 1 kJ ≈ 1 kcal</span></div>';
        if (s.src === 'plan') h += '<details class="plan-desc"><summary>TP-Beschreibung' + (s.desc ? ' (hinterlegt)' : ' hinzufügen') + '</summary><textarea data-plan-id="' + esc(s.id) + '" data-plan-metric="desc" rows="5" aria-label="TP-Beschreibung" placeholder="Beschreibung aus TrainingPeaks einfügen">' + esc(s.desc || '') + '</textarea>' + (si.desc ? '<div class="note">' + esc(descSummary(si.desc)) + '</div>' : '') + '</details>';
        h += '</div>';
      });
      h += '</div>';
    });
    return h + '</section>';
  }

  function setsHtml() {
    var sets = S.profile.sets || [], t = q.trim().toLowerCase();
    var list = sets.filter(function (x) { return !t || x.title.toLowerCase().indexOf(t) >= 0; });
    if (!list.length) return '';
    return '<div class="eyebrow" style="margin:10px 0 4px">Gespeicherte Mahlzeiten</div><div class="res">' + list.map(function (x) {
      var k = 0, c = 0; x.items.forEach(function (i) { k += i.kcal; c += i.c; });
      return '<button data-a="addset" data-id="' + esc(x.id) + '">' + esc(x.title) + '<span>' + r0(k) + ' kcal · ' + r0(c) + ' C · ' + x.items.length + ' Zutaten</span></button>';
    }).join('') + '</div>';
  }
  function resultsHtml() {
    var list = q.trim() ? T.searchFoods(allFoods(), q, 25) : recents();
    var sh = setsHtml();
    if (!list.length) return sh + (q.trim() ? (sh ? '' : '<div class="empty">Nichts gefunden. Du kannst das Lebensmittel unten selbst anlegen oder den Strichcode scannen.</div>') : '');
    var head = q.trim() ? (sh ? '<div class="eyebrow" style="margin:10px 0 4px">Lebensmittel</div>' : '') : '<div class="eyebrow" style="margin:10px 0 4px">Zuletzt gegessen</div>';
    return sh + head + '<div class="res">' + list.map(function (f) {
      return '<button data-a="pick" data-n="' + esc(f.n) + '">' + esc(f.n) + '<span>' + r0(f.k) + ' kcal · ' + de(f.c, 1) + ' C</span></button>';
    }).join('') + '</div>';
  }
  function selPreview() {
    if (!sel) return '';
    var m = T.mealFrom(sel, selG || 0, cur);
    return '= ' + r0(m.kcal) + ' kcal · ' + de(m.c, 1) + ' g Carbs · ' + de(m.p, 1) + ' g Eiweiß · ' + de(m.f, 1) + ' g Fett';
  }
  function barcodeCard() {
    var h = '<section class="card barcode-card"><div class="sec-head"><div><div class="eyebrow">Produkt hinzufügen</div><h2>Strichcode scannen</h2></div><span class="barcode-type">EAN / UPC</span></div>';
    h += '<p class="note">Richte die Kamera auf den Barcode. Tankplan sucht das Produkt und übernimmt die Nährwerte aus Open Food Facts.</p>';
    if (barcode.active) {
      h += '<div class="scanner-shell"><div id="barcode-reader" aria-label="Kameravorschau für den Strichcode"></div></div>' +
        '<p class="note scanner-status" id="barcodemsg" role="status">' + esc(barcode.msg || 'Kamera wird geöffnet …') + '</p>' +
        '<button class="btn ghost" data-a="barcodeStop">Scanner schließen</button>';
    } else if (barcode.busy) {
      h += '<p class="note scanner-status" role="status">' + esc(barcode.msg || 'Produkt wird gesucht …') + '</p>';
    } else {
      h += '<button class="btn barcode-start" data-a="barcodeStart">Barcode mit Kamera scannen</button>' +
        '<p class="note">Benötigt Internet und Kamerazugriff. Auf Netlify funktioniert die Kamera über HTTPS.</p>';
    }
    if (eanMsg) h += '<p class="note scanner-error" role="status">' + esc(eanMsg) + '</p>';
    return h + '</section>';
  }

  function viewLog() {
    ctxInit(false);
    var r = T.analyze(model(), cur, cur)[0];
    var h = dayNav() + bannerHtml();
    h += '<section class="card"><div class="eyebrow" style="margin-bottom:8px">1. Welche Mahlzeit?</div><div class="chips" role="group" aria-label="Mahlzeit">' +
      KIND_ORDER.map(function (k) { return '<button class="chip' + (ctx.kind === k ? ' on' : '') + '" data-a="ctxkind" data-k="' + k + '" aria-pressed="' + (ctx.kind === k) + '">' + esc(T.KINDS[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="form" style="margin-top:12px"><label class="f" for="ctime">2. Uhrzeit<input id="ctime" type="time" value="' + esc(ctx.time) + '"></label>' +
      '<div class="note" style="align-self:end;padding-bottom:10px">' + (ctx.manual ? 'Du hast die Uhrzeit selbst gesetzt.' : 'Automatisch: die Uhrzeit der Mahlzeit, falls schon etwas eingetragen ist, sonst die aktuelle. Bei Bedarf ändern.') + '</div></div></section>';
    h += '<section class="card"><label class="f" for="q">3. Was hast du gegessen?<input id="q" type="search" placeholder="z. B. Haferflocken" value="' + esc(q) + '" autocomplete="off"></label><div id="res">' + resultsHtml() + '</div></section>';
    if (sel) {
      h += '<section class="card sel" id="selcard"><b>' + esc(sel.n) + '</b><div class="note">' + r0(sel.k) + ' kcal · ' + de(sel.c, 1) + ' C · ' + de(sel.p, 1) + ' P · ' + de(sel.f, 1) + ' F je 100 g</div>' +
        '<div class="form" style="margin-top:10px"><label class="f" for="g">Menge in g<input id="g" type="number" inputmode="decimal" min="1" value="' + selG + '"></label>' +
        '<div class="chips" style="align-self:end"><button class="chip" data-a="portion" data-m="0.5">½ ' + esc(sel.pn) + '</button><button class="chip" data-a="portion" data-m="1">1 ' + esc(sel.pn) + ' (' + sel.pg + ' g)</button><button class="chip" data-a="portion" data-m="2">2×</button></div></div>' +
        '<div class="note" id="selprev">' + selPreview() + '</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-a="addmeal">Zu ' + esc(T.KINDS[ctx.kind]) + ' hinzufügen</button><button class="btn ghost" data-a="cancelsel">Abbrechen</button></div></section>';
    }
    if ((S.profile.sets || []).length) h += '<details class="card"><summary><b>Gespeicherte Mahlzeiten verwalten</b></summary>' + S.profile.sets.map(function (x) { return '<div class="item"><span>' + esc(x.title) + ' · ' + x.items.map(function (i) { return esc(i.name) + ' ' + r0(i.g) + ' g'; }).join(', ') + '</span><button class="x" data-a="delset" data-id="' + esc(x.id) + '" aria-label="Mahlzeit löschen">×</button></div>'; }).join('') + '</details>';
    h += barcodeCard();
    h += '<details class="card"><summary><b>Eigenes Lebensmittel anlegen</b></summary><form class="form" id="customform" style="margin-top:12px">' +
      '<label class="f full" for="c-n">Name<input id="c-n" type="text" required maxlength="60"></label>' +
      '<label class="f" for="c-k">kcal je 100 g<input id="c-k" type="number" inputmode="decimal" min="0" value="0"></label><label class="f" for="c-c">Carbs je 100 g<input id="c-c" type="number" inputmode="decimal" min="0" value="0"></label>' +
      '<label class="f" for="c-p">Eiweiß je 100 g<input id="c-p" type="number" inputmode="decimal" min="0" value="0"></label><label class="f" for="c-f">Fett je 100 g<input id="c-f" type="number" inputmode="decimal" min="0" value="0"></label>' +
      '<label class="f full" for="c-g">Zählt als<select id="c-g"><option value="">Sonstiges</option><option value="G">Gemüse</option><option value="O">Obst</option></select></label>' +
      '<button class="btn full" type="submit">Speichern und auswählen</button></form></details>';

    h += '<div class="sec-head"><h2>Gegessen am ' + esc(T.dayLabel(cur)) + '</h2><span class="note">' + r0(r.st.c) + ' von ' + r.t.c + ' g Carbs</span></div>' + (r.groups.length ? T.pieLegend() : '');
    if (!r.groups.length) h += '<div class="card empty">Noch nichts eingetragen.</div>';
    r.groups.forEach(function (g) {
      var ids = g.items.map(function (x) { return x.id; }).join(','), rl = T.relLabel(g.time, r.sess);
      h += '<article class="card grp"><div class="slot-top"><div class="slot-main"><div class="slot-title">' + esc(T.KINDS[g.kind] || g.kind) + '</div><div class="slot-sub">' + r0(g.c) + ' C · ' + r0(g.p) + ' P · ' + r0(g.f) + ' F · ' + r0(g.kcal) + ' kcal</div>' + (rl ? '<div class="slot-sub">' + esc(rl) + '</div>' : '') + '</div>' +
        '<div class="pie-box">' + T.pieSvg(g.c, g.p, g.f, 48) + '<div class="pie-cap">' + esc(T.pieCaption(g.c, g.p, g.f)) + '</div></div></div>' +
        '<div class="d2"><input type="time" class="etime" data-mids="' + ids + '" value="' + esc(g.time) + '" aria-label="Uhrzeit der Mahlzeit"><select class="ekind" data-mids="' + ids + '" aria-label="Mahlzeit">' + kindOptions(g.kind) + '</select></div>' +
        '<div class="d2"><button class="chip" data-a="saveset" data-ids="' + ids + '">Als Mahlzeit speichern</button></div><div class="items">' + g.items.map(function (m) { return '<div class="item ed"><span class="iname">' + esc(m.name) + '</span><span class="ictl"><input class="eg" type="number" inputmode="decimal" min="1" max="5000" step="1" data-mgram="' + m.id + '" value="' + r0(m.g) + '" aria-label="Menge in Gramm für ' + esc(m.name) + '"> g · <select class="ekind mv" data-mid1="' + m.id + '" aria-label="Zu anderer Mahlzeit verschieben">' + kindOptions(g.kind) + '</select></span><span>' + r0(m.c) + ' C <button class="x" data-a="delmeal" data-id="' + m.id + '" aria-label="Eintrag löschen">×</button></span></div>'; }).join('') + '</div></article>';
    });
    return h;
  }

  function viewAus() {
    var to = T.today(), from = T.addDays(to, -(range - 1)), rows = T.analyze(model(), from, to);
    var h = '<div class="top"><div><div class="brand">Auswertung</div><div class="date">Letzte ' + range + ' Tage</div></div></div>' + bannerHtml();
    h += '<div class="seg" role="group" aria-label="Zeitraum">' + [7, 30, 90].map(function (n) { return '<button data-a="range" data-n="' + n + '" aria-pressed="' + (range === n) + '">' + n + ' Tage</button>'; }).join('') + '</div>';
    h += T.reportHtml(rows);
    var xdays = Math.round((T.parseDay(xTo) - T.parseDay(xFrom)) / 86400000) + 1;
    h += '<section class="card form"><div class="full eyebrow">Export für KI-Analyse</div>' +
      '<p class="note full" style="margin:0">Erstellt eine Datei mit allen Daten des Zeitraums (Training, jede Mahlzeit mit Uhrzeit, Menge und Nährwerten, Ziele, Regelauswertung) und einem fertigen Auftrag für die KI. Du lädst die Datei in eine KI deiner Wahl hoch oder kopierst den Text hinein.</p>' +
      '<div class="full chips" role="group" aria-label="Zeitraum">' + [[7, 'Letzte 7 Tage'], [14, '14 Tage'], [30, '30 Tage'], [90, '90 Tage']].map(function (x) { return '<button type="button" class="chip" data-a="xpreset" data-n="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<label class="f" for="xfrom">Von<input id="xfrom" type="date" max="' + T.today() + '" value="' + xFrom + '"></label>' +
      '<label class="f" for="xto">Bis<input id="xto" type="date" max="' + T.today() + '" value="' + xTo + '"></label>' +
      '<p class="note full" style="margin:0">' + (xdays > 0 ? xdays + ' Tag' + (xdays === 1 ? '' : 'e') + ' ausgewählt.' : 'Das Enddatum muss nach dem Startdatum liegen.') + '</p>' +
      '<button type="button" class="btn full" data-a="xshare">Datei teilen oder speichern</button>' +
      '<button type="button" class="btn ghost full" data-a="xcopy">Text kopieren</button></section>';
    h += '<button class="btn ghost" data-a="csv">Tabelle als CSV teilen</button>';
    return h;
  }

  function viewProfil() {
    var p = S.profile, hasSb = SB.ready(), link = S.cfg.token ? new URL('trainer.html?t=' + S.cfg.token, location.href).href : '';
    var mt = Object.assign({}, T.DEF_MT, p.mt || {});
    var autoProfile = Object.assign({}, p); delete autoProfile.macroPct;
    var autoRest = T.target(autoProfile, [], [], (p.lvls || {})[T.today()]);
    var pctNow = T.macroPct(p) || { p: r0(400 * autoRest.p / autoRest.kcal), f: r0(900 * autoRest.f / autoRest.kcal) };
    pctNow.c = 100 - pctNow.p - pctNow.f;
    var h = '<div class="top"><div><div class="brand">Profil</div><div class="date">Grundumsatz ca. ' + r0(T.bmr(p)) + ' kcal</div></div></div>' + bannerHtml();
    h += '<form class="card form" id="profform" onsubmit="return false">' +
      '<label class="f" for="p-w">Gewicht (kg)<input id="p-w" type="number" inputmode="decimal" min="35" max="200" value="' + p.w + '"></label>' +
      '<label class="f" for="p-h">Größe (cm)<input id="p-h" type="number" inputmode="numeric" min="120" max="230" value="' + p.h + '"></label>' +
      '<label class="f" for="p-a">Alter<input id="p-a" type="number" inputmode="numeric" min="14" max="90" value="' + p.a + '"></label>' +
      '<label class="f" for="p-sex">Geschlecht<select id="p-sex"><option value="m"' + (p.sex === 'm' ? ' selected' : '') + '>Männlich</option><option value="f"' + (p.sex === 'f' ? ' selected' : '') + '>Weiblich</option></select></label>' +
      '<div class="full"><div class="eyebrow" style="margin-bottom:6px">Ziel</div><div class="seg" role="group" aria-label="Ziel">' +
      [['lose', 'Abnehmen'], ['keep', 'Halten'], ['gain', 'Aufbauen']].map(function (g) { return '<button type="button" data-a="goal" data-g="' + g[0] + '" aria-pressed="' + (p.goal === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div></div></form>';

    var up = T.zonesOf(p), ftpv = Number(p.ftp) > 0 ? Number(p.ftp) : 0;
    h += '<section class="card form"><div class="full eyebrow">Leistung und Trainingszonen</div>' +
      '<label class="f full" for="p-ftp">FTP (Watt)<input id="p-ftp" type="number" inputmode="numeric" min="50" max="600" placeholder="z. B. 280" value="' + (ftpv || '') + '"></label>' +
      '<div class="full zones">' + T.ZONE_NAMES.map(function (nm, i) {
        var lo = i ? up[i - 1] + 1 : 0;
        return '<div class="zone-row"><span class="zone-name">' + esc(nm) + '</span><span class="zone-range">' + lo + ' bis </span><input class="zone-in" id="p-z' + i + '" type="number" inputmode="numeric" min="1" max="300" value="' + up[i] + '" aria-label="Obergrenze ' + esc(nm) + ' in Prozent der FTP"><span class="zone-range"> % · ' + (ftpv ? r0(lo * ftpv / 100) + ' bis ' + r0(up[i] * ftpv / 100) + ' W' : 'Watt erscheinen mit FTP') + '</span></div>';
      }).join('') + '</div>' +
      '<p class="note full" style="margin:0">Die Zonen sind Prozent deiner FTP. Damit weiß Tankplan, was LIT (Z2), MIT (Z3) oder VO2max (Z5) für dich in Watt heißt. Mit FTP rechnet die App aus TSS die Leistung zurück (Rad), ohne TP-Beschreibung. Mit eingefügter Beschreibung wird der Verbrauch aus den Watt-Angaben berechnet. Eingegebene kJ haben immer Vorrang.</p>' +
      (Array.isArray(p.zones) ? '<button type="button" class="btn ghost full" data-a="resetzones">Standard-Zonen wiederherstellen</button>' : '') + '</section>';

    h += '<section class="card form"><div class="full eyebrow">Übliche Essenszeiten</div>' +
      '<label class="f" for="p-mb">Frühstück<input id="p-mb" type="time" value="' + esc(mt.b) + '"></label><label class="f" for="p-ml">Mittagessen<input id="p-ml" type="time" value="' + esc(mt.l) + '"></label>' +
      '<label class="f" for="p-md">Abendessen<input id="p-md" type="time" value="' + esc(mt.d) + '"></label><label class="f" for="p-ms">Snack<input id="p-ms" type="time" value="' + esc(mt.s) + '"></label>' +
      '<p class="note full" style="margin:0">Der Mahlzeitenplan baut darauf auf und verschiebt Mahlzeiten rund um dein Training.</p></section>';

    h += '<section class="card form"><div class="full eyebrow">Makros in Prozent der Kalorien</div>' +
      '<label class="f" for="p-pct-p">Eiweiß (% der kcal)<input id="p-pct-p" type="number" inputmode="decimal" min="5" max="45" step="1" value="' + pctNow.p + '"></label>' +
      '<label class="f" for="p-pct-f">Fett (% der kcal)<input id="p-pct-f" type="number" inputmode="decimal" min="10" max="55" step="1" value="' + pctNow.f + '"></label>' +
      '<div class="full note" style="margin:0">Kohlenhydrate: <b>' + pctNow.c + ' %</b> (der Rest). Die Prozente gelten für jeden Tag, bezogen auf dein Kalorienziel. An Trainingstagen steigt das Ziel durch das Training, und damit steigen alle drei Makros mit.' + (p.macroPct ? '' : ' Aktuell sind die automatischen Werte aktiv. Sobald du ein Feld änderst, gelten deine Prozente.') + '</div>' +
      (p.macroPct ? '<button type="button" class="btn ghost full" data-a="resetmacros">Automatische Verteilung wiederherstellen</button>' : '') + '</section>';

    h += '<section class="card form"><div class="full eyebrow">intervals.icu</div>'+
      '<label class="f" for="i-id">Athleten-ID<input id="i-id" type="text" placeholder="0 oder i12345" value="' + esc(S.cfg.iid) + '"></label>' +
      '<label class="f" for="i-key">API-Schlüssel<input id="i-key" type="password" autocomplete="off" value="' + esc(S.cfg.ikey) + '"></label>' +
      '<button class="btn full" data-a="isync">Workouts der letzten 30 Tage laden</button>' +
      '<p class="note full" style="margin:0">' + (S.cfg.istat ? esc(S.cfg.istat) + '. ' : '') + 'Den Schlüssel findest du in intervals.icu unter Einstellungen, Entwicklereinstellungen. Er bleibt nur auf diesem Handy' + (hasSb ? ' (und wird für den Abruf kurz über deine eigene Supabase-Funktion geleitet, falls der direkte Abruf blockiert ist)' : '') + '.</p></section>';

    if (!hasSb) {
      h += '<section class="card"><div class="eyebrow">Konto und Trainer-Zugang</div><p class="note">Noch nicht eingerichtet. Trage in der Datei config.js die Supabase-Adresse ein (siehe README), dann kannst du dich hier anmelden und deinem Trainer einen Link geben.</p></section>';
    } else if (!S.auth) {
      h += '<form class="card form" id="authform"><div class="full eyebrow">Konto</div><label class="f full" for="a-mail">E-Mail<input id="a-mail" type="email" autocomplete="username" required></label>' +
        '<label class="f full" for="a-pw">Passwort (mind. 8 Zeichen)<input id="a-pw" type="password" autocomplete="current-password" minlength="8" required></label>' +
        '<button class="btn" type="submit" data-a="login">Anmelden</button><button class="btn ghost" type="button" data-a="signup">Neu registrieren</button></form>';
    } else {
      h += '<section class="card"><div class="eyebrow">Konto</div><p style="margin:6px 0">' + esc(S.auth.mail || '') + '</p><p class="note">' + (S.last ? 'Zuletzt gesichert: ' + new Date(S.last).toLocaleString('de-DE') : 'Noch nicht gesichert') + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-a="syncnow">Jetzt sichern</button><button class="btn ghost" data-a="pull">Vom Server laden</button><button class="btn ghost" data-a="logout">Abmelden</button></div></section>';
      h += '<section class="card"><div class="eyebrow">Trainer-Zugang</div>' + (link ?
        '<p class="note" style="word-break:break-all">' + esc(link) + '</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-a="copylink">Link kopieren</button><button class="btn danger" data-a="newlink">Link erneuern (alter Link wird ungültig)</button></div>' :
        '<p class="note">Dein Trainer sieht damit Ernährung, Carb-Ziele und Training, nur lesend, ohne Konto.</p><button class="btn" data-a="newlink" style="margin-top:10px">Link erstellen</button>') + '</section>';
    }
    h += '<button class="btn danger" data-a="reset">Alle Daten auf diesem Handy löschen</button>';
    return h;
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = view === 'heute' ? viewHeute() : view === 'plan' ? viewPlan() : view === 'log' ? viewLog() : view === 'aus' ? viewAus() : viewProfil();
    var items = [['heute', 'Heute'], ['plan', 'Plan'], ['log', 'Essen'], ['aus', 'Auswertung'], ['profil', 'Profil']];
    document.getElementById('tabs').innerHTML = items.map(function (t) { return '<button data-a="tab" data-t="' + t[0] + '"' + (view === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</button>'; }).join('');
  }

  /* ---------- Ereignisse ---------- */
  function fail(e) { flash(e && e.message ? e.message : String(e)); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.dataset.a, d = b.dataset;
    if (a === 'tab') { view = d.t; render(); window.scrollTo(0, 0); return; }
    if (a === 'day') { cur = d.d === '0' ? T.today() : T.addDays(cur, +d.d); render(); return; }
    if (a === 'range') { range = +d.n; render(); return; }
    if (a === 'lvl') { S.profile.lvls[cur] = +d.n; S.profileU = Date.now(); save(); render(); return; }
    if (a === 'goal') { S.profile.goal = d.g; S.profileU = Date.now(); save(); render(); return; }
    if (a === 'resetzones') { delete S.profile.zones; S.profileU = Date.now(); save(); render(); return; }
    if (a === 'libload') { var l1 = S.profile.lib.filter(function (x) { return x.id === d.id; })[0]; if (l1) { planTitle = l1.title; planDesc = l1.descr; render(); window.scrollTo(0, 0); } return; }
    if (a === 'libdel') { S.profile.lib = S.profile.lib.filter(function (x) { return x.id !== d.id; }); S.profileU = Date.now(); save(); render(); return; }
    if (a === 'saveset') {
      var ids = d.ids.split(','), its = S.meals.filter(function (m) { return ids.indexOf(m.id) >= 0; });
      var nm = (window.prompt('Titel für diese Mahlzeit, zum Beispiel „Mein Frühstück“:') || '').trim();
      if (!nm || !its.length) return;
      var ex = S.profile.sets.filter(function (x) { return x.title.toLowerCase() === nm.toLowerCase(); })[0];
      var packed = its.map(function (m) { return { name: m.name, g: m.g, kcal: m.kcal, c: m.c, p: m.p, f: m.f, fi: m.fi || 0, grp: m.grp || '', col: m.col || '', vit: m.vit || '' }; });
      if (ex) { ex.items = packed; ex.u = Date.now(); } else S.profile.sets.push({ id: uid(), title: nm, items: packed, u: Date.now() });
      S.profileU = Date.now(); save(); flash('Mahlzeit „' + nm + '“ gespeichert.'); render(); return;
    }
    if (a === 'addset') {
      var st = S.profile.sets.filter(function (x) { return x.id === d.id; })[0]; if (!st) return;
      ctxInit(false);
      st.items.forEach(function (it) { var m = Object.assign({}, it, { id: uid(), day: cur, t: ctxTime(), slot: ctx.kind, u: Date.now() }); S.meals.push(m); });
      q = ''; save(); render(); flash('„' + st.title + '“ zu ' + T.KINDS[ctx.kind] + ' hinzugefügt.'); return;
    }
    if (a === 'delset') { S.profile.sets = S.profile.sets.filter(function (x) { return x.id !== d.id; }); S.profileU = Date.now(); save(); render(); return; }
    if (a === 'resetmacros') { delete S.profile.macroPct; S.profileU = Date.now(); save(); render(); return; }
    if (a === 'delplan') { S.plan = S.plan.filter(function (x) { return x.id !== d.id; }); S.del.push({ t: 'plan', id: d.id }); save(); render(); return; }
    if (a === 'delmeal') { S.meals = S.meals.filter(function (x) { return x.id !== d.id; }); S.del.push({ t: 'meals', id: d.id }); save(); render(); return; }
    if (a === 'logslot') { ctx = { day: cur, kind: d.k, time: d.tm, auto: false }; view = 'log'; sel = null; q = ''; render(); window.scrollTo(0, 0); return; }
    if (a === 'ctxkind') { ctxInit(false); if (ctx.kind !== d.k) { ctx.kind = d.k; ctx.manual = false; ctx.time = mealTimeFor(d.k); } render(); return; }
    if (a === 'pick') {
      sel = allFoods().filter(function (f) { return f.n === d.n; })[0] || null;
      if (sel) selG = sel.pg;
      render();
      var c = document.getElementById('selcard'); if (c) c.scrollIntoView({ block: 'center' });
      return;
    }
    if (a === 'portion') { selG = r0(sel.pg * +d.m); var gi = document.getElementById('g'); if (gi) gi.value = selG; var sp = document.getElementById('selprev'); if (sp) sp.textContent = selPreview(); return; }
    if (a === 'cancelsel') { sel = null; render(); return; }
    if (a === 'addmeal') {
      if (!sel || !(selG > 0)) return;
      ctxInit(false);
      var tm = ctxTime();
      var m = T.mealFrom(sel, selG, cur, tm, ctx.kind); m.id = uid(); m.u = Date.now(); S.meals.push(m);
      sel = null; q = ''; save(); render(); return;
    }
    if (a === 'barcodeStart') { startBarcodeScanner(); return; }
    if (a === 'barcodeStop') {
      barcode.active = false; barcode.busy = false; barcode.msg = '';
      stopBarcodeScanner().then(render); return;
    }
    if (a === 'xpreset') { xTo = T.today(); xFrom = T.addDays(xTo, -(+d.n - 1)); render(); return; }
    if (a === 'xshare' || a === 'xcopy') {
      if (!(xFrom <= xTo)) { flash('Das Enddatum muss nach dem Startdatum liegen.'); return; }
      if (T.addDays(xFrom, 366) < xTo) { flash('Bitte höchstens 366 Tage auf einmal exportieren.'); return; }
      var md = T.exportMd(model(), xFrom, xTo), fname = 'tankplan-export-' + xFrom + '-bis-' + xTo + '.md';
      if (a === 'xcopy') {
        if (navigator.clipboard) navigator.clipboard.writeText(md).then(function () { flash('Export kopiert. Jetzt in die KI einfügen.'); }).catch(function () { flash('Kopieren nicht möglich. Nutze „Datei teilen“.'); });
        else flash('Kopieren nicht möglich. Nutze „Datei teilen“.');
        return;
      }
      var xf = new File([md], fname, { type: 'text/markdown' });
      if (navigator.canShare && navigator.canShare({ files: [xf] })) navigator.share({ files: [xf], title: 'Tankplan-Export' }).catch(function () {});
      else {
        var url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })), an = document.createElement('a');
        an.href = url; an.download = fname; document.body.appendChild(an); an.click(); document.body.removeChild(an);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000); flash('Datei wird gespeichert.');
      }
      return;
    }
    if (a === 'csv') {
      var to = T.today(), csv = T.toCsv(T.analyze(model(), T.addDays(to, -(range - 1)), to));
      var file = new File([csv], 'tankplan.csv', { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Tankplan' }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(csv).then(function () { flash('CSV in die Zwischenablage kopiert.'); }).catch(function () { flash('Kopieren nicht möglich.'); });
      return;
    }
    if (a === 'isync') {
      S.cfg.iid = document.getElementById('i-id').value; S.cfg.ikey = document.getElementById('i-key').value; persist();
      b.disabled = true; b.textContent = 'Lade…';
      isyncNow(true);
      return;
    }
    if (a === 'isyncnow') { isyncNow(true); return; }
    if (a === 'login' || a === 'signup') {
      var mail = document.getElementById('a-mail').value.trim(), pw = document.getElementById('a-pw').value;
      if (!mail || pw.length < 8) { flash('Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.'); return; }
      var p = a === 'login' ? SB.auth('token?grant_type=password', { email: mail, password: pw }) : SB.auth('signup', { email: mail, password: pw });
      p.then(function (j) {
        if (SB.setSession(j)) { flash('Angemeldet.'); S.last = 0; return syncNow().then(render); }
        flash('Registriert. Bitte bestätige zuerst die E-Mail und melde dich dann an.');
      }).catch(fail);
      return;
    }
    if (a === 'logout') { S.auth = null; persist(); render(); return; }
    if (a === 'syncnow') { S.last = 0; syncNow().then(function () { flash('Gesichert.'); render(); }).catch(fail); return; }
    if (a === 'pull') { pullAll().then(function () { flash('Daten vom Server geladen.'); }).catch(fail); return; }
    if (a === 'newlink') {
      S.cfg.token = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : uid()).replace(/-/g, '') + Math.random().toString(36).slice(2, 8); S.cfg.tokenU = Date.now(); persist();
      syncNow().then(function () { flash('Link erstellt.'); }).catch(function (er) { fail(er); });
      return;
    }
    if (a === 'copylink') {
      var l = new URL('trainer.html?t=' + S.cfg.token, location.href).href;
      if (navigator.share) navigator.share({ url: l, title: 'Tankplan' }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(l).then(function () { flash('Link kopiert.'); });
      return;
    }
    if (a === 'reset') {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Wirklich löschen? Nochmal tippen'; return; }
      localStorage.removeItem(KEY); S = blank(); render();
    }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'q') { q = e.target.value; document.getElementById('res').innerHTML = resultsHtml(); }
    else if (id === 'g') { selG = +e.target.value || 0; var sp = document.getElementById('selprev'); if (sp) sp.textContent = selPreview(); }
    else if (id === 'plantitle') { planTitle = e.target.value; var pp = document.getElementById('planprev'); if (pp) pp.innerHTML = planPreview(); }
    else if (id === 'plandesc') { planDesc = e.target.value; document.getElementById('planprev').innerHTML = planPreview(); }
    else if (id === 'plantext') { planText = e.target.value; document.getElementById('planprev').innerHTML = planPreview(); }
    else if (id === 'plandate') { planDay = e.target.value || planDay; document.getElementById('planprev').innerHTML = planPreview(); }
    else if (id === 'plantime') { planTime = e.target.value || ''; document.getElementById('planprev').innerHTML = planPreview(); }
  });
  var MT_IDS = { 'p-mb': 'b', 'p-ml': 'l', 'p-md': 'd', 'p-ms': 's' };
  document.addEventListener('change', function (e) {
    var el = e.target, id = el.id, v = el.value, P = S.profile;
    if (el.dataset && el.dataset.planMetric) {
      var workout = S.plan.find(function (item) { return item.id === el.dataset.planId; });
      var metric = el.dataset.planMetric, metricValue = el.value === '' ? null : Number(el.value);
      if (metric === 'desc') {
        if (!workout) return;
        var txt = el.value.trim(), pd = txt ? T.parseWorkoutText(txt, S.profile) : null;
        if (txt && !pd) { flash('Keine Abschnitte mit Watt-Angabe erkannt.'); return; }
        if (txt) { workout.descr = txt; workout.min = r0(pd.min); } else delete workout.descr;
        workout.u = Date.now(); save(); render(); return;
      }
      var metricMax = metric === 'tss' ? 1000 : 10000;
      if (!workout) return;
      if (metricValue !== null && (!Number.isFinite(metricValue) || metricValue < 1 || metricValue > metricMax)) { flash(metric === 'tss' ? 'TSS muss zwischen 1 und 1000 liegen.' : 'kJ muss zwischen 1 und 10.000 liegen.'); render(); return; }
      if (metricValue === null) delete workout[metric]; else workout[metric] = metricValue;
      workout.u = Date.now(); save(); render(); return;
    }
    if (el.dataset && el.dataset.mgram) {
      var mm1 = S.meals.filter(function (x) { return x.id === el.dataset.mgram; })[0], ng = Number(el.value);
      if (!mm1) return;
      if (!(ng >= 1 && ng <= 5000)) { flash('Menge zwischen 1 und 5000 g eintragen.'); render(); return; }
      var fct = mm1.g > 0 ? ng / mm1.g : 1;
      ['kcal', 'c', 'p', 'f', 'fi'].forEach(function (k) { if (mm1[k]) mm1[k] = mm1[k] * fct; });
      mm1.g = ng; mm1.u = Date.now(); save(); render(); return;
    }
    if (el.dataset && el.dataset.mid1) {
      var mv = S.meals.filter(function (x) { return x.id === el.dataset.mid1; })[0]; if (!mv) return;
      mv.slot = v; mv.t = mealTimeFor(v, [mv.id]); mv.u = Date.now(); save(); render(); flash('Verschoben zu ' + T.KINDS[v] + ' (' + mv.t + ' Uhr).'); return;
    }
    if (el.dataset && el.dataset.mids) {
      var ids = el.dataset.mids.split(',');
      S.meals.forEach(function (mm) {
        if (ids.indexOf(mm.id) < 0) return;
        if (el.classList.contains('etime')) { if (v) mm.t = v; } else mm.slot = v;
        mm.u = Date.now();
      });
      save(); render(); return;
    }
    if (id === 'xfrom' || id === 'xto') { if (v) { if (id === 'xfrom') xFrom = v; else xTo = v; } render(); return; }
    if (id === 'planlib') { var lb = S.profile.lib.filter(function (x) { return x.id === v; })[0]; if (lb) { planTitle = lb.title; planDesc = lb.descr; } else { planTitle = ''; planDesc = ''; } render(); return; }
    if (id === 'planupd') { planUpd = el.checked; var pv = document.getElementById('planprev'); if (pv) pv.innerHTML = planPreview(); return; }
    if (id === 'ctime') { ctxInit(false); if (v) { ctx.time = v; ctx.manual = true; } render(); return; }
    if (id === 'i-id') { S.cfg.iid = v; persist(); return; }
    if (id === 'i-key') { S.cfg.ikey = v; persist(); return; }
    if (MT_IDS[id]) { if (!P.mt) P.mt = {}; if (v) P.mt[MT_IDS[id]] = v; else delete P.mt[MT_IDS[id]]; S.profileU = Date.now(); save(); render(); return; }
    if (id.indexOf('p-pct-') === 0) {
      var pv = Number(document.getElementById('p-pct-p').value), fv2 = Number(document.getElementById('p-pct-f').value);
      if (!(pv >= 5 && pv <= 45 && fv2 >= 10 && fv2 <= 55 && pv + fv2 <= 85)) { flash('Eiweiß 5 bis 45 %, Fett 10 bis 55 %, zusammen höchstens 85 %.'); render(); return; }
      P.macroPct = { p: pv, f: fv2 }; S.profileU = Date.now(); save(); render(); return;
    }
    if (id === 'p-ftp') { var fv = Number(v); if (v === '') delete P.ftp; else if (fv >= 50 && fv <= 600) P.ftp = Math.round(fv); else { flash('FTP zwischen 50 und 600 Watt eintragen.'); render(); return; } S.profileU = Date.now(); save(); render(); return; }
    if (/^p-z[0-5]$/.test(id)) {
      var zs = [0, 1, 2, 3, 4, 5].map(function (i) { return Number(document.getElementById('p-z' + i).value); });
      if (zs.some(function (x, i) { return !(x > 0) || (i && x <= zs[i - 1]); })) { flash('Die Obergrenzen müssen aufsteigend sein.'); render(); return; }
      P.zones = zs; S.profileU = Date.now(); save(); render(); return;
    }
    if (id.indexOf('p-') !== 0) return;
    if (id === 'p-w') P.w = Math.max(35, Math.min(200, +v || P.w));
    if (id === 'p-h') P.h = Math.max(120, Math.min(230, +v || P.h));
    if (id === 'p-a') P.a = Math.max(14, Math.min(90, +v || P.a));
    if (id === 'p-sex') P.sex = v;
    S.profileU = Date.now(); save(); render();
  });
  function useFood(f) { S.custom.push(f); save(); sel = f; selG = f.pg || 100; q = ''; render(); }
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = e.target.id;
    if (id === 'planform') {
      var n = 0, title = planTitle.trim(), lib = libFind(title), dtext = effDesc(), dp = dtext ? T.parseWorkoutText(dtext, S.profile) : null;
      if (dtext && !dp) { flash('In der Beschreibung keine Abschnitte mit Watt-Angabe erkannt.'); return; }
      if (title && !dtext && !planText.trim()) { flash('Zu diesem Titel gibt es noch keine Vorlage. Füge die TP-Beschreibung ein.'); return; }
      planText.split('\n').forEach(function (l) {
        var x = T.parseLine(l, planDay); if (!x || x.rest) return;
        var it = { id: uid(), day: x.day, title: title || x.title, type: x.type, min: x.min, lv: x.lv, tss: x.tss || null, kj: x.kj || null, tm: x.tm || planTime || null, u: Date.now() };
        if (dp && (title || n === 0)) { it.descr = dtext; it.min = x.minGiven ? x.min : r0(dp.min); it.type = 'Rad'; }
        S.plan.push(it); n++;
      });
      if (dp && n === 0) { S.plan.push({ id: uid(), day: planDay, title: title || 'TP-Workout', type: 'Rad', min: r0(dp.min), lv: dp.ifactor ? (dp.ifactor < 0.7 ? 0 : dp.ifactor < 0.9 ? 1 : 2) : 2, tss: null, kj: null, descr: dtext, tm: planTime || null, u: Date.now() }); n++; }
      if (title && dp && n) { var saved = libSave(title, dtext, 'Rad', planUpd); if (saved && !lib) flash(n + ' Workout' + (n === 1 ? '' : 's') + ' hinzugefügt, Vorlage „' + title + '“ gespeichert.'); }
      planTitle = ''; planUpd = false;
      planText = ''; planDesc = ''; save(); flash(n ? n + ' Workout' + (n === 1 ? '' : 's') + ' hinzugefügt.' : 'Keine Workouts erkannt.');
    } else if (id === 'customform') {
      var f = { id: uid(), n: document.getElementById('c-n').value.trim(), k: +document.getElementById('c-k').value || 0, c: +document.getElementById('c-c').value || 0,
        p: +document.getElementById('c-p').value || 0, f: +document.getElementById('c-f').value || 0, fi: 0, gr: document.getElementById('c-g').value, co: '', v: '', pn: 'Portion', pg: 100, u: Date.now() };
      if (!f.n) return;
      useFood(f);
    }
  });

  window.addEventListener('online', function () { schedSync(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var now = T.today();
    if (now !== lastToday) { if (cur === lastToday) cur = now; lastToday = now; ctx = null; render(); }
    maybeAuto();
  });
  function maybeAuto() {
    if (S.cfg.ikey && Date.now() - (S.cfg.ilast || 0) > 15 * 60 * 1000 && navigator.onLine) isyncNow(false);
    schedSync();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  render();
  maybeAuto();
})();
