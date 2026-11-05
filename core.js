/* Tankplan Kernlogik: Berechnung, Eingabe-Erkennung, Auswertung, Berichte. Läuft im Browser und in Node. */
(function (root) {
  'use strict';

  var INT = ['Locker', 'Mittel', 'Hart'];
  var MET = [5, 8, 11];
  var LOADF = [0.7, 1.2, 2];
  var TYPES = { Rad: 1, Laufen: 1.1, Schwimmen: 0.9, Kraft: 0.55, Sonstiges: 0.8 };
  var GOALS = { veg: 400, fruit: 250, C: 100, A: 80, K: 60, F: 120, E: 20 };
  var VITN = { C: 'Vitamin C', A: 'Carotin (A)', K: 'Vitamin K', F: 'Folat', E: 'Vitamin E' };
  var COLN = { r: 'Rot', o: 'Orange', y: 'Gelb', g: 'Grün', b: 'Blau/Violett', w: 'Weiß' };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function parseDay(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2], 12); }
  function addDays(s, n) { var d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); }
  function dayLabel(s) { return parseDay(s).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }); }
  function dayLabelLong(s) { return parseDay(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function r0(n) { return Math.round(n); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function de(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  /* ---------- Lebensmittel ---------- */
  function parseFoods(raw) {
    return raw.split('\n').map(function (l) {
      var a = l.split('|');
      if (a.length < 11) return null;
      return { n: a[0], k: +a[1], c: +a[2], p: +a[3], f: +a[4], fi: +a[5], gr: a[6], co: a[7], v: a[8], pn: a[9] || 'Portion', pg: +a[10] || 100 };
    }).filter(Boolean);
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss'); }
  function searchFoods(list, q, limit) {
    var toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var nn = list[i]._n || (list[i]._n = norm(list[i].n));
      var ok = true, score = 0;
      for (var j = 0; j < toks.length; j++) {
        var ix = nn.indexOf(toks[j]);
        if (ix < 0) { ok = false; break; }
        if (ix === 0) score -= 2;
      }
      if (ok) out.push({ f: list[i], s: score + nn.length / 100 });
    }
    out.sort(function (a, b) { return a.s - b.s; });
    return out.slice(0, limit || 30).map(function (x) { return x.f; });
  }
  function mealFrom(food, g, day, tm, slot) {
    var x = g / 100;
    return {
      id: '', day: day, t: tm || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), slot: slot || null,
      name: food.n, g: g, kcal: food.k * x, c: food.c * x, p: food.p * x, f: food.f * x, fi: (food.fi || 0) * x,
      grp: food.gr || '', col: food.co || '', vit: food.v || ''
    };
  }

  /* ---------- Training ---------- */
  function bmr(p) { return 10 * p.w + 6.25 * p.h - 5 * p.a + (p.sex === 'm' ? 5 : -161); }
  function mapType(t) {
    t = String(t || '');
    if (/ride|bike|cycl/i.test(t)) return 'Rad';
    if (/run|jog/i.test(t)) return 'Laufen';
    if (/swim/i.test(t)) return 'Schwimmen';
    if (/weight|strength|crossfit/i.test(t)) return 'Kraft';
    return 'Sonstiges';
  }
  function lvFromLoad(load, min) {
    if (!load || !min) return 1;
    var lph = load / (min / 60);
    return lph < 45 ? 0 : lph < 75 ? 1 : 2;
  }
  /* ---------- FTP, Zonen, Beschreibung ---------- */
  var ZONE_NAMES = ['Z1 Erholung', 'Z2 LIT / Grundlage', 'Z3 MIT / Tempo', 'Z4 Schwelle', 'Z5 VO2max / HIT', 'Z6 Anaerob / Sprint'];
  var ZONE_UPPER = [55, 75, 90, 105, 120, 150];
  var CARBFRAC = [0.3, 0.4, 0.55, 0.75, 0.9, 0.95];
  function zonesOf(p) {
    var u = p && Array.isArray(p.zones) && p.zones.length === 6 ? p.zones.map(Number) : ZONE_UPPER.slice();
    for (var i = 0; i < 6; i++) if (!(u[i] > 0) || (i && u[i] <= u[i - 1])) return ZONE_UPPER.slice();
    return u;
  }
  function zoneIndex(pct, up) { for (var i = 0; i < 5; i++) if (pct <= up[i]) return i; return 5; }
  function zonePct(i, up) { var lo = i ? up[i - 1] + 1 : 40; return (lo + up[i]) / 2; }
  function carbFrac(pct) { return pct < 55 ? 0.3 : pct < 75 ? 0.4 : pct < 90 ? 0.55 : pct < 105 ? 0.75 : pct < 120 ? 0.9 : 0.95; }
  function stepsOfText(text) {
    var out = [], re = /(\d+(?:[.,]\d+)?)\s*(sec|secs|seconds|sek|s|min|mins|minutes|minuten|h|hr|std)\b([^\n]*?)@\s*(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[.,]\d+)?))?\s*(w\b|watt|%)?/gi;
    var rep = /(?:repeat|wiederhole|wiederholung)\s*(\d+)\s*(?:times|x|mal)?|\b(\d+)\s*(?:times|x)\b/gi;
    var evs = [], m;
    while ((m = re.exec(text))) {
      var u = m[2].toLowerCase(), n = parseFloat(m[1].replace(',', '.'));
      var sec = /^(s|sec|secs|seconds|sek)$/.test(u) ? n : /^(h|hr|std)$/.test(u) ? n * 3600 : n * 60;
      var lo = parseFloat(m[4].replace(',', '.')), hi = m[5] ? parseFloat(m[5].replace(',', '.')) : lo;
      var ls = text.lastIndexOf('\n', m.index - 1) + 1, before = text.slice(ls, m.index);
      if (!/[a-zäöüß]/i.test(before)) {
        var prev = text.slice(0, Math.max(0, ls - 1)).split('\n').filter(function (x) { return x.trim(); }).pop() || '';
        before = prev;
      }
      before = before.replace(/[\s\d:;,\-–.]+$/, '');
      evs.push({ pos: m.index, step: { sec: sec, lo: lo, hi: hi, pct: m[6] === '%', name: before.slice(-30) } });
    }
    while ((m = rep.exec(text))) { var cnt = +(m[1] || m[2]); if (cnt > 1 && cnt < 60) evs.push({ pos: m.index, rep: cnt }); }
    evs.sort(function (a, b) { return a.pos - b.pos; });
    var i = 0;
    while (i < evs.length) {
      var e = evs[i];
      if (e.rep) {
        var grp = [], j = i + 1;
        while (j < evs.length && !evs[j].rep) {
          var nm = evs[j].step.name;
          if (grp.length && /(recovery|warm|cool|ramp|steady|endurance|tempo|erholung|pause|einfahren|ausfahren)\s*$/i.test(nm)) break;
          grp.push(evs[j].step); j++;
        }
        for (var r = 0; r < e.rep; r++) grp.forEach(function (s) { out.push(s); });
        i = j;
      } else { out.push(e.step); i++; }
    }
    return out;
  }
  function parseWorkoutText(text, p) {
    var raw = String(text || '');
    var steps = stepsOfText(raw);
    if (!steps.length) return null;
    var ftp = p && Number(p.ftp) > 0 ? Number(p.ftp) : 0, up = zonesOf(p), series = [], warn = [];
    var kj = 0, sec = 0, zmin = [0, 0, 0, 0, 0, 0], carbKcal = 0;
    steps.forEach(function (s) {
      var w = (s.lo + s.hi) / 2;
      if (s.pct) { if (!ftp) { warn.push('Prozentwerte brauchen die FTP'); return; } w = w * ftp / 100; }
      var n = Math.round(s.sec);
      for (var k = 0; k < n; k++) series.push(w);
      sec += n; kj += w * n / 1000;
      var pct = ftp ? w / ftp * 100 : null;
      if (pct !== null) { zmin[zoneIndex(pct, up)] += n / 60; carbKcal += w * n / 1000 * carbFrac(pct); }
    });
    if (!sec) return null;
    var avg = kj * 1000 / sec, np = null, ifa = null, tss = null;
    if (series.length >= 30) {
      var acc = 0, win = 0, cnt = 0, q = [];
      for (var i = 0; i < series.length; i++) { win += series[i]; q.push(series[i]); if (q.length > 30) win -= q.shift(); if (q.length === 30) { acc += Math.pow(win / 30, 4); cnt++; } }
      np = Math.pow(acc / cnt, 0.25);
    } else np = avg;
    if (ftp) { ifa = np / ftp; tss = sec / 3600 * ifa * ifa * 100; }
    return { steps: steps.length, min: sec / 60, kj: kj, avg: avg, np: np, ifactor: ifa, tss: tss, zmin: zmin, carbRatio: ftp && kj ? carbKcal / kj : null, hasFtp: !!ftp, warn: warn };
  }
  var AVGW_KG = [2.0, 2.6, 3.1];
  var IF_LV = [0.62, 0.76, 0.88], VI_LV = [1.03, 1.05, 1.1];
  function estimateRideKj(s, p, lv) {
    var hrs = s.min / 60;
    if (Number(p.ftp) > 0) return IF_LV[lv] / VI_LV[lv] * p.ftp * hrs * 3.6;
    return AVGW_KG[lv] * p.w * hrs * 3.6;
  }

  function intensityFromTss(tss, min) {
    tss = Number(tss);
    min = Number(min);
    if (!(tss > 0) || !(min > 0)) return null;
    var factor = Math.sqrt(tss * 60 / min / 100);
    return { factor: factor, lv: factor < 0.7 ? 0 : factor < 0.9 ? 1 : 2 };
  }
  /* Pendelfahrt: lockere Radfahrt, mit passendem Titel bis 90 min, sonst bis 40 min. Sie zählt zum Energiebedarf, bekommt aber keine eigenen Vor-, Während- oder Nach-Mahlzeiten. */
  var COMMUTE_RE = /pendel|commut|schulweg|arbeitsweg|zur schule|zur arbeit|zur uni/i;
  function isCommute(x) {
    var s = x && x.s ? x.s : x;
    if (!s || s.type !== 'Rad') return false;
    var lv = x && x.lv !== undefined ? x.lv : s.lv;
    if (Number(lv) > 0) return false;
    var m = Number(s.min) || 0;
    return COMMUTE_RE.test(s.title || '') ? m <= 90 : m <= 40;
  }
  function bucket(load) { return load === 0 ? 3.5 : load < 0.8 ? 5 : load < 1.8 ? 6.5 : load < 3 ? 8 : 10; }
  var BUCKET_NAME = { 3.5: 'Ruhetag', 5: 'Leichter Tag', 6.5: 'Standardtag', 8: 'Hoher Bedarf', 10: 'Schlüsseltag' };

  /* Energie einer Einheit. Rangfolge: kJ eingegeben, Beschreibung, TSS mit FTP, Schätzung. */
  function sessInfo(s, p) {
    var w = p.w, hrs = s.min / 60, tss = Number(s.tss) || 0;
    var tssIntensity = intensityFromTss(tss, s.min);
    var ftp = Number(p.ftp) > 0 ? Number(p.ftp) : 0;
    var desc = s.desc ? parseWorkoutText(s.desc, p) : null;
    var lv = tssIntensity ? tssIntensity.lv : (Number(s.lv) || 0);
    var ifactor = tssIntensity ? tssIntensity.factor : null, tssOut = tss || null;
    if (desc && desc.ifactor) { ifactor = desc.ifactor; lv = ifactor < 0.7 ? 0 : ifactor < 0.9 ? 1 : 2; if (!tssOut) tssOut = r0(desc.tss * (s.min > 0 && Math.abs(s.min - desc.min) > 1 ? s.min / desc.min : 1)); }
    var kj = Number(s.kj) || 0, kcal, basis, carbRatio = null;
    if (kj > 0) { kcal = kj; basis = 'kJ eingegeben'; }
    else if (desc && s.type === 'Rad') {
      var sc = s.min > 0 && Math.abs(s.min - desc.min) > 1 ? s.min / desc.min : 1;
      kcal = desc.kj * sc; basis = sc === 1 ? 'Beschreibung' : 'Beschreibung, auf ' + s.min + ' min umgerechnet'; carbRatio = desc.carbRatio;
    }
    else if (s.kcal) { kcal = s.net ? s.kcal : Math.max(0, s.kcal - bmr(p) / 24 * hrs); basis = 'gemessen'; }
    else if (s.type === 'Rad' && tss > 0 && ftp) { kcal = ifactor * ftp / (ifactor >= 0.8 ? 1.07 : 1.03) * hrs * 3.6; basis = 'TSS und FTP'; }
    else if (s.type === 'Rad') { kcal = estimateRideKj(s, p, lv); basis = ftp ? 'Schätzung aus FTP' : 'Schätzung aus Gewicht (FTP fehlt)'; }
    else { kcal = Math.max(0, MET[lv] * (TYPES[s.type] || 1) * w * hrs - bmr(p) / 24 * hrs); basis = 'Schätzung'; }
    var big = s.min >= 60 || lv === 2;
    var gph = s.min < 45 ? 0 : s.min < 75 ? (lv >= 1 ? 30 : 0) : s.min < 150 ? (lv >= 1 ? 60 : 40) : (lv === 2 ? 90 : 60);
    if (carbRatio === null) carbRatio = ifactor ? Math.max(0.25, Math.min(0.65, 0.35 + (ifactor - 0.6) * 0.65)) : [0.3, 0.45, 0.6][lv];
    carbRatio = Math.max(0.25, Math.min(0.9, carbRatio));
    return {
      s: s, kcal: kcal, load: tssOut ? tssOut / 100 : hrs * LOADF[lv] * (s.type === 'Kraft' ? 0.6 : 1),
      tss: tssOut, kj: kj || null, ifactor: ifactor, lv: lv, basis: basis, desc: desc,
      carbRatio: carbRatio, carbs: r0(kcal * carbRatio / 4),
      pre: r0(w * (big ? 1 : 0.5)), preWhen: big ? '2–3 h davor' : '60 min davor',
      gph: gph, during: r0(gph * hrs),
      post: r0(w * (s.min >= 60 ? 1 : 0.5)), postP: Math.max(20, r0(w * 0.3))
    };
  }

  function daySessions(model, d) {
    var acts = model.acts.filter(function (a) { return a.day === d; }).map(function (a) {
      return { src: 'act', id: a.id, man: /^man_/.test(a.id), type: a.type, min: a.min, lv: a.lv, kcal: a.kcal, net: a.net, title: a.name || a.type, tm: a.tm };
    });
    var used = {};
    var out = acts.slice();
    out.dropped = [];
    model.plan.filter(function (x) { return x.day === d; }).forEach(function (p) {
      var i = -1;
      for (var k = 0; k < acts.length; k++) if (!used[k] && acts[k].type === p.type) { i = k; break; }
      if (i >= 0) { used[i] = true; return; }
      if (d < model.today) { out.dropped.push(p); return; }
      var plannedIntensity = p.tss ? intensityFromTss(p.tss, p.min) : null;
      out.push({ src: 'plan', type: p.type, min: p.min, lv: plannedIntensity ? plannedIntensity.lv : p.lv, tss: p.tss, kj: p.kj, desc: p.descr, title: p.title, id: p.id, tm: p.tm, day: p.day });
    });
    return out;
  }

  function macroPct(p) {
    var m = p && p.macroPct;
    if (!m || !(+m.p >= 5 && +m.p <= 45 && +m.f >= 10 && +m.f <= 55 && +m.p + +m.f <= 85)) return null;
    return { p: +m.p, f: +m.f, c: 100 - m.p - m.f };
  }
  function target(p, sess, nextSess, lvl) {
    var info = sess.map(function (s) { return sessInfo(s, p); });
    var load = 0, trainKcal = 0, trainCarbs = 0, loadMain = 0, cmN = 0;
    info.forEach(function (x) { load += x.load; trainKcal += x.kcal; trainCarbs += x.carbs; if (isCommute(x)) cmN++; else loadMain += x.load; });
    var gkg = bucket(loadMain), note = '';
    var nl = 0;
    (nextSess || []).forEach(function (s) { var ni = sessInfo(s, p); if (!isCommute(ni)) nl += ni.load; });
    var ng = bucket(nl);
    var dayType = BUCKET_NAME[bucket(loadMain)];
    if (cmN && loadMain === 0) dayType = 'Pendeltag';
    if (ng >= 8 && loadMain === 0) { dayType = 'Ruhetag vor Schlüsseltag'; note = 'Morgen ist eine harte Einheit geplant. Das heutige Carb-Ziel basiert nur auf dem heutigen Bedarf.'; }
    var w = p.w;
    var pal = PAL[lvl] || PAL[3];
    var energyFactor = p.goal === 'lose' ? 0.85 : p.goal === 'gain' ? 1.1 : 1;
    var kcal = (bmr(p) * pal + trainKcal) * energyFactor;
    var mp = macroPct(p);
    if (mp) {
      var kc = Math.max(1200, r0(kcal)), fg = kc * mp.f / 100 / 9, pg = kc * mp.p / 100 / 4, cg = (kc - 9 * fg - 4 * pg) / 4;
      return { lvl: lvl || 3, pal: pal, base: r0(bmr(p) * pal), info: info, gkg: w ? r0(cg / w * 10) / 10 : gkg, dayType: dayType, note: note, kcal: kc, c: r0(cg), p: r0(pg), f: r0(fg), trainKcal: r0(trainKcal), trainCarbs: trainCarbs, load: load, restMacros: null, trainExtra: null, pct: mp };
    }
    var savedMacros = p.restMacros;
    var hasRestMacros = savedMacros && ['c', 'p', 'f'].every(function (key) { return Number.isFinite(+savedMacros[key]) && +savedMacros[key] >= 0; });
    var macroPal = PAL[p.restMacroPal] || PAL[3];
    var restC = hasRestMacros ? +savedMacros.c : w * 3.5 * (p.goal === 'lose' ? 0.9 : 1);
    var restP = hasRestMacros ? +savedMacros.p : w * (p.goal === 'lose' ? 2 : 1.8);
    var restF = hasRestMacros ? +savedMacros.f : w * 0.8;
    var c = restC + trainCarbs;
    var pr = hasRestMacros && info.length ? Math.max(restP, w * (p.goal === 'lose' ? 2 : 1.8)) : hasRestMacros ? restP : w * (p.goal === 'lose' ? 2 : 1.8);
    var minimumMacroKcal = 4 * c + 4 * pr + 9 * restF, f;
    if (hasRestMacros && !info.length) {
      var activityKcalChange = (bmr(p) * (pal - macroPal)) * energyFactor;
      f = Math.max(0, restF + activityKcalChange / 9);
      kcal = 4 * c + 4 * pr + 9 * f;
    } else {
      if (info.length) {
        // Keep the PAL step visible when training-day macro minimums exceed the level-1 energy estimate.
        var levelOneKcal = (bmr(p) * PAL[1] + trainKcal) * energyFactor;
        kcal += Math.max(0, minimumMacroKcal - levelOneKcal);
      }
      f = Math.max(restF, (kcal - 4 * c - 4 * pr) / 9);
      kcal = Math.max(kcal, 4 * c + 4 * pr + 9 * f);
    }
    var trainExtra = hasRestMacros && info.length ? { c: r0(Math.max(0, c - restC)), p: r0(Math.max(0, pr - restP)), f: r0(Math.max(0, f - restF)) } : null;
    if (hasRestMacros && !info.length) { dayType = 'Ruhetag · eigene Makros'; if (load === 0 && !note) note = ''; }
    gkg = w ? r0(c / w * 10) / 10 : gkg;
    if (hasRestMacros) kcal = 4 * r0(c) + 4 * r0(pr) + 9 * r0(f);
    return { lvl: lvl || 3, pal: pal, base: r0(bmr(p) * pal), info: info, gkg: gkg, dayType: dayType, note: note, kcal: r0(kcal), c: r0(c), p: r0(pr), f: r0(f), trainKcal: r0(trainKcal), trainCarbs: trainCarbs, load: load, restMacros: hasRestMacros ? { c: r0(restC), p: r0(restP), f: r0(restF) } : null, trainExtra: trainExtra };
  }

  /* ---------- Eingabe-Erkennung ("morgen 30/30 Intervalle 75 min Rad") ---------- */
  var WD = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };
  var WD_SHORT = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  function parseLine(text, defDay, nowDay) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var low = raw.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    var tssMatch = low.match(/\btss\s*[:=]?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*tss\b/);
    var kjMatch = low.match(/\bkj\s*[:=]?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*kj\b/);
    var tss = tssMatch ? Number((tssMatch[1] || tssMatch[2]).replace(',', '.')) : null;
    var kj = kjMatch ? Number((kjMatch[1] || kjMatch[2]).replace(',', '.')) : null;
    var day = defDay, m;
    var base = nowDay || today();
    if (/vorgestern/.test(low)) day = addDays(base, -2);
    else if (/\bgestern\b/.test(low)) day = addDays(base, -1);
    else if (/uebermorgen/.test(low)) day = addDays(base, 2);
    else if (/\bmorgen\b/.test(low)) day = addDays(base, 1);
    else if (/\bheute\b/.test(low)) day = base;
    else if ((m = low.match(/(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/))) {
      var y = m[3] ? +m[3] : parseDay(base).getFullYear();
      if (y < 100) y += 2000;
      var dd = new Date(y, +m[2] - 1, +m[1], 12);
      if (!m[3] && (parseDay(base) - dd) / 86400000 > 60) dd.setFullYear(y + 1);
      day = iso(dd);
    } else {
      var wd = null;
      Object.keys(WD).forEach(function (k) { if (wd === null && new RegExp('\\b' + k + '\\b').test(low)) wd = WD[k]; });
      if (wd === null && (m = low.match(/^(mo|di|mi|do|fr|sa|so)\b\.?/))) wd = WD_SHORT[m[1]];
      if (wd !== null) {
        var cur = parseDay(base).getDay();
        day = addDays(base, (wd - cur + 7) % 7);
      }
    }
    if (/\b(ruhetag|frei|off|pause)\b/.test(low) && !/\d+\s*min/.test(low)) return { rest: true, day: day, title: raw };
    var tm = null, tmRaw = '', tmt;
    var tpats = [
      /(?:\bum|\bab|\bgegen)\s*(\d{1,2})(?::(\d{2}))?(?!\d)(?!\s*(?:[x×*\/]|min|km|h\b|std))\s*(?:uhr)?/,
      /(\d{1,2}):(\d{2})\s*uhr/,
      /\b(\d{1,2})\s*uhr(?:\s*(\d{2})(?!\s*(?:min|h\b|std)))?/,
      /\b(\d{1,2}):(\d{2})\b(?!\s*(?:h(?![a-z])|std|stunden))/
    ];
    for (var ti = 0; ti < tpats.length && tm === null; ti++) {
      tmt = low.match(tpats[ti]);
      if (tmt && +tmt[1] < 24 && (!tmt[2] || +tmt[2] < 60)) { tm = pad(+tmt[1]) + ':' + (tmt[2] || '00'); tmRaw = tmt[0]; }
    }
    if (tm === null) {
      var wm = low.match(/\b(fruehmorgens|vormittags|nachmittags|morgens|mittags|abends)\b/);
      if (wm) { tm = { fruehmorgens: '06:30', morgens: '07:00', vormittags: '09:30', mittags: '12:00', nachmittags: '16:00', abends: '18:00' }[wm[1]]; tmRaw = wm[0]; }
    }
    var low2 = tmRaw ? low.replace(tmRaw, ' ') : low;
    var min = 0;
    var hm = low2.match(/(\d{1,2}):(\d{2})\s*(?:h(?![a-z])|std)/);
    var h1 = low2.match(/(\d+)\s*(?:h(?![a-z])|std|stunden?)\s*(\d{1,2})?\s*(?:min)?/);
    if (hm) min = +hm[1] * 60 + +hm[2];
    else if (h1) min = +h1[1] * 60 + (h1[2] ? +h1[2] : 0);
    else {
      var re = /(\d+)\s*(?:min|minuten)/g, mm;
      while ((mm = re.exec(low2))) min = Math.max(min, +mm[1]);
    }
    var minGiven = !!min;
    if (!min) min = 60;
    var type = 'Rad';
    if (/\blauf|\bjogg|\brun\b|dauerlauf/.test(low)) type = 'Laufen';
    else if (/schwimm|\bswim/.test(low)) type = 'Schwimmen';
    else if (/kraft|\bgym\b|stabi/.test(low)) type = 'Kraft';
    var lv = 1;
    if (/30\/30|\d+\s*x\s*\d|interval|vo2|schwelle|threshold|\bz[45]\b|\bhit\b|wettkampf|rennen|race|\btest\b|anaerob|sprint|\bftp\b|over.?under/.test(low)) lv = 2;
    else if (/locker|grundlage|\bga ?1\b|\bz[12]\b|\blit\b|regeneration|recovery|easy|spazier|aktive erholung/.test(low)) lv = 0;
    if (tss > 0) lv = intensityFromTss(tss, min).lv;
    var title = raw.replace(/\b(heute|gestern|vorgestern|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b[,:]?\s*/ig, '').replace(/^(mo|di|mi|do|fr|sa|so)\b\.?[,:]?\s+/i, '').replace(/^\d{1,2}\.\d{1,2}\.?(\d{2,4})?[,:]?\s*/, '').trim() || raw;
    title = title.replace(/\btss\s*[:=]?\s*\d+(?:[.,]\d+)?/ig, ' ').replace(/\d+(?:[.,]\d+)?\s*tss\b/ig, ' ').replace(/\bkj\s*[:=]?\s*\d+(?:[.,]\d+)?/ig, ' ').replace(/\d+(?:[.,]\d+)?\s*kj\b/ig, ' ').replace(/\s{2,}/g, ' ').trim() || title;
    if (tm !== null) {
      title = title.replace(/(?:\b(?:um|ab|gegen)\s*)?\b\d{1,2}:\d{2}\s*uhr/i, '').replace(/(?:\b(?:um|ab|gegen)\s*)?\b\d{1,2}\s*uhr(?:\s*\d{2}(?!\s*(?:min|h\b|std)))?/i, '').replace(/\b(?:um|ab|gegen)\s*\d{1,2}:\d{2}\b/i, '').replace(/\b\d{1,2}:\d{2}\b(?!\s*(?:h\b|std))/, '').replace(/\b(?:fr[üu]h|morgens|vormittags|mittags|nachmittags|abends)\b/i, '').replace(/\s{2,}/g, ' ').trim() || title;
    }
    return { day: day, title: title, type: type, min: min, minGiven: minGiven, lv: lv, tm: tm, tss: tss, kj: kj };
  }

  /* ---------- Auswertung ---------- */
  function dayStats(meals) {
    var s = { c: 0, p: 0, f: 0, k: 0, fi: 0, veg: 0, fruit: 0, vegCook: 0, fruitCook: 0, vit: { C: 0, A: 0, K: 0, F: 0, E: 0 }, cols: {} };
    meals.forEach(function (m) {
      s.c += m.c; s.p += m.p; s.f += m.f; s.k += m.kcal; s.fi += m.fi || 0;
      if (m.grp === 'G') s.veg += m.g;
      if (m.grp === 'O') s.fruit += m.g;
      if (m.cook === 'g') { if (m.grp === 'G') s.vegCook += m.g; if (m.grp === 'O') s.fruitCook += m.g; }
      String(m.vit || '').split('').forEach(function (ch) { if (s.vit[ch] !== undefined) s.vit[ch] += m.g; });
      if (m.col && (m.grp === 'G' || m.grp === 'O')) s.cols[m.col] = 1;
    });
    return s;
  }
  function level(ratio) { return ratio >= 1 ? 'ok' : ratio >= 0.5 ? 'mid' : 'low'; }
  function ampel(st) {
    var o = { veg: { r: st.veg / GOALS.veg }, fruit: { r: st.fruit / GOALS.fruit }, vit: {} };
    o.veg.lv = level(o.veg.r); o.fruit.lv = level(o.fruit.r);
    Object.keys(VITN).forEach(function (k) { var r = st.vit[k] / GOALS[k]; o.vit[k] = { r: r, lv: level(r) }; });
    return o;
  }
  function analyze(model, from, to) {
    var rows = [];
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var sess = daySessions(model, d);
      var next = daySessions(model, addDays(d, 1));
      var ms = model.meals.filter(function (m) { return m.day === d; });
      var tm = 0;
      sess.forEach(function (s) { tm += s.min; });
      var tg = target(model.profile, sess, next, (model.profile.lvls || {})[d]), mp = mealPlan(model.profile, tg, model.profile.mt, d);
      ms = ms.slice().sort(function (a, b) { return (tmin(a.t) === null ? 9999 : tmin(a.t)) - (tmin(b.t) === null ? 9999 : tmin(b.t)); });
      rows.push({ pm: model.meals.filter(function (m) { return m.day === addDays(d, -1); }), day: d, t: tg, st: dayStats(ms), n: ms.length, meals: ms, sess: sess, trainMin: tm, mp: mp, match: matchMeals(mp, ms, tg), groups: groupMeals(ms, trainWin(tg)) });
    }
    return rows;
  }
  function avg(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x); }); return arr.length ? s / arr.length : 0; }

  /* ---------- Mahlzeitenplan ---------- */
  var DEF_MT = { b: '07:30', l: '12:30', d: '19:00', s: '15:30' };
  var KINDS = { frueh: 'Frühstück', mittag: 'Mittagessen', abend: 'Abendessen', snack: 'Snack', pre: 'Vor dem Training', during: 'Beim Training', post: 'Nach dem Training', shake: 'Shake', extra: 'Zusatz' };
  /* Mahlzeit-Zuordnung: slot = "art" (alt) oder "art#nr" (neu). nr zählt gleiche Arten am Tag, z. B. nach dem Training #1 und #2 oder mittag#2 für ein zweites Mittagessen. */
  function slotKind(s) { return s ? String(s).split('#')[0] : ''; }
  function slotInst(s) { var n = s ? parseInt(String(s).split('#')[1], 10) : 0; return n > 0 ? n : 0; }
  function slotLabel(kind, inst) { return (KINDS[kind] || kind) + (inst > 1 ? ' ' + inst : ''); }
  var PW = { pre: 0.6, post: 1.2, frueh: 1, mittag: 1, abend: 1, snack: 0.5 };
  var FW = { pre: 0.3, post: 0.5, frueh: 1, mittag: 1, abend: 1, snack: 0.6 };
  var VW = { pre: 0, post: 0.5, frueh: 0.6, mittag: 1, abend: 1, snack: 0.3 };
  var OW = { pre: 0.6, post: 0.8, frueh: 1, mittag: 0.6, abend: 0.6, snack: 1.2 };

  function tmin(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function tfmt(m) { m = Math.round(m / 5) * 5; m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function hmText(min) { min = Math.max(0, Math.round(min / 5) * 5); var h = Math.floor(min / 60), m = min % 60; return h ? (m ? h + ' h ' + m + ' min' : h + ' h') : m + ' min'; }

  /* ---------- Individuelle Regeln (von einer KI aus normaler Sprache in diesen Block übersetzt) ---------- */
  var RL_KINDS = ['frueh', 'mittag', 'abend', 'snack', 'pre', 'post'];
  var TIMING_DEF = { preOffset: 60, preOffsetBig: 150, preEarliest: 180, preLatest: 45, postDelay: 30, postWindow: 90 };
  var TIMING_LIM = { preOffset: [15, 240], preOffsetBig: [15, 240], preEarliest: [30, 300], preLatest: [10, 120], postDelay: [0, 180], postWindow: [30, 240] };
  var TIMING_TXT = { preOffset: 'Wunschabstand Mahlzeit vor kurzen/leichten Einheiten (min)', preOffsetBig: 'Wunschabstand Mahlzeit vor langen/harten Einheiten (min)', preEarliest: 'früheste Mahlzeit vor dem Training (min vorher)', preLatest: 'späteste Mahlzeit vor dem Training (min vorher)', postDelay: 'Mahlzeit nach dem Training (min nach Ende)', postWindow: 'Essenszeit gilt als „nach dem Training“ bis (min nach Ende)' };
  var SHAKE_DEF = { easy: { c: 20, p: 10 }, mid: { c: 50, p: 25 }, hard: { c: 90, p: 40 }, long: { c: 70, p: 30 } };
  var SHAKE_TXT = { easy: 'locker (LIT, unter 150 min)', mid: 'mittel (Tempo/Sweetspot)', hard: 'hart (HIT)', long: 'sehr lang (ab 150 min)' };
  var MEAL_TXT = { frueh: 'Frühstück', mittag: 'Mittagessen', abend: 'Abendessen', snack: 'Snack', pre: 'Mahlzeit vor dem Training', post: 'Mahlzeit nach dem Training' };
  function rnum(v) { if (typeof v === 'string') v = v.replace(',', '.'); if (v === null || v === '' || typeof v === 'boolean') return null; v = Number(v); return isFinite(v) ? v : null; }
  function rclamp(v, lo, hi, msgs, label) {
    var n = rnum(v);
    if (n === null) { msgs.push(label + ': keine Zahl, ignoriert.'); return null; }
    var c = Math.min(hi, Math.max(lo, n));
    if (c !== n) msgs.push(label + ': ' + n + ' auf ' + c + ' begrenzt (erlaubt ' + lo + ' bis ' + hi + ').');
    return Math.round(c * 100) / 100;
  }
  function rbool(v) { return v === true || v === 'true' || v === 'ja' ? true : v === false || v === 'false' || v === 'nein' ? false : null; }
  /* Nimmt Text (mit oder ohne ```-Zeichen) oder ein Objekt, liefert { rules, msgs }. rules ist null, wenn nichts Brauchbares drinsteht. */
  function normRules(raw) {
    var msgs = [], out = {}, any = false, o = raw;
    if (typeof raw === 'string') {
      var a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      if (a < 0 || b <= a) return { rules: null, msgs: ['Kein Regelblock gefunden. Er beginnt mit { und endet mit }.'] };
      try { o = JSON.parse(raw.slice(a, b + 1)); } catch (e) { return { rules: null, msgs: ['Der Regelblock ist kein gültiges JSON. Bitte die KI den Block noch einmal vollständig ausgeben lassen.'] }; }
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { rules: null, msgs: ['Kein Regelblock gefunden.'] };
    Object.keys(o).forEach(function (k) { if (['v', 'note', 'meals', 'timing', 'shake', 'extra'].indexOf(k) < 0) msgs.push('Unbekannter Eintrag „' + k + '“ wird ignoriert.'); });
    if (typeof o.note === 'string' && o.note.trim()) { out.note = o.note.trim().slice(0, 300); }
    if (o.meals && typeof o.meals === 'object') {
      var ms = {};
      Object.keys(o.meals).forEach(function (k) {
        if (RL_KINDS.indexOf(k) < 0) { msgs.push('Mahlzeit „' + k + '“ gibt es nicht und wird ignoriert.'); return; }
        var src = o.meals[k], dst = {};
        if (!src || typeof src !== 'object') return;
        [['size', 'Größe', 0.3, 2.5], ['c', 'Carbs', 0.2, 3], ['p', 'Eiweiß', 0.2, 3], ['f', 'Fett', 0.2, 3]].forEach(function (d) {
          if (src[d[0]] === undefined) return;
          var v = rclamp(src[d[0]], d[2], d[3], msgs, MEAL_TXT[k] + ' ' + d[1]);
          if (v !== null && v !== 1) dst[d[0]] = v;
        });
        if (k === 'snack' && src.on !== undefined) { var bo = rbool(src.on); if (bo !== null) dst.on = bo; else msgs.push('Snack „on“ muss true oder false sein.'); }
        Object.keys(src).forEach(function (kk) { if (['size', 'c', 'p', 'f', 'on'].indexOf(kk) < 0) msgs.push(MEAL_TXT[k] + ': Eintrag „' + kk + '“ wird ignoriert.'); });
        if (Object.keys(dst).length) ms[k] = dst;
      });
      if (Object.keys(ms).length) out.meals = ms;
    }
    if (o.timing && typeof o.timing === 'object') {
      var tm = {};
      Object.keys(o.timing).forEach(function (k) {
        if (!TIMING_LIM[k]) { msgs.push('Zeiteinstellung „' + k + '“ gibt es nicht und wird ignoriert.'); return; }
        var v = rclamp(o.timing[k], TIMING_LIM[k][0], TIMING_LIM[k][1], msgs, TIMING_TXT[k]);
        if (v !== null) tm[k] = Math.round(v);
      });
      var e0 = tm.preEarliest !== undefined ? tm.preEarliest : TIMING_DEF.preEarliest, l0 = tm.preLatest !== undefined ? tm.preLatest : TIMING_DEF.preLatest;
      if (e0 < l0 + 15) { tm.preEarliest = l0 + 15; msgs.push('Früheste Mahlzeit vor dem Training muss mindestens 15 min vor der spätesten liegen, auf ' + tm.preEarliest + ' min gesetzt.'); }
      if (Object.keys(tm).length) out.timing = tm;
    }
    if (o.shake && typeof o.shake === 'object') {
      var sh = {}, on = rbool(o.shake.on);
      if (on === null) msgs.push('Shake „on“ muss true oder false sein, Shake bleibt aus.');
      sh.on = on === true;
      if (o.shake.at !== undefined) { var at = rclamp(o.shake.at, 0, 60, msgs, 'Shake: Minuten nach Trainingsende'); if (at !== null) sh.at = Math.round(at); }
      if (o.shake.minMin !== undefined) { var mn = rclamp(o.shake.minMin, 0, 600, msgs, 'Shake: nur Einheiten ab (min)'); if (mn !== null && mn > 0) sh.minMin = Math.round(mn); }
      if (o.shake.mealAfter !== undefined) { var ma = rclamp(o.shake.mealAfter, 10, 180, msgs, 'Mahlzeit nach dem Shake (min)'); if (ma !== null) sh.mealAfter = Math.round(ma); }
      Object.keys(SHAKE_DEF).forEach(function (cls) {
        var src = o.shake[cls];
        if (src === undefined) return;
        if (!src || typeof src !== 'object') { msgs.push('Shake ' + SHAKE_TXT[cls] + ': erwartet {"c":…,"p":…}.'); return; }
        var c = rclamp(src.c === undefined ? SHAKE_DEF[cls].c : src.c, 0, 200, msgs, 'Shake ' + SHAKE_TXT[cls] + ' Carbs'), pp = rclamp(src.p === undefined ? SHAKE_DEF[cls].p : src.p, 0, 80, msgs, 'Shake ' + SHAKE_TXT[cls] + ' Eiweiß');
        if (c !== null && pp !== null) sh[cls] = { c: Math.round(c), p: Math.round(pp) };
      });
      ['easy', 'mid', 'hard', 'long'].forEach(function () {});
      Object.keys(o.shake).forEach(function (kk) { if (['on', 'at', 'mealAfter', 'minMin', 'easy', 'mid', 'hard', 'long'].indexOf(kk) < 0) msgs.push('Shake: Eintrag „' + kk + '“ wird ignoriert.'); });
      out.shake = sh;
    }
    if (o.extra !== undefined) {
      var exl = [];
      if (!Array.isArray(o.extra)) msgs.push('„extra“ muss eine Liste sein, ignoriert.');
      else o.extra.slice(0, 4).forEach(function (e, i) {
        var nm0 = 'Zusatz-Mahlzeit ' + (i + 1);
        if (!e || typeof e !== 'object') { msgs.push(nm0 + ': erwartet ein Objekt, ignoriert.'); return; }
        var ex = { name: typeof e.name === 'string' && e.name.trim() ? e.name.trim().replace(/[<>]/g, '').slice(0, 30) : nm0 };
        var lab = ex.name;
        ex.when = e.when === 'before' || e.when === 'time' ? e.when : 'after';
        if (e.when !== undefined && ['before', 'after', 'time'].indexOf(e.when) < 0) msgs.push(lab + ': „when“ muss before, after oder time sein, es gilt after.');
        if (ex.when === 'time') {
          var tz = /^(\d{1,2}):(\d{2})$/.exec(String(e.time)); if (!tz || +tz[1] > 23 || +tz[2] > 59) { msgs.push(lab + ': „time“ fehlt oder ist keine Uhrzeit (HH:MM), ignoriert.'); return; }
          ex.time = tfmt(tmin(e.time));
          if (rbool(e.trainingOnly) === true) ex.trainingOnly = true;
        } else {
          var off = e.offset === undefined ? (ex.when === 'before' ? 30 : 10) : rclamp(e.offset, ex.when === 'before' ? 5 : 0, 240, msgs, lab + ': Abstand (min)');
          ex.offset = Math.round(off === null ? 10 : off);
          if (e.minMin !== undefined) { var m1 = rclamp(e.minMin, 0, 600, msgs, lab + ': nur Einheiten ab (min)'); if (m1 !== null && m1 > 0) ex.minMin = Math.round(m1); }
          if (e.maxMin !== undefined) { var m2 = rclamp(e.maxMin, 5, 900, msgs, lab + ': nur Einheiten bis (min)'); if (m2 !== null) ex.maxMin = Math.round(m2); }
        }
        var flat = {};
        [['c', 200], ['p', 80], ['f', 60]].forEach(function (d) { if (e[d[0]] !== undefined) { var v = rclamp(e[d[0]], 0, d[1], msgs, lab + ': ' + d[0].toUpperCase()); if (v !== null) flat[d[0]] = Math.round(v); } });
        Object.assign(ex, flat);
        if (e.by && typeof e.by === 'object' && ex.when !== 'time') {
          var by = {};
          Object.keys(e.by).forEach(function (cls) {
            if (!SHAKE_DEF[cls]) { msgs.push(lab + ': Einheitenart „' + cls + '“ gibt es nicht (easy, mid, hard, long), ignoriert.'); return; }
            var z = e.by[cls]; if (!z || typeof z !== 'object') return;
            var zc = rclamp(z.c === undefined ? 0 : z.c, 0, 200, msgs, lab + ' ' + SHAKE_TXT[cls] + ' Carbs'), zp = rclamp(z.p === undefined ? 0 : z.p, 0, 80, msgs, lab + ' ' + SHAKE_TXT[cls] + ' Eiweiß'), zf = rclamp(z.f === undefined ? 0 : z.f, 0, 60, msgs, lab + ' ' + SHAKE_TXT[cls] + ' Fett');
            if (zc !== null && zp !== null && zf !== null) by[cls] = { c: Math.round(zc), p: Math.round(zp), f: Math.round(zf) };
          });
          if (Object.keys(by).length) ex.by = by;
        }
        Object.keys(e).forEach(function (kk) { if (['name', 'when', 'time', 'trainingOnly', 'offset', 'minMin', 'maxMin', 'c', 'p', 'f', 'by'].indexOf(kk) < 0) msgs.push(lab + ': Eintrag „' + kk + '“ wird ignoriert.'); });
        if (!(ex.c > 0 || ex.p > 0 || ex.f > 0 || ex.by)) { msgs.push(lab + ': keine Menge angegeben (c, p, f oder by), ignoriert.'); return; }
        exl.push(ex);
      });
      if (o.extra.length > 4) msgs.push('Höchstens 4 Zusatz-Mahlzeiten, der Rest wird ignoriert.');
      if (exl.length) out.extra = exl;
    }
    any = !!(out.meals || out.timing || out.shake || out.extra || out.note);
    if (!any) { return { rules: null, msgs: msgs.concat(['Der Regelblock enthält keine gültigen Einstellungen.']) }; }
    out.v = 1;
    return { rules: out, msgs: msgs };
  }
  function fmtN(n) { return String(n).replace('.', ','); }
  function ruleLines(r) {
    var L = [];
    if (!r) return L;
    if (r.meals) RL_KINDS.forEach(function (k) {
      var m = r.meals[k]; if (!m) return;
      var parts = [];
      if (m.size) parts.push('Größe ×' + fmtN(m.size));
      if (m.c) parts.push('Carbs ×' + fmtN(m.c));
      if (m.p) parts.push('Eiweiß ×' + fmtN(m.p));
      if (m.f) parts.push('Fett ×' + fmtN(m.f));
      if (m.on === true) parts.push('Snack immer einplanen');
      if (m.on === false) parts.push('kein Snack');
      if (parts.length) L.push(MEAL_TXT[k] + ': ' + parts.join(', '));
    });
    if (r.timing) Object.keys(TIMING_TXT).forEach(function (k) { if (r.timing[k] !== undefined) L.push(TIMING_TXT[k] + ': ' + r.timing[k] + ' (Standard ' + TIMING_DEF[k] + ')'); });
    if (r.shake) {
      if (r.shake.on && r.shake.minMin) L.push('Shake nur bei Einheiten ab ' + r.shake.minMin + ' min');
      if (!r.shake.on) L.push('Shake nach dem Training: aus');
      else {
        L.push('Shake nach dem Training: ' + (r.shake.at !== undefined ? r.shake.at : 10) + ' min nach Trainingsende, richtige Mahlzeit ' + (r.shake.mealAfter !== undefined ? r.shake.mealAfter : 30) + ' min später');
        Object.keys(SHAKE_DEF).forEach(function (cls) { var z = r.shake[cls] || SHAKE_DEF[cls]; L.push('  Shake ' + SHAKE_TXT[cls] + ': ' + z.c + ' g Carbs, ' + z.p + ' g Eiweiß' + (z.c <= 0 && z.p <= 0 ? ' (kein Shake)' : '')); });
      }
    }
    if (r.extra) r.extra.forEach(function (e) {
      var amt = function (z) { return [z.c > 0 ? z.c + ' g Carbs' : '', z.p > 0 ? z.p + ' g Eiweiß' : '', z.f > 0 ? z.f + ' g Fett' : ''].filter(Boolean).join(', ') || '0'; };
      var when = e.when === 'time' ? 'um ' + e.time + ' Uhr' + (e.trainingOnly ? ' (nur an Trainingstagen)' : '') : e.offset + ' min ' + (e.when === 'before' ? 'vor' : 'nach') + ' dem Training' + (e.minMin ? ', Einheiten ab ' + e.minMin + ' min' : '') + (e.maxMin ? ', bis ' + e.maxMin + ' min' : '');
      L.push('Zusatz „' + e.name + '“: ' + when + (e.c > 0 || e.p > 0 || e.f > 0 ? ': ' + amt(e) : ''));
      if (e.by) Object.keys(SHAKE_DEF).forEach(function (cls) { if (e.by[cls]) L.push('  ' + SHAKE_TXT[cls] + ': ' + amt(e.by[cls])); });
    });
    if (r.note) L.push('Notiz: ' + r.note);
    return L;
  }
  function shakeClass(x) {
    var lv = x.lv, m = x.s.min;
    return lv === 2 ? 'hard' : m >= 150 ? 'long' : lv === 1 ? 'mid' : 'easy';
  }
  function rulesPrompt(p) {
    var cur = normRules(p && p.rules).rules;
    var T0 = [];
    T0.push('Du hilfst mir, individuelle Ernährungsregeln für die App „Tankplan“ festzulegen. Tankplan plant Mahlzeiten und Makros rund um mein Radtraining. Ich beschreibe dir gleich in normalen Worten, was ich mit meinem Trainer abgesprochen habe. Du übersetzt das in einen Regelblock (JSON), den ich in Tankplan einfüge.');
    T0.push('');
    T0.push('## So antwortest du');
    T0.push('1. Stelle kurze Rückfragen, wenn etwas unklar ist (zum Beispiel welche Mahlzeit gemeint ist oder wie groß etwas sein soll). Rate keine Zahlen, die ich nicht genannt habe, außer ich bitte dich darum.');
    T0.push('2. Gib am Ende genau einen Codeblock mit dem vollständigen neuen Regelblock aus (alle Regeln, auch die schon bestehenden, die gelten sollen). Schreibe vor oder nach dem Block in ein bis drei Sätzen, was sich ändert.');
    T0.push('3. Verwende nur die unten genannten Einträge und Zahlenbereiche. Erfinde keine neuen Einträge.');
    T0.push('4. Du gibst keine medizinische Beratung. Wenn ein Wunsch extrem wirkt (zum Beispiel sehr wenige Kalorien oder Carbs), weise kurz darauf hin, dass das mit dem Trainer oder einer Ernährungsfachkraft abgeklärt werden sollte.');
    T0.push('');
    T0.push('## Was einstellbar ist (alle Einträge sind optional, nicht genannte bleiben im Standard)');
    T0.push('Die Tagessummen (Kalorien, Carbs, Eiweiß, Fett) bleiben gleich. Die Regeln verschieben nur, wie sie auf die Mahlzeiten verteilt werden.');
    T0.push('');
    T0.push('### meals: Verteilung je Mahlzeit');
    T0.push('Schlüssel: frueh (Frühstück), mittag, abend, snack, pre (Mahlzeit vor dem Training), post (Mahlzeit nach dem Training).');
    T0.push('Je Mahlzeit optional: "size" = Gesamtgröße der Mahlzeit als Faktor (0.3 bis 2.5, 1 = Standard, 1.3 = 30 % größer), "c" = Carbs-Faktor, "p" = Eiweiß-Faktor, "f" = Fett-Faktor (je 0.2 bis 3). Die Faktoren wirken zusätzlich zu "size". Beispiel: mehr Carbs und weniger Fett morgens: {"frueh": {"c": 1.4, "f": 0.6}}.');
    T0.push('Nur für snack zusätzlich: "on": true (Snack immer einplanen) oder false (nie einen Snack vorschlagen).');
    T0.push('');
    T0.push('### timing: Zeitabstände zum Training (ganze Minuten)');
    Object.keys(TIMING_TXT).forEach(function (k) { T0.push('- "' + k + '": ' + TIMING_TXT[k] + '. Bereich ' + TIMING_LIM[k][0] + ' bis ' + TIMING_LIM[k][1] + ', Standard ' + TIMING_DEF[k] + '.'); });
    T0.push('preEarliest muss mindestens 15 größer sein als preLatest. Tankplan nutzt vorrangig die Essenszeiten, die ich im Profil eingestellt habe, wenn sie in das Fenster zwischen preEarliest und preLatest passen.');
    T0.push('');
    T0.push('### shake: Shake direkt nach dem Training, danach richtige Mahlzeit');
    T0.push('- "on": true oder false. Nur wenn true, plant Tankplan nach dem Training zuerst einen Shake und danach eine richtige Mahlzeit.');
    T0.push('- "at": Minuten nach Trainingsende für den Shake (0 bis 60, Standard 10).');
    T0.push('- "mealAfter": Minuten nach dem Shake bis zur richtigen Mahlzeit (10 bis 180, Standard 30).');
    T0.push('- Größe des Shakes je Art der Einheit, jeweils {"c": Gramm Carbs (0 bis 200), "p": Gramm Eiweiß (0 bis 80)}: "easy" (lockere Einheit wie LIT, unter 150 min), "mid" (mittlere Intensität, zum Beispiel Tempo oder Sweetspot), "hard" (hart: Intervalle/HIT), "long" (sehr lang, ab 150 min, egal wie intensiv). Standard: easy 20/10, mid 50/25, hard 90/40, long 70/30. Mit {"c": 0, "p": 0} gibt es für diese Art keinen Shake.');
    T0.push('Die richtige Mahlzeit danach bekommt die restlichen Carbs und das restliche Eiweiß der Nach-Training-Menge.');
    T0.push('');
    T0.push('Optional "minMin": der Shake wird nur bei Einheiten ab dieser Länge in Minuten geplant (0 bis 600).');
    T0.push('');
    T0.push('### extra: eigene zusätzliche Mahlzeiten (Liste, höchstens 4)');
    T0.push('Damit fügst du Mahlzeiten hinzu, die Tankplan sonst nicht vorschlägt, zum Beispiel einen Recovery-Shake nach langen Einheiten oder ein Casein-Getränk am Abend. Die Mengen sind fest und werden von den Tagessummen abgezogen, die anderen Mahlzeiten behalten ihre Zeiten. (Anders als "shake": "shake" verschiebt zusätzlich die richtige Mahlzeit nach hinten. Nimm "extra", wenn nur etwas dazukommen soll.)');
    T0.push('Je Eintrag: "name" (kurzer Titel, bis 30 Zeichen), "when": "after" (nach dem Training, Standard), "before" (vor dem Training) oder "time" (feste Uhrzeit, dann zusätzlich "time": "21:30" und optional "trainingOnly": true für nur Trainingstage).');
    T0.push('Bei before/after: "offset" = Minuten nach Trainingsende bzw. vor Trainingsstart (after 0 bis 240, Standard 10; before 5 bis 240, Standard 30), optional "minMin" und "maxMin" = nur Einheiten mit mindestens bzw. höchstens so vielen Minuten Dauer.');
    T0.push('Menge: entweder fest "c", "p", "f" (Gramm Carbs bis 200, Eiweiß bis 80, Fett bis 60) oder je Einheitenart in "by": {"easy": {...}, "mid": {...}, "hard": {...}, "long": {...}} mit jeweils c, p und f. Fehlt eine Art in "by", gibt es für diese Art nichts (außer feste c/p/f sind zusätzlich angegeben). Beispiel „Recovery-Shake nach Einheiten über 60 Minuten, locker 30 g Carbs, hart 90 g Carbs“: {"name": "Recovery Shake", "when": "after", "offset": 10, "minMin": 61, "by": {"easy": {"c": 30, "p": 10}, "mid": {"c": 60, "p": 20}, "hard": {"c": 90, "p": 30}, "long": {"c": 70, "p": 25}}}. Wenn ich nicht gesagt habe, wie viel Eiweiß, frage nach oder schlage einen Wert vor und sage, dass er von dir kommt.');
    T0.push('');
    T0.push('### note: kurzer Freitext (höchstens 300 Zeichen), zum Beispiel „mit Trainer besprochen am 4.11.“. Er ändert nichts an der Berechnung.');
    T0.push('');
    T0.push('## Format');
    T0.push('Der Block ist gültiges JSON mit dem Eintrag "v": 1. Beispiel (nur zur Veranschaulichung, kein Vorschlag):');
    T0.push('```json');
    T0.push(JSON.stringify({ v: 1, note: 'Beispiel', meals: { frueh: { c: 1.3, f: 0.7 }, mittag: { size: 1.2 }, snack: { on: false } }, timing: { preOffset: 45, postDelay: 20 }, shake: { on: true, at: 10, mealAfter: 30, easy: { c: 20, p: 10 }, hard: { c: 90, p: 40 } }, extra: [{ name: 'Abend-Casein', when: 'time', time: '21:30', c: 0, p: 25, f: 0 }] }, null, 2));
    T0.push('```');
    T0.push('');
    T0.push('## Mein Profil (zur Einordnung)');
    if (p) T0.push('Gewicht ' + p.w + ' kg, Größe ' + p.h + ' cm, Alter ' + p.a + ', Ziel: ' + ({ lose: 'Abnehmen', keep: 'Halten', gain: 'Aufbauen' }[p.goal] || p.goal) + '. Essenszeiten: Frühstück ' + ((p.mt && p.mt.b) || DEF_MT.b) + ', Mittag ' + ((p.mt && p.mt.l) || DEF_MT.l) + ', Abend ' + ((p.mt && p.mt.d) || DEF_MT.d) + ', Snack ' + ((p.mt && p.mt.s) || DEF_MT.s) + '.');
    T0.push('');
    T0.push('## Meine aktuellen Regeln');
    if (cur) { T0.push('```json'); T0.push(JSON.stringify(cur, null, 2)); T0.push('```'); }
    else T0.push('Noch keine. Es gelten die Tankplan-Standards.');
    T0.push('');
    T0.push('## Meine Wünsche');
    T0.push('(Hier beschreibe ich gleich in eigenen Worten, was angepasst werden soll.)');
    return T0.join('\n');
  }

  function trainWin(t) {
    return t.info.filter(function (x) { return !isCommute(x); }).map(function (x) {
      var st = tmin(x.s.tm), assumed = st === null;
      if (assumed) st = 17 * 60;
      return { x: x, st: st, en: st + x.s.min, assumed: assumed, big: x.preWhen.charAt(0) === '2' };
    }).sort(function (a, b) { return a.st - b.st; });
  }
  function guessKind(m, trs) {
    if (m === null || m === undefined) return 'snack';
    for (var i = 0; i < trs.length; i++) {
      var q = trs[i];
      if (q.assumed) continue;
      if (m > q.st && m < q.en) return 'during';
      if (m >= q.st - 210 && m <= q.st) return 'pre';
      if (m >= q.en && m <= q.en + 120) return 'post';
    }
    return m < 630 ? 'frueh' : m < 870 ? 'mittag' : m < 1050 ? 'snack' : 'abend';
  }
  function focusText(s, t) {
    var r = s.role || s.kind;
    if (s.kind === 'during') return s.q.x.gph ? s.q.x.gph + ' g Carbs pro Stunde, alle 15 bis 20 Minuten etwas: Gel, Riegel oder Sportgetränk.' : 'Wasser reicht.';
    if (r === 'pre') return 'Gut verdaulich: wenig Fett, wenige Ballaststoffe, kaum Gemüse. Banane, Weißbrot, Reis oder Haferbrei passen.';
    if (r === 'post') return 'Carbs und Eiweiß zusammen, dazu Obst. Gemüse darf dabei sein, aber Carbs und Eiweiß haben Vorrang.';
    if (s.kind === 'frueh') return 'Carbs mit Eiweiß, dazu Obst. Vollkorn ist hier gut.';
    if (s.kind === 'snack') return 'Obst oder Gemüsesticks, dazu Quark oder Joghurt.';
    if (s.kind === 'mittag') return 'Schwerpunkt Gemüse und Salat, dazu Carbs und Eiweiß.';
    return t.note ? 'Carbs betonen für morgen. Gemüse in Maßen, damit der Magen nicht zu voll ist.' : 'Schwerpunkt Gemüse, dazu Eiweiß. Carbs nach Bedarf.';
  }

  function mealPlan(p, t, mtIn, day) {
    var mt = {};
    Object.keys(DEF_MT).forEach(function (k) { mt[k] = (mtIn && mtIn[k]) || DEF_MT[k]; });
    var trs = trainWin(t);
    var R = normRules(p && p.rules).rules || {}, TM = Object.assign({}, TIMING_DEF, R.timing || {});
    /* Faktor aus den Regeln für eine Mahlzeit (Art und Rolle) und Makro c/p/f */
    function rmul(s, key) {
      var m = 1, rs = R.meals || {};
      [s.kind, s.role && s.role !== s.kind ? s.role : null].forEach(function (k) { var o = k && rs[k]; if (o) m *= (o.size || 1) * (o[key] || 1); });
      return m;
    }
    /* Essenspause (z. B. Schule 14:15 bis 15:45): dort wird keine Mahlzeit vorgeschlagen */
    var blk = null, bf = mtIn ? tmin(mtIn.nf) : null, bt = mtIn ? tmin(mtIn.nt) : null;
    if (bf !== null && bt !== null && bt > bf) {
      var wd = day ? parseDay(day).getDay() : -1;
      if (!(mtIn.nw === '1' && (wd === 0 || wd === 6))) blk = { a: bf, b: bt };
    }
    function inBlk(m) { return !!blk && m > blk.a && m < blk.b; }
    function freeAt(at, lo, hi) {
      if (!inBlk(at)) return at;
      var c = [];
      if (blk.a >= lo && blk.a <= hi) c.push(blk.a);
      if (blk.b >= lo && blk.b <= hi) c.push(blk.b);
      if (!c.length) return at;
      c.sort(function (x, y) { return Math.abs(x - at) - Math.abs(y - at); });
      return c[0];
    }
    /* Feste Anker sind die eingestellten Essenszeiten, auch der Snack. Sie werden nur verschoben, wenn sie mitten ins Training fallen. */
    var base = [
      { id: 'b', kind: 'frueh', at: tmin(mt.b), w: 0.3 },
      { id: 'l', kind: 'mittag', at: tmin(mt.l), w: 0.35 },
      { id: 'd', kind: 'abend', at: tmin(mt.d), w: 0.35 }
    ];
    var cms = t.info.filter(function (x) { return isCommute(x) && tmin(x.s.tm) !== null; }).map(function (x) { var st0 = tmin(x.s.tm); return { st: st0, en: st0 + x.s.min, c: x.carbs }; });
    var snT = tmin(mt.s);
    var snAfterCm = snT !== null && cms.some(function (m) { return snT >= m.en && snT - m.en <= 90; });
    var snOn = R.meals && R.meals.snack ? R.meals.snack.on : undefined;
    var snack = snOn !== false && (snOn === true || t.c >= 450 || trs.length || snAfterCm) && snT !== null ? { id: 's', kind: 'snack', at: snT, w: 0.15 } : null;
    if (snack) base.push(snack);
    trs.forEach(function (q) {
      var pref = q.st - (q.big ? TM.preOffsetBig : TM.preOffset), best = null;
      if (!q.preSlot) base.forEach(function (b) {
        if (b.role || inBlk(b.at) || b.at < q.st - TM.preEarliest || b.at > q.st - TM.preLatest) return;
        if (!best || Math.abs(b.at - pref) < Math.abs(best.at - pref)) best = b;
      });
      if (best) { best.role = 'pre'; best.q = q; q.preSlot = best; }
      base.forEach(function (b) {
        if (b.role) return;
        if (b.at > q.st - TM.preLatest && b.at < q.en) b.at = q.en + TM.postDelay;
        if (b.at >= q.en && b.at <= q.en + TM.postWindow && !q.postSlot) { b.role = 'post'; b.q = q; q.postSlot = b; }
      });
    });
    var all = base.slice();
    trs.forEach(function (q, i) {
      if (!q.preSlot) all.push({ id: 'pre' + i, kind: 'pre', role: 'pre', q: q, at: freeAt(q.st - (q.big ? TM.preOffsetBig : TM.preOffset), q.st - TM.preEarliest, q.st - TM.preLatest) });
      if (q.x.during > 0) all.push({ id: 'dur' + i, kind: 'during', q: q, at: q.st, c: q.x.during });
      if (!q.postSlot) all.push({ id: 'post' + i, kind: 'post', role: 'post', q: q, at: freeAt(q.en + TM.postDelay, q.en, q.en + Math.max(120, TM.postDelay + 30)) });
    });
    if (blk) all.forEach(function (s) {
      if (s.kind === 'during' || !inBlk(s.at)) return;
      s.at = s.role === 'pre' ? freeAt(s.at, s.q.st - TM.preEarliest, s.q.st - TM.preLatest) : blk.b;
    });
    if (snack && !snack.role) {
      var near = all.some(function (s) { return s !== snack && Math.abs(s.at - snack.at) < 75; });
      var inTr = trs.some(function (q) { return snack.at > q.st - 45 && snack.at < q.en + 30; });
      if (inTr || (snOn !== true && ((t.c < 450 && !snAfterCm) || near))) all.splice(all.indexOf(snack), 1);
    }

    /* Shake direkt nach dem Training, danach die richtige Mahlzeit (nur mit Regel shake.on) */
    var shakeP = 0;
    if (R.shake && R.shake.on) {
      var shAt = R.shake.at !== undefined ? R.shake.at : 10, shAfter = R.shake.mealAfter !== undefined ? R.shake.mealAfter : 30;
      trs.forEach(function (q, i) {
        var cls = shakeClass(q.x), sz = R.shake[cls] || SHAKE_DEF[cls], post = null;
        if (R.shake.minMin && q.x.s.min < R.shake.minMin) return;
        if (!sz || (sz.c <= 0 && sz.p <= 0)) return;
        all.forEach(function (s) { if (s.role === 'post' && s.q === q) post = s; });
        if (!post) return;
        var sat = q.en + shAt;
        var wantAt = q.en + shAt + shAfter;
        if (!q.postSlot) post.at = freeAt(wantAt, q.en, wantAt + 60);
        else if (post.at < wantAt) post.at = wantAt;
        if (inBlk(post.at)) post.at = blk.b;
        if (post.at - sat < 20) return;
        if (inBlk(sat)) { if (blk.b < post.at - 10) sat = blk.b; else return; }
        post.afterShake = { c: sz.c, p: sz.p };
        all.push({ id: 'shk' + i, kind: 'shake', q: q, at: sat, c: sz.c, p: sz.p, shake: true });
        shakeP += sz.p;
      });
    }
    /* Zusatz-Mahlzeiten aus den Regeln (zum Beispiel Recovery Shake): feste Mengen, werden von den Tagessummen abgezogen */
    var extraP = 0, extraF = 0;
    (R.extra || []).forEach(function (ex, ei) {
      function put(id, at, c, pp, ff, q) {
        if (c <= 0 && pp <= 0 && ff <= 0) return;
        if (inBlk(at)) { at = freeAt(at, at - 30, at + 30); if (inBlk(at)) at = ex.when === 'before' ? blk.a : blk.b; }
        all.push({ id: id, kind: 'extra', extra: true, name: ex.name, when: ex.when, q: q, at: at, c: c, p: pp, f: ff });
        extraP += pp; extraF += ff;
      }
      if (ex.when === 'time') {
        if (ex.trainingOnly && !trs.length) return;
        put('ex' + ei, tmin(ex.time), ex.c || 0, ex.p || 0, ex.f || 0, null);
        return;
      }
      trs.forEach(function (q, i) {
        var m = q.x.s.min;
        if ((ex.minMin && m < ex.minMin) || (ex.maxMin && m > ex.maxMin)) return;
        var z = ex.by && ex.by[shakeClass(q.x)] ? ex.by[shakeClass(q.x)] : (ex.by ? null : { c: ex.c || 0, p: ex.p || 0, f: ex.f || 0 });
        if (!z && ex.by && (ex.c > 0 || ex.p > 0 || ex.f > 0)) z = { c: ex.c || 0, p: ex.p || 0, f: ex.f || 0 };
        if (!z) return;
        put('ex' + ei + '_' + i, ex.when === 'before' ? q.st - ex.offset : q.en + ex.offset, z.c, z.p, z.f, q);
      });
    });
    var fixed = 0;
    all.forEach(function (s) {
      if (s.role === 'pre') s.c = s.q.x.pre * rmul(s, 'c');
      else if (s.role === 'post') s.c = Math.max(0, s.q.x.post * rmul(s, 'c') - (s.afterShake ? s.afterShake.c : 0));
      if (s.role || s.kind === 'during' || s.kind === 'shake' || s.kind === 'extra') fixed += s.c;
    });
    var CW = { pre: 0.1, post: 0.5, frueh: 0.3, mittag: 0.35, abend: 0.35, snack: 0.15 };
    var recv = all.filter(function (s) { return s.kind !== 'during' && s.kind !== 'shake' && s.kind !== 'extra'; });
    /* Carbs der Pendelfahrt: in die Mahlzeit direkt danach (bis 90 min), sonst in die letzte davor (bis 3 h), sonst in die nächste danach */
    var cmTotal = 0;
    cms.forEach(function (m) {
      var bef = null, aft = null, aft90 = null;
      recv.forEach(function (s) {
        if (s.at <= m.st + 15) { if (m.st - s.at <= 180 && (!bef || s.at > bef.at)) bef = s; }
        else if (s.at >= m.en) {
          if (s.at - m.en <= 240 && (!aft || s.at < aft.at)) aft = s;
          if (s.at - m.en <= 90 && (!aft90 || s.at < aft90.at)) aft90 = s;
        }
      });
      var tg = aft90 || bef || aft;
      if (!tg) return;
      (tg.cm = tg.cm || []).push({ at: m.st, c: m.c, after: tg.at >= m.en });
      tg.cmC = (tg.cmC || 0) + m.c; cmTotal += m.c;
    });
    var L = Math.max(0, t.c - fixed - cmTotal);
    var wsum = recv.reduce(function (acc, s) { return acc + CW[s.role || s.kind] * rmul(s, 'c'); }, 0) || 1;
    recv.forEach(function (s) { s.c = (s.c || 0) + (s.cmC || 0) + L * CW[s.role || s.kind] * rmul(s, 'c') / wsum; });
    var elig = all.filter(function (s) { return s.kind !== 'during' && s.kind !== 'shake' && s.kind !== 'extra'; });
    function spread(total, table, key) {
      var ws = elig.map(function (s) { return table[s.role || s.kind] * ((key === 'p' || key === 'f') ? rmul(s, key) : 1); });
      var sum = ws.reduce(function (a, b) { return a + b; }, 0) || 1;
      elig.forEach(function (s, i) { s[key] = total * ws[i] / sum; });
    }
    spread(Math.max(0, t.p - shakeP - extraP), PW, 'p'); spread(Math.max(0, t.f - extraF), FW, 'f'); spread(GOALS.veg, VW, 'veg'); spread(GOALS.fruit, OW, 'fruit');
    elig.forEach(function (s) { if (s.role === 'post') s.p = Math.max(s.p, Math.max(0, s.q.x.postP - (s.afterShake ? s.afterShake.p : 0))); });
    all.forEach(function (s) {
      s.p = s.p || 0; s.f = s.f || 0; s.veg = s.veg || 0; s.fruit = s.fruit || 0;
      s.kcal = 4 * s.c + 4 * s.p + 9 * s.f;
      s.time = tfmt(s.at);
      s.label = KINDS[s.kind] + (s.role && s.kind !== s.role ? ' · ' + (s.role === 'pre' ? 'vor dem Training' : 'nach dem Training') : '');
      if (s.kind === 'shake') s.label = 'Shake · nach dem Training';
      if (s.kind === 'extra') s.label = s.name;
      if (s.q) {
        s.assumed = s.q.assumed;
        var ty = s.q.x.s.type;
        s.rel = s.kind === 'extra' ? (s.when === 'before' ? hmText(s.q.st - s.at) + ' vor ' + ty : hmText(s.at - s.q.en) + ' nach ' + ty) : s.kind === 'shake' ? hmText(s.at - s.q.en) + ' nach ' + ty : s.role === 'pre' ? hmText(s.q.st - s.at) + ' vor ' + ty : s.role === 'post' ? hmText(s.at - s.q.en) + ' nach ' + ty : ty + ', ' + s.q.x.s.min + ' min';
      }
      s.focus = s.kind === 'extra' ? 'Eigene Zusatz-Mahlzeit aus deinen Regeln. Die Mengen sind von den Tagessummen abgezogen.' : s.kind === 'shake' ? 'Flüssig und schnell verdaulich: Carbs und Eiweiß, wenig Fett und Ballaststoffe.' : focusText(s, t);
      if (s.afterShake) s.focus += ' Das ist die richtige Mahlzeit nach dem Shake.';
      if (s.cm) s.cm.forEach(function (m) { s.focus += ' Enthält ' + r0(m.c) + ' g Carbs ' + (m.after ? 'zum Auffüllen nach der' : 'für die') + ' Pendelfahrt um ' + tfmt(m.at) + '.'; });
    });
    all.sort(function (a, b) { return a.at - b.at; });
    return all.map(function (s) { var o = {}; Object.keys(s).forEach(function (k) { if (k !== 'q') o[k] = s[k]; }); return o; });
  }

  function matchMeals(slots, meals, t) {
    var trs = trainWin(t);
    var res = slots.map(function (s) { return { s: s, items: [], inst: 0 }; }), extra = [], more = {}, keyOf = {}, cnt = {};
    res.forEach(function (r) { var k = r.s.kind; cnt[k] = (cnt[k] || 0) + 1; r.inst = cnt[k]; });
    meals.forEach(function (m) {
      var mm = tmin(m.t), kind = slotKind(m.slot) || guessKind(mm, trs), inst = slotInst(m.slot), best = -1, bd = 1e9;
      if (inst) {
        res.forEach(function (r, i) { if (r.s.kind === kind && r.inst === inst) best = i; });
        if (best < 0) {
          var key = kind + '#' + inst;
          if (!more[key]) more[key] = { kind: kind, inst: inst, key: key, label: slotLabel(kind, inst), items: [] };
          more[key].items.push(m); keyOf[m.id] = key; return;
        }
      } else {
        res.forEach(function (r, i) {
          if (r.s.kind === kind || r.s.role === kind) {
            var d = mm === null ? 0 : Math.abs(r.s.at - mm);
            if (d < bd) { bd = d; best = i; }
          }
        });
      }
      if (best >= 0) { res[best].items.push(m); keyOf[m.id] = res[best].s.kind + '#' + res[best].inst; } else extra.push(m);
    });
    var moreList = Object.keys(more).map(function (k) { return more[k]; });
    moreList.forEach(function (g) {
      var best = null; g.items.forEach(function (m) { var x = tmin(m.t); if (x !== null && (best === null || x < best)) best = x; });
      g.at = best === null ? 9999 : best; g.time = best === null ? '' : tfmt(best);
    });
    moreList.sort(function (a, b) { return a.at - b.at; });
    return { slots: res, extra: extra, more: moreList, keyOf: keyOf };
  }

  function relLabel(tm, sess) {
    var m = tmin(tm);
    if (m === null) return '';
    var best = null;
    sess.forEach(function (s) {
      var st = tmin(s.tm);
      if (st === null) return;
      var en = st + s.min, txt = null, d = 0;
      if (m < st && st - m <= 300) { d = st - m; txt = hmText(d) + ' vor ' + s.type; }
      else if (m >= st && m <= en) { d = 0; txt = 'während ' + s.type; }
      else if (m > en && m - en <= 240) { d = m - en; txt = hmText(d) + ' nach ' + s.type; }
      if (txt && (best === null || d < best.d)) best = { d: d, t: txt };
    });
    return best ? best.t : '';
  }

  function fuelCheck(rows) {
    var r = { n: 0, pre: 0, post: 0 };
    rows.forEach(function (row) {
      if (!row.n) return;
      row.sess.forEach(function (s, i) {
        if (s.src !== 'act' || !s.tm || s.lv < 1 || s.min < 45) return;
        var x = row.t.info[i], st = tmin(s.tm), en = st + s.min, pre = 0, post = 0;
        row.meals.forEach(function (m) {
          var mm = tmin(m.t);
          if (mm === null) return;
          if (mm >= st - 240 && mm <= st - 30) pre += m.c;
          if (mm >= en - 10 && mm <= en + 120) post += m.c;
        });
        r.n++;
        if (pre >= 0.6 * x.pre) r.pre++;
        if (post >= 0.6 * x.post) r.post++;
      });
    });
    return r;
  }
  function fuelTiles(rows) {
    var f = fuelCheck(rows);
    if (!f.n) return '';
    return tile('Essen vor dem Training', f.pre + ' von ' + f.n, 'Carbs 0,5 bis 4 h davor') + tile('Essen danach', f.post + ' von ' + f.n, 'Carbs bis 2 h danach');
  }

  /* ---------- Alltag, Gruppen, Diagramme, Tagesauswertung, Etiketten ---------- */
  var PAL = { 1: 1.2, 2: 1.28, 3: 1.36, 4: 1.48, 5: 1.62 };
  var LVL_NAME = { 1: 'Sehr ruhig', 2: 'Ruhig', 3: 'Normal', 4: 'Aktiv', 5: 'Sehr aktiv' };
  var LVL_DESC = {
    1: 'Fast nur Sitzen oder Liegen, zum Beispiel Krankheits- oder Reisetag. Unter 3.000 Schritte.',
    2: 'Überwiegend sitzend, wenige Wege. Etwa 3.000 bis 6.000 Schritte.',
    3: 'Normaler Alltag mit Büro, Wegen und etwas Bewegung. Etwa 6.000 bis 9.000 Schritte.',
    4: 'Viel auf den Beinen, zum Beispiel stehende Arbeit oder lange Spaziergänge. Etwa 9.000 bis 13.000 Schritte.',
    5: 'Körperlich fordernde Arbeit oder ein Tag unterwegs, Wandern, Umzug. Über 13.000 Schritte.'
  };
  function nowMinutes() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  function groupMeals(meals, trs) {
    var arr = meals.map(function (m) { return { m: m, t: tmin(m.t), kind: slotKind(m.slot) || guessKind(tmin(m.t), trs), inst: slotInst(m.slot) }; });
    arr.sort(function (a, b) { return (a.t === null ? 9999 : a.t) - (b.t === null ? 9999 : b.t); });
    var groups = [];
    arr.forEach(function (x) {
      var g = null;
      for (var i = groups.length - 1; i >= 0; i--) {
        if (groups[i].kind === x.kind && groups[i].inst === x.inst && (x.inst > 0 || (x.t !== null && groups[i].t !== null && Math.abs(x.t - groups[i].t) <= 60))) { g = groups[i]; break; }
      }
      if (!g) { g = { kind: x.kind, inst: x.inst, label: slotLabel(x.kind, x.inst), t: x.t, time: x.m.t || '', items: [], c: 0, p: 0, f: 0, kcal: 0 }; groups.push(g); }
      g.items.push(x.m); g.c += x.m.c; g.p += x.m.p; g.f += x.m.f; g.kcal += x.m.kcal;
    });
    return groups;
  }

  function pieSvg(c, p, f, size) {
    var v = [4 * c, 4 * p, 9 * f], tot = v[0] + v[1] + v[2], cols = ['var(--carb)', 'var(--prot)', 'var(--fat)'];
    var pc = tot > 0 ? v.map(function (x) { return r0(x / tot * 100); }) : [0, 0, 0];
    var s = '<svg class="pie" viewBox="0 0 36 36" width="' + (size || 46) + '" height="' + (size || 46) + '" role="img" aria-label="Kalorienanteile: Carbs ' + pc[0] + ' Prozent, Eiweiß ' + pc[1] + ' Prozent, Fett ' + pc[2] + ' Prozent">';
    if (tot <= 0) return s + '<circle cx="18" cy="18" r="16" fill="var(--track)"/></svg>';
    var a0 = -Math.PI / 2;
    v.forEach(function (x, i) {
      if (x <= 0) return;
      var frac = x / tot;
      if (frac > 0.9999) { s += '<circle cx="18" cy="18" r="16" fill="' + cols[i] + '"/>'; return; }
      var a1 = a0 + frac * 2 * Math.PI;
      var x0 = 18 + 16 * Math.cos(a0), y0 = 18 + 16 * Math.sin(a0), x1 = 18 + 16 * Math.cos(a1), y1 = 18 + 16 * Math.sin(a1);
      s += '<path d="M18 18 L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A16 16 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + cols[i] + '"/>';
      a0 = a1;
    });
    return s + '</svg>';
  }
  function pieCaption(c, p, f) {
    var tot = 4 * c + 4 * p + 9 * f;
    if (!(tot > 0)) return '';
    return r0(4 * c / tot * 100) + ' / ' + r0(4 * p / tot * 100) + ' / ' + r0(9 * f / tot * 100) + ' %';
  }
  function pieLegend() {
    return '<div class="legend"><span><i class="lc"></i>Carbs</span><span><i class="lp"></i>Eiweiß</span><span><i class="lf"></i>Fett</span><span class="note">Kuchen: Anteile an den Kalorien</span></div>';
  }


  /* ---------- Geschätzter Blutzucker (Modell, keine Messung) ---------- */
  var GL = { base: 90, tau: 60, kappa: 1.9, low: 70, warn: 80, high: 170 };
  function glucoseSim(meals, sessions) {
    var n = 1440, A = [], AB = [], burn = [], i, t;
    for (i = 0; i < n; i++) { A.push(0); AB.push(0); burn.push(0); }
    meals.forEach(function (m) {
      if (m.t === null || m.t === undefined || !(m.c > 0)) return;
      var ce = m.c / (1 + 0.012 * m.f + 0.03 * (m.fi || 0) + 0.004 * m.p), mean = 45 + 0.6 * m.f + 1.5 * (m.fi || 0), th = mean / 2;
      for (t = Math.round(m.t); t < n; t++) {
        var x = t - m.t + 0.5, pdf = x / (th * th) * Math.exp(-x / th);
        A[t] += GL.kappa * ce * pdf; AB[t] += m.c * pdf;
      }
    });
    sessions.forEach(function (x) { for (t = Math.max(0, x.st); t < Math.min(n, x.en); t++) burn[t] += x.gph / 60; });
    var E = 0, D = 0, pts = [];
    for (t = 0; t < n; t++) {
      E += -E / GL.tau + A[t];
      D = Math.max(0, D + burn[t] - AB[t] - (D > 0 ? 0.15 : 0));
      var drop = Math.min(45, 0.35 * Math.max(0, D - 25));
      pts.push({ m: t, g: Math.max(40, GL.base + E - drop), d: D });
    }
    return pts;
  }
  function glucoseOf(row, upTo) {
    var sess = [];
    row.sess.forEach(function (x, i) {
      var st = tmin(x.tm), inf = row.t && row.t.info ? row.t.info[i] : null;
      if (st === null || !inf) return;
      sess.push({ st: st, en: st + x.min, gph: inf.carbs / (x.min / 60) });
    });
    var act = row.groups.map(function (g) {
      var fi = 0; g.items.forEach(function (m) { fi += m.fi || 0; });
      return { t: g.t, c: g.c, p: g.p, f: g.f, fi: fi };
    });
    var pl = row.mp.map(function (s) { return { t: s.at, c: s.c, p: s.p, f: s.f, fi: 0 }; });
    var a = glucoseSim(act, sess), p = glucoseSim(pl, sess);
    return { actual: a, plan: p, sess: sess };
  }
  function glucoseLevel(g) { return g < GL.low ? 'c' : g < GL.warn ? 'w' : g > GL.high ? 'h' : 'o'; }
  function glucoseWindows(pts, sess, trainInfo) {
    var out = [], cur = null;
    pts.forEach(function (p) {
      var lv = glucoseLevel(p.g);
      if (lv === 'c') { if (!cur) cur = { from: p.m, to: p.m, min: p.g }; cur.to = p.m; cur.min = Math.min(cur.min, p.g); }
      else if (cur) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
    return out.filter(function (w) { return w.to - w.from >= 10; }).map(function (w) {
      var s = null;
      sess.forEach(function (x) { if (w.from >= x.st && w.from <= x.en + 300) s = x; });
      w.afterTraining = !!s; w.sess = s;
      return w;
    });
  }
  function glucoseNote(row, upTo) {
    var g = glucoseOf(row), pts = g.actual.filter(function (p) { return p.m <= upTo; });
    var ws = glucoseWindows(pts, g.sess), h = '';
    if (!ws.length) return '<p class="note">Blutzucker (Modellschätzung): kein kritischer Bereich erkennbar.</p>';
    ws.forEach(function (w) {
      h += '<div class="alert gl-alert">Geschätzter Blutzucker zwischen ' + hm(w.from) + ' und ' + hm(w.to) + ' Uhr kritisch (Tiefpunkt etwa ' + r0(w.min) + ' mg/dL). ' + (w.afterTraining ? 'Während oder nach dem Training kam zu wenig Kohlenhydrat nach. Plane etwa 30 bis 60 Minuten nach dem Ende eine Mahlzeit mit 60 bis 100 g Carbs ein und bei langen Einheiten 40 bis 60 g Carbs pro Stunde unterwegs.' : 'Zu lange ohne Kohlenhydrate. Eine kleine Mahlzeit mit Carbs würde das auffangen.') + '</div>';
    });
    return h;
  }

  /* ---------- Geschätzter Zuckerspiegel (Modell, kein Messwert) ---------- */
  var GLOW = 65, GWARNLOW = 75, GHIGH = 150;
  /* Tagesgang des Nüchternwertes: leichtes Minimum gegen 4 Uhr, Anstieg am frühen Morgen (Dawn-Effekt) */
  var GBASE_PTS = [[0, 90], [120, 87], [240, 83], [360, 86], [450, 91], [600, 89], [900, 88], [1200, 88], [1440, 90]];
  function baseG(t) {
    for (var i = 1; i < GBASE_PTS.length; i++) {
      if (t <= GBASE_PTS[i][0]) {
        var a = GBASE_PTS[i - 1], b = GBASE_PTS[i], f = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * (1 - Math.cos(Math.PI * f)) / 2;
      }
    }
    return 90;
  }
  function glucoseCurve(sess, infos, meals, upTo) {
    var out = [];
    var ms = meals.filter(function (m) { return m.at !== null && m.at !== undefined && m.c > 0; }).map(function (m) {
      var eff = m.c / (1 + (m.f + 0.5 * m.p) / 70 + (m.fi || 0) / 15);
      return { t0: m.at, c: m.c, A: 0.6 * eff, tp: 35 + Math.min(45, m.f + 0.3 * m.p) };
    });
    var ex = sess.map(function (x) {
      var st = tmin(x.tm); if (st === null) return null;
      var en = st + x.min, lv = x.lv || 0, dur = x.min, dc = 0, pre = 0;
      ms.forEach(function (m) { if (m.t0 > st && m.t0 < en) dc += m.c; if (m.t0 >= st - 90 && m.t0 <= st - 10) pre += m.A; });
      return { st: st, en: en, lv: lv, dur: dur, dc: dc, pre: pre };
    }).filter(Boolean);
    function exEffect(e, t) {
      var tau = Math.min(t, e.en) - e.st, dur = e.dur;
      var depth = [8, 12, 9][e.lv] * Math.min(1.5, dur / 60);
      var need = 30 * dur / 60, sup = Math.min(1, e.dc / need);
      var v = -depth * (1 - Math.exp(-tau / 45));
      if (e.lv >= 1) v += [0, 8, 20][e.lv] * (tau / 12) * Math.exp(1 - tau / 12);
      if (tau > 90) v -= Math.min(30, 12 * (tau - 90) / 60) * (1 - sup);
      v -= 0.25 * e.pre * (tau / 15) * Math.exp(1 - tau / 15) * (tau < 75 ? 1 : 0);
      return t > e.en ? v * Math.exp(-(t - e.en) / 45) : v;
    }
    var end = upTo === null || upTo === undefined ? 1440 : Math.min(1440, upTo);
    for (var t = 0; t <= end; t += 5) {
      var g = baseG(t), base = g;
      ms.forEach(function (m) { if (t > m.t0) { var x = (t - m.t0) / m.tp; g += m.A * x * Math.exp(1 - x); } });
      var rise = g - base;
      if (rise > 35) rise = 35 + 45 * (1 - Math.exp(-(rise - 35) / 45));
      g = base + rise;
      ex.forEach(function (e) { if (t > e.st) g += exEffect(e, t); });
      out.push({ t: t, g: Math.max(45, Math.min(200, g)) });
    }
    return out;
  }
  /* Einheit, zu der eine Aufnahme zur Uhrzeit t gehört (Carbs beim Training verteilen sich über die ganze Einheit) */
  function sessFor(row, t, isDuring) {
    var best = null, bd = 1e9;
    row.sess.forEach(function (x) {
      var a0 = tmin(x.tm); if (a0 === null || t === null || t === undefined) return;
      var en = a0 + x.min;
      if (t > a0 && t < en) { best = { st: a0, en: en }; bd = -1; }
      else if (isDuring && bd >= 0) { var d = Math.min(Math.abs(t - a0), Math.abs(t - en)); if (d < bd && d <= 90) { bd = d; best = { st: a0, en: en }; } }
    });
    return best;
  }
  function spread(m, w) {
    var n = Math.max(1, Math.round((w.en - w.st) / 10)), out = [];
    for (var i = 0; i < n; i++) out.push({ at: w.st + (i + 0.5) * (w.en - w.st) / n, c: m.c / n, p: m.p / n, f: m.f / n, fi: (m.fi || 0) / n });
    return out;
  }
  function glucoseOf(row, kind, nowM) {
    var meals = [];
    if (kind === 'plan') row.mp.forEach(function (s) {
      var m = { at: s.at, c: s.c, p: s.p, f: s.f, fi: 0 };
      if (s.kind === 'during' && s.q) meals = meals.concat(spread(m, { st: s.q.st, en: s.q.en })); else meals.push(m);
    });
    else row.meals.forEach(function (x) {
      var tm = tmin(x.t), m = { at: tm, c: +x.c || 0, p: +x.p || 0, f: +x.f || 0, fi: +x.fi || 0 };
      var w = sessFor(row, tm, slotKind(x.slot) === 'during');
      if (w) meals = meals.concat(spread(m, w)); else meals.push(m);
    });
    (row.pm || []).forEach(function (x) {
      var tm = tmin(x.t); if (tm === null || tm < 1020) return;
      meals.push({ at: tm - 1440, c: +x.c || 0, p: +x.p || 0, f: +x.f || 0, fi: +x.fi || 0 });
    });
    return glucoseCurve(row.sess, row.t.info, meals, kind === 'ist' ? nowM : null);
  }
  function glucoseLow(curve) {
    for (var i = 0; i < curve.length - 1; i++) if (curve[i].g < GLOW && curve[i + 1].g < GLOW) return curve[i].t;
    return null;
  }

  var CH = { full: false, rows: {} };
  function chartWindow(row, full) {
    if (full) return [0, 1440];
    var lo = 300, hi = 1380, ts = [];
    row.groups.forEach(function (g) { if (g.t !== null) ts.push(g.t); });
    row.mp.forEach(function (p) { if (p.kind !== 'during' && p.at !== null && p.at !== undefined) ts.push(p.at); });
    row.sess.forEach(function (x) { var a0 = tmin(x.tm); if (a0 !== null) { ts.push(a0); ts.push(Math.min(1440, a0 + x.min)); } });
    ts.forEach(function (t) { if (t < lo) lo = Math.floor((t - 20) / 60) * 60; if (t > hi) hi = Math.ceil((t + 20) / 60) * 60; });
    return [Math.max(0, lo), Math.min(1440, hi)];
  }
  function dayChartSvg(row, o) {
    o = o || {};
    var wide = !!o.wide, win = chartWindow(row, o.full), t0 = win[0], t1 = win[1];
    var W = wide ? 760 : 360, H = wide ? 340 : 300, L = wide ? 40 : 32, R = wide ? 44 : 30, TP = 18, BT = 26, pw = W - L - R, ph = H - TP - BT;
    var plan = row.mp.filter(function (s) { return s.kind !== 'during'; });
    var mx = 40;
    row.groups.forEach(function (g) { mx = Math.max(mx, g.c + g.p + g.f); });
    plan.forEach(function (s) { mx = Math.max(mx, s.c + s.p + s.f); });
    mx = Math.ceil(mx / 50) * 50;
    function X(m) { return (L + pw * (Math.max(t0, Math.min(t1, m)) - t0) / (t1 - t0)).toFixed(1); }
    function Y(v) { return (TP + ph - v / mx * ph).toFixed(1); }
    var s = '<svg class="dchart' + (wide ? ' wide' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tagesverlauf: Mahlzeiten in Gramm, Training und geschätzter Zuckerspiegel">';
    row.sess.forEach(function (x) {
      var st = tmin(x.tm);
      if (st === null) return;
      var en = Math.min(1440, st + x.min);
      s += '<rect class="tb" x="' + X(st) + '" y="' + TP + '" width="' + (X(en) - X(st)).toFixed(1) + '" height="' + ph + '"/><text class="tbl" x="' + (+X(st) + 2) + '" y="' + (TP + 10) + '">' + esc(x.type) + '</text>';
    });
    [0, 0.5, 1].forEach(function (f) {
      s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(mx * f) + '" y2="' + Y(mx * f) + '"/><text class="ax" x="' + (L - 4) + '" y="' + (+Y(mx * f) + 3) + '" text-anchor="end">' + r0(mx * f) + '</text>';
    });
    var step = (t1 - t0) / 60 <= 12 ? 1 : (t1 - t0) / 60 <= 18 ? 2 : 3;
    for (var h = Math.ceil(t0 / 60); h <= t1 / 60; h++) if ((h - Math.ceil(t0 / 60)) % step === 0) s += '<line class="gl" x1="' + X(h * 60) + '" x2="' + X(h * 60) + '" y1="' + (TP + ph) + '" y2="' + (TP + ph + 3) + '"/><text class="ax" x="' + X(h * 60) + '" y="' + (H - 8) + '" text-anchor="middle">' + h + '</text>';
    s += '<text class="ax" x="' + (L - 4) + '" y="11" text-anchor="end">g</text>';
    plan.forEach(function (p) {
      var v = p.c + p.p + p.f, bw = wide ? 16 : 12;
      s += '<rect class="pl" x="' + (X(p.at) - bw / 2).toFixed(1) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (Y(0) - Y(v)).toFixed(1) + '"/>';
    });
    row.mp.filter(function (p) { return p.kind === 'during' && p.q && p.c > 0; }).forEach(function (p) {
      var x0 = +X(p.q.st), x1 = +X(p.q.en);
      s += '<rect class="pl" x="' + x0 + '" y="' + Y(p.c) + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (Y(0) - Y(p.c)).toFixed(1) + '"/>';
    });
    row.groups.forEach(function (g) {
      if (g.t === null) return;
      var bw = wide ? 11 : 8, x = (X(g.t) - bw / 2).toFixed(1), base = 0, w = sessFor(row, g.t, g.kind === 'during');
      if (w) {
        var bx = +X(w.st), bwid = Math.max(bw, +X(w.en) - bx);
        [['bc', g.c], ['bp', g.p], ['bf', g.f]].forEach(function (seg) {
          if (seg[1] <= 0) return;
          var y1 = Y(base + seg[1]), y0 = Y(base);
          s += '<rect class="' + seg[0] + ' bd" x="' + bx.toFixed(1) + '" y="' + y1 + '" width="' + bwid.toFixed(1) + '" height="' + Math.max(0.5, y0 - y1).toFixed(1) + '"/>';
          base += seg[1];
        });
        s += '<text class="tbl" x="' + (bx + 3).toFixed(1) + '" y="' + (+Y(base) - 3) + '">' + r0(g.c) + ' g Carbs · ' + r0(g.c / ((w.en - w.st) / 60)) + ' g/h</text>';
        return;
      }
      [['bc', g.c], ['bp', g.p], ['bf', g.f]].forEach(function (seg) {
        if (seg[1] <= 0) return;
        var y1 = Y(base + seg[1]), y0 = Y(base);
        s += '<rect class="' + seg[0] + '" x="' + x + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0.5, y0 - y1).toFixed(1) + '"/>';
        base += seg[1];
      });
    });
    // Zuckerkurve: eigene Skala rechts (mg/dl), nur im sichtbaren Zeitfenster
    var gmin = 50, gmax = 200;
    function GY(v) { return (TP + ph - (Math.max(gmin, Math.min(gmax, v)) - gmin) / (gmax - gmin) * ph).toFixed(1); }
    var today0 = today(), isFut = row.day > today0, nowM = row.day === today0 ? nowMinutes() : null;
    s += '<rect class="gband" x="' + L + '" y="' + GY(140) + '" width="' + pw + '" height="' + (GY(70) - GY(140)).toFixed(1) + '"/>';
    [70, 110, 150, 190].forEach(function (v) { s += '<text class="ax gax" x="' + (W - R + 3) + '" y="' + (+GY(v) + 3) + '">' + v + '</text>'; });
    s += '<text class="ax gax" x="' + (W - R + 3) + '" y="11">mg/dl</text>';
    function vis(pt) { return pt.t >= t0 && pt.t <= t1; }
    var pp = '', first = true;
    glucoseOf(row, 'plan').filter(vis).forEach(function (pt) { pp += (first ? 'M' : 'L') + X(pt.t) + ' ' + GY(pt.g); first = false; });
    s += '<path class="gplan" d="' + pp + '"/>';
    if (!isFut && (row.meals.length || row.sess.length)) {
      var ic = glucoseOf(row, 'ist', nowM), run = null, d = '';
      function flush() { if (run) { s += '<path class="gl2 ' + run + '" d="' + d + '"/>'; run = null; d = ''; } }
      for (var gi = 1; gi < ic.length; gi++) {
        var a = ic[gi - 1], b = ic[gi];
        if (!vis(a) || !vis(b)) continue;
        var v = Math.min(a.g, b.g), hi = Math.max(a.g, b.g);
        var cls = v < GLOW ? 'gbad' : (v < GWARNLOW || hi > GHIGH) ? 'gwarn' : 'gok';
        if (cls !== run) { flush(); run = cls; d = 'M' + X(a.t) + ' ' + GY(a.g); }
        d += 'L' + X(b.t) + ' ' + GY(b.g);
      }
      flush();
    }
    return s + '</svg>';
  }
  function chartBtnLabel() { return CH.full ? 'Nur 5 bis 23 Uhr zeigen' : 'Diagramm für volle Uhrzeit anzeigen'; }
  function dayChartHtml(row) {
    CH.rows[row.day] = row;
    return '<div class="chart" data-chart="' + esc(row.day) + '"><div class="csvg">' + dayChartSvg(row, { full: CH.full }) + '</div><div class="legend"><span><i class="lc"></i>Carbs</span><span><i class="lp"></i>Eiweiß</span><span><i class="lf"></i>Fett</span><span><i class="lt"></i>Training</span><span><i class="ld"></i>Soll</span><span><i class="li"></i>Gegessen</span><span><i class="lg"></i>Zucker geschätzt</span><span><i class="lr"></i>zu niedrig</span></div>' +
      '<p class="note">X-Achse: Uhrzeit · linke Achse: Gramm je Mahlzeit. Gestrichelte Balken zeigen den Essensplan, farbige Balken das tatsächlich Gegessene. Die Linie ist ein <b>geschätzter</b> Blutzuckerverlauf (rechte Achse, mg/dl) aus Mahlzeiten und Training, kein Messwert: grün im üblichen Bereich (etwa 75 bis 150), gelb grenzwertig, rot unter 65. Die graue gestrichelte Linie zeigt den Verlauf nach Plan.</p>' +
      '<div class="chartbtns"><button type="button" class="btn ghost sm" data-ch="fs">Vollbild quer</button><button type="button" class="btn ghost sm" data-ch="full">' + chartBtnLabel() + '</button></div></div>';
  }
  function chartRefresh() {
    if (typeof document === 'undefined') return;
    Array.prototype.forEach.call(document.querySelectorAll('.chart[data-chart]'), function (el) {
      var row = CH.rows[el.getAttribute('data-chart')]; if (!row) return;
      el.querySelector('.csvg').innerHTML = dayChartSvg(row, { full: CH.full });
      var b = el.querySelector('[data-ch="full"]'); if (b) b.textContent = chartBtnLabel();
    });
    var ov = document.getElementById('chartfs');
    if (ov) { var row2 = CH.rows[ov.getAttribute('data-day')]; if (row2) { ov.querySelector('.fsbody').innerHTML = dayChartSvg(row2, { full: CH.full, wide: true }); ov.querySelector('[data-ch="full"]').textContent = chartBtnLabel(); } }
  }
  function chartOverlayLayout() {
    var ov = document.getElementById('chartfs'); if (!ov) return;
    ov.classList.toggle('rot', window.innerHeight > window.innerWidth);
  }
  function chartOpen(day) {
    var row = CH.rows[day]; if (!row) return;
    chartClose();
    var ov = document.createElement('div');
    ov.id = 'chartfs'; ov.setAttribute('data-day', day); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Diagramm im Vollbild');
    ov.innerHTML = '<div class="fsbody">' + dayChartSvg(row, { full: CH.full, wide: true }) + '</div><div class="fsbar"><span class="fsttl">' + esc(dayLabel(day)) + '</span><button type="button" class="btn ghost sm" data-ch="full">' + chartBtnLabel() + '</button><button type="button" class="btn sm" data-ch="close" aria-label="Schließen">Schließen</button></div>';
    document.body.appendChild(ov);
    chartOverlayLayout();
  }
  function chartClose() { if (typeof document === 'undefined') return; var ov = document.getElementById('chartfs'); if (ov) ov.parentNode.removeChild(ov); }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ch]'); if (!b) return;
      var k = b.getAttribute('data-ch');
      if (k === 'full') { CH.full = !CH.full; chartRefresh(); }
      else if (k === 'fs') { var c = b.closest('.chart'); if (c) chartOpen(c.getAttribute('data-chart')); }
      else if (k === 'close') chartClose();
    });
    window.addEventListener('resize', chartOverlayLayout);
    window.addEventListener('orientationchange', chartOverlayLayout);
  }

  function dayReview(row, nowMin) {
    var out = [], t = row.t, st = row.st, done = nowMin === null || nowMin === undefined;
    function add(k, tx) { out.push({ k: k, t: tx }); }
    if (!row.n) { add('info', done ? 'Für diesen Tag ist kein Essen eingetragen.' : 'Noch nichts gegessen.'); }
    else {
      var rc = st.c / t.c;
      add(rc >= 0.9 && rc <= 1.15 ? 'ok' : rc > 1.15 ? 'info' : (done ? 'warn' : 'info'), (done ? '' : 'Bisher ') + 'Carbs: ' + r0(st.c) + ' g von ' + t.c + ' g (' + r0(rc * 100) + ' %).');
      var rp = st.p / t.p;
      add(rp >= 0.9 ? 'ok' : (done ? 'warn' : 'info'), (done ? '' : 'Bisher ') + 'Eiweiß: ' + r0(st.p) + ' g von ' + t.p + ' g.');
      if (st.f > 1.3 * t.f) add('warn', 'Fett deutlich über dem Richtwert: ' + r0(st.f) + ' g statt ' + t.f + ' g.');
      var vOk = st.veg >= GOALS.veg && st.fruit >= GOALS.fruit;
      add(vOk ? 'ok' : (done && st.veg < 0.5 * GOALS.veg ? 'warn' : 'info'), 'Gemüse ' + r0(st.veg) + ' g und Obst ' + r0(st.fruit) + ' g (Richtwert ' + GOALS.veg + ' und ' + GOALS.fruit + ' g).');
    }
    if (row.meals.length || row.sess.length) {
      var gc = glucoseOf(row, 'ist', done ? null : nowMin), lowT = glucoseLow(gc);
      if (lowT !== null) {
        var cause = 'lange ohne Carbs';
        row.sess.forEach(function (s) { var a0 = tmin(s.tm); if (a0 === null) return; if (lowT > a0 && lowT <= a0 + s.min) cause = 'während ' + s.type + ' um ' + s.tm + ' zu wenig Carbs'; else if (lowT > a0 + s.min && lowT <= a0 + s.min + 240) cause = 'nach ' + s.type + ' um ' + s.tm + ' nicht schnell genug gegessen'; });
        add('warn', 'Geschätzter Zuckerspiegel fiel ab ca. ' + tfmt(lowT) + ' Uhr unter 65 mg/dl (' + cause + '). Das ist eine Modellschätzung, kein Messwert.');
      }
    }
    row.sess.forEach(function (s, i) {
      var x = row.t.info[i], s0 = tmin(s.tm);
      if (!x || s0 === null || s.lv < 1 || s.min < 45) return;
      var en = s0 + s.min, started = done || s0 <= nowMin, ended = done || en <= nowMin, windowOver = done || en + 120 <= nowMin;
      var pre = 0, dur = 0, post = 0, postP = 0, firstAfter = null;
      row.meals.forEach(function (m) {
        var mm = tmin(m.t);
        if (mm === null) return;
        if (mm >= s0 - 240 && mm <= s0 - 30) pre += m.c;
        if (mm > s0 && mm < en) dur += m.c;
        if (mm >= en - 10 && mm <= en + 120) { post += m.c; postP += m.p; }
        if (mm >= en - 10 && (firstAfter === null || mm < firstAfter)) firstAfter = mm;
      });
      var nm = s.type + ' um ' + s.tm;
      if (started) add(pre >= 0.6 * x.pre ? 'ok' : 'warn', 'Vor ' + nm + ': ' + r0(pre) + ' g Carbs in den 4 Stunden davor (Richtwert ' + x.pre + ' g).');
      if (ended && x.during > 0) add(dur >= 0.6 * x.during ? 'ok' : 'warn', 'Während ' + nm + ': ' + r0(dur) + ' g Carbs (Richtwert ' + x.during + ' g).');
      if (windowOver) {
        add(post >= 0.6 * x.post && postP >= 0.6 * x.postP ? 'ok' : 'warn', 'Nach ' + nm + ': ' + r0(post) + ' g Carbs und ' + r0(postP) + ' g Eiweiß in den 2 Stunden danach (Richtwert ' + x.post + ' und ' + x.postP + ' g).' + (firstAfter !== null && firstAfter - en > 90 ? ' Die erste Mahlzeit kam erst ' + hmText(firstAfter - en) + ' nach dem Ende.' : ''));
      } else if (ended) add('info', 'Nach ' + nm + ': jetzt Carbs und Eiweiß essen (Richtwert ' + x.post + ' g Carbs, ' + x.postP + ' g Eiweiß).');
    });
    return out;
  }
  function reviewHtml(list) {
    return '<ul class="rev">' + list.map(function (x) { return '<li><span class="pill ' + (x.k === 'ok' ? 'ok' : x.k === 'warn' ? 'low' : '') + '"><i></i></span><span>' + esc(x.t) + '</span></li>'; }).join('') + '</ul>';
  }

  function parseLabel(text) {
    var o = { k: null, c: null, p: null, f: null, fi: null };
    String(text || '').replace(/,/g, '.').split(/\n/).forEach(function (l0) {
      var l = l0.toLowerCase().replace(/\s+/g, ' ').trim(), m;
      if (!l) return;
      if (o.k === null && (m = l.match(/(\d+(?:\.\d+)?)\s*kcal/))) o.k = +m[1];
      if (/^(davon|-\s*davon|dayon)/.test(l)) return;
      function val(re) {
        if (!re.test(l)) return null;
        var rest = l.replace(re, ' ');
        var g = rest.match(/(\d+(?:\.\d+)?)\s*g\b/) || rest.match(/(\d+(?:\.\d+)?)/);
        return g ? +g[1] : null;
      }
      if (o.f === null) o.f = val(/^fett\b/);
      if (o.c === null) o.c = val(/^kohlenhydrate\b/);
      if (o.p === null) o.p = val(/^(eiweiß|eiweiss|protein)(?![a-zäöüß])/);
      if (o.fi === null) o.fi = val(/^ballaststoffe\b/);
    });
    if (o.k !== null && o.k > 900) o.k = null;
    if (o.k === null && (o.c !== null || o.p !== null || o.f !== null)) o.k = r0(4 * (o.c || 0) + 4 * (o.p || 0) + 9 * (o.f || 0));
    return o;
  }

  /* ---------- Berichte (HTML) ---------- */
  function chartSvg(rows) {
    var n = rows.length, bw = 14, gap = 4, W = Math.max(320, n * (bw + gap) + 40), H = 150, top = 12, bot = 22, left = 34;
    var mx = 100;
    rows.forEach(function (r) { mx = Math.max(mx, r.st.c, r.t.c); });
    mx = Math.ceil(mx / 100) * 100;
    var ph = H - top - bot;
    function y(v) { return top + ph - v / mx * ph; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Kohlenhydrate gegessen und Ziel pro Tag">';
    [0, 0.5, 1].forEach(function (f) {
      var v = mx * f;
      s += '<line x1="' + left + '" x2="' + (W - 4) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (left - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + r0(v) + '</text>';
    });
    var step = n > 45 ? 14 : n > 20 ? 7 : n > 10 ? 2 : 1;
    rows.forEach(function (r, i) {
      var x = left + 4 + i * (bw + gap);
      var h = r.st.c / mx * ph;
      if (r.n) s += '<rect x="' + x + '" y="' + (y(r.st.c)) + '" width="' + bw + '" height="' + h + '" rx="2" class="be"/>';
      s += '<line x1="' + (x - 2) + '" x2="' + (x + bw + 2) + '" y1="' + y(r.t.c) + '" y2="' + y(r.t.c) + '" class="tg"/>';
      if (i % step === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">' + parseDay(r.day).getDate() + '.' + (parseDay(r.day).getMonth() + 1) + '.</text>';
    });
    return s + '</svg>';
  }

  function monday(d) { var x = parseDay(d); var k = (x.getDay() + 6) % 7; return addDays(d, -k); }

  function reportParts(rows, ws) {
    var logged = rows.filter(function (r) { return r.n > 0; }), P = { tiles: '', veg: '', weeks: '', empty: !logged.length };
    if (!logged.length) return P;
    var avgC = avg(logged, function (r) { return r.st.c; }), avgT = avg(logged, function (r) { return r.t.c; });
    var avgP = avg(logged, function (r) { return r.st.p; }), avgF = avg(logged, function (r) { return r.st.f; });
    var avgK = avg(logged, function (r) { return r.st.k; });
    var hit = logged.filter(function (r) { return r.st.c >= r.t.c * 0.9; }).length;
    P.tiles = '<div class="tiles">' +
      tile('Tage mit Eintrag', logged.length + ' von ' + rows.length) +
      tile('Ø Carbs', de(avgC) + ' g', 'Ziel Ø ' + de(avgT) + ' g (' + de(avgT ? avgC / avgT * 100 : 0) + ' %)') +
      tile('Carb-Ziel erreicht', hit + ' von ' + logged.length + ' Tagen', 'ab 90 % des Ziels') +
      tile('Ø Eiweiß', de(avgP) + ' g', 'Ø Fett ' + de(avgF) + ' g · Ø ' + de(avgK) + ' kcal') + fuelTiles(rows) + '</div>';
    var ok = { veg: 0, fruit: 0, C: 0, A: 0, K: 0, F: 0, E: 0 };
    logged.forEach(function (r) {
      var a = ampel(r.st);
      if (a.veg.lv === 'ok') ok.veg++;
      if (a.fruit.lv === 'ok') ok.fruit++;
      Object.keys(VITN).forEach(function (k) { if (a.vit[k].lv === 'ok') ok[k]++; });
    });
    var avgV = avg(logged, function (r) { return r.st.veg; }), avgO = avg(logged, function (r) { return r.st.fruit; });
    P.veg = '<section class="card"><div class="eyebrow">Gemüse, Obst und Vitamine (Einschätzung)</div>' +
      '<p class="note">Ø Gemüse ' + de(avgV) + ' g (Ziel ' + GOALS.veg + ') · Ø Obst ' + de(avgO) + ' g (Ziel ' + GOALS.fruit + ')</p><div class="ampel">' +
      pill('Gemüse', ok.veg, logged.length) + pill('Obst', ok.fruit, logged.length) +
      Object.keys(VITN).map(function (k) { return pill(VITN[k], ok[k], logged.length); }).join('') + '</div>' +
      '<p class="note">Anteil der Tage, an denen genug reiche Quellen gegessen wurden. Die Einschätzung zählt nur Lebensmittel aus dem Logbuch und ersetzt keine Blutwerte.</p></section>';
    var weeks = {};
    rows.forEach(function (r) { var k = monday(r.day); (weeks[k] = weeks[k] || []).push(r); });
    var keys = Object.keys(weeks).sort().reverse(), hasW = (ws || []).length > 0;
    var h = '<section class="card"><div class="eyebrow">Wochen</div><div class="scroll"><table><thead><tr><th>Woche ab</th><th>Tage</th><th>Ø Carbs</th><th>Ziel</th><th>Ø Eiweiß</th><th>Ø Fett</th><th>Ø Ballast.</th><th>Ø Gem.+Obst</th>' + (hasW ? '<th>Ø kg</th>' : '') + '<th>Training</th></tr></thead><tbody>';
    keys.forEach(function (k) {
      var w = weeks[k], lg = w.filter(function (r) { return r.n > 0; });
      var tm = 0; w.forEach(function (r) { tm += r.trainMin; });
      var wk = (ws || []).filter(function (x) { return x.day >= k && x.day <= addDays(k, 6); });
      function av(f) { return lg.length ? de(avg(lg, f)) : '–'; }
      h += '<tr><td>' + parseDay(k).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) + '</td><td>' + lg.length + '</td>' +
        '<td>' + av(function (r) { return r.st.c; }) + '</td><td>' + av(function (r) { return r.t.c; }) + '</td>' +
        '<td>' + av(function (r) { return r.st.p; }) + '</td><td>' + av(function (r) { return r.st.f; }) + '</td><td>' + av(function (r) { return r.st.fi; }) + '</td><td>' + (lg.length ? de(avg(lg, function (r) { return r.st.veg + r.st.fruit; })) + ' g' : '–') + '</td>' +
        (hasW ? '<td>' + (wk.length ? de(avg(wk, function (x) { return x.kg; }), 1) : '–') + '</td>' : '') +
        '<td>' + de(tm / 60, 1) + ' h</td></tr>';
    });
    P.weeks = h + '</tbody></table></div></section>';
    return P;
  }
  function reportHtml(rows) {
    var P = reportParts(rows);
    if (P.empty) return '<div class="card empty">In diesem Zeitraum gibt es noch keine Einträge.</div>';
    return P.tiles + '<section class="card"><div class="eyebrow">Carbs pro Tag, Strich = Ziel</div><div class="scroll">' + chartSvg(rows) + '</div></section>' + P.veg + P.weeks;
  }

  /* ---------- Verlauf pro Tag (wählbare Werte) ---------- */
  var METRICS = [
    { k: 'c', n: 'Kohlenhydrate', s: 'Carbs', col: '#D98719', u: 'g', get: function (r) { return r.st.c; }, tgt: function (r) { return r.t.c; } },
    { k: 'p', n: 'Eiweiß', s: 'Eiweiß', col: '#16836F', u: 'g', get: function (r) { return r.st.p; }, tgt: function (r) { return r.t.p; } },
    { k: 'f', n: 'Fett', s: 'Fett', col: '#C95F78', u: 'g', get: function (r) { return r.st.f; }, tgt: function (r) { return r.t.f; } },
    { k: 'fi', n: 'Ballaststoffe', s: 'Ballast.', col: '#8A6A3B', u: 'g', get: function (r) { return r.st.fi; }, tgt: function (r) { return Math.max(30, r0(14 * r.t.kcal / 1000)); } },
    { k: 'veg', n: 'Gemüse', s: 'Gemüse', col: '#3DA35D', u: 'g', get: function (r) { return r.st.veg; }, tgt: function () { return GOALS.veg; } },
    { k: 'fruit', n: 'Obst', s: 'Obst', col: '#7B61D6', u: 'g', get: function (r) { return r.st.fruit; }, tgt: function () { return GOALS.fruit; } },
    { k: 'kcal', n: 'Kalorien', s: 'kcal', col: '#5B6B65', u: 'kcal', get: function (r) { return r.st.k; }, tgt: function (r) { return r.t.kcal; } }
  ];
  function metricOf(k) { return METRICS.filter(function (m) { return m.k === k; })[0]; }
  function markSvg(i, x, y, col, rad) {
    x = +x; y = +y;
    var f = 'fill="' + col + '" stroke="#fff" stroke-width="1"';
    if (i % 4 === 1) return '<rect x="' + (x - rad) + '" y="' + (y - rad) + '" width="' + (2 * rad) + '" height="' + (2 * rad) + '" ' + f + '/>';
    if (i % 4 === 2) return '<polygon points="' + x + ',' + (y - rad - 0.8) + ' ' + (x + rad + 0.8) + ',' + (y + rad) + ' ' + (x - rad - 0.8) + ',' + (y + rad) + '" ' + f + '/>';
    if (i % 4 === 3) return '<polygon points="' + x + ',' + (y - rad - 1) + ' ' + (x + rad + 1) + ',' + y + ' ' + x + ',' + (y + rad + 1) + ' ' + (x - rad - 1) + ',' + y + '" ' + f + '/>';
    return '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" ' + f + '/>';
  }
  function xLabels(n, x, labelOf, y) {
    var step = n <= 10 ? 1 : Math.ceil(n / 6), s = '';
    for (var i = 0; i < n; i += step) s += '<text x="' + x(i) + '" y="' + y + '" text-anchor="middle" class="ax">' + labelOf(i) + '</text>';
    return s;
  }
  function dm(day) { var d = parseDay(day); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function trendChartSvg(rows, keys, mode, sel) {
    var ms = keys.map(metricOf).filter(Boolean), n = rows.length, pct = mode !== 'abs';
    var W = 360, H = 230, left = 40, right = 8, top = 12, bot = 26, pw = W - left - right, ph = H - top - bot;
    var data = ms.map(function (m) { return rows.map(function (r) { if (!r.n) return null; var v = m.get(r); return pct ? (m.tgt(r) > 0 ? v / m.tgt(r) * 100 : 0) : v; }); });
    var mx = 0, any = false;
    data.forEach(function (a) { a.forEach(function (v) { if (v !== null) { any = true; if (v > mx) mx = v; } }); });
    if (!any) return '';
    var ticks = [];
    if (pct) { mx = Math.max(125, Math.ceil(mx / 25) * 25); var ts = mx > 200 ? 50 : 25; for (var v0 = 0; v0 <= mx; v0 += ts) ticks.push(v0); }
    else { var st = mx > 1500 ? 500 : mx > 600 ? 200 : mx > 300 ? 100 : mx > 120 ? 50 : mx > 50 ? 20 : 10; mx = Math.ceil(Math.max(mx, 10) / st) * st; var ts2 = mx / st > 6 ? st * 2 : st; for (var v1 = 0; v1 <= mx; v1 += ts2) ticks.push(v1); }
    function y(v) { return top + ph - v / mx * ph; }
    function x(i) { return left + (i + 0.5) / n * pw; }
    var unit = pct ? ' %' : '';
    var s = '<svg class="vchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verlauf pro Tag: ' + esc(ms.map(function (m) { return m.n; }).join(', ')) + (pct ? ' in Prozent des Ziels' : '') + '">';
    ticks.forEach(function (v) { s += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (left - 5) + '" y="' + (y(v) + 3.5) + '" text-anchor="end" class="ax">' + r0(v) + unit + '</text>'; });
    if (pct) s += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + y(100) + '" y2="' + y(100) + '" class="t100"/><text x="' + (W - right) + '" y="' + (y(100) - 3) + '" text-anchor="end" class="ax">Ziel</text>';
    var si = sel ? rows.map(function (r) { return r.day; }).indexOf(sel) : -1;
    if (si >= 0) s += '<rect x="' + (left + si / n * pw) + '" y="' + top + '" width="' + (pw / n) + '" height="' + ph + '" class="selband"/>';
    var bars = ms.length === 1 && !pct && n <= 45;
    ms.forEach(function (m, mi) {
      var d = data[mi];
      if (bars) {
        var bw = Math.max(2, pw / n * 0.68);
        d.forEach(function (v, i) {
          if (v === null) return;
          s += '<rect x="' + (x(i) - bw / 2) + '" y="' + y(v) + '" width="' + bw + '" height="' + Math.max(0, top + ph - y(v)) + '" rx="2" fill="' + m.col + '"/>';
          s += '<line x1="' + (x(i) - bw / 2 - 2) + '" x2="' + (x(i) + bw / 2 + 2) + '" y1="' + y(m.tgt(rows[i])) + '" y2="' + y(m.tgt(rows[i])) + '" class="tg"/>';
        });
        return;
      }
      var path = '', open = false;
      d.forEach(function (v, i) { if (v === null) { open = false; return; } path += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); open = true; });
      s += '<path d="' + path + '" fill="none" stroke="' + m.col + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
      d.forEach(function (v, i) {
        if (v === null) return;
        if (n <= 45) s += markSvg(mi, x(i).toFixed(1), y(v).toFixed(1), m.col, 3.2);
        else if ((i === 0 || d[i - 1] === null) && (i === n - 1 || d[i + 1] === null)) s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="1.6" fill="' + m.col + '"/>';
      });
    });
    s += xLabels(n, x, function (i) { return dm(rows[i].day); }, H - 8);
    var hw = pw / n;
    rows.forEach(function (r, i) { s += '<rect x="' + (left + i * hw) + '" y="' + top + '" width="' + hw + '" height="' + ph + '" fill="transparent" data-a="chartday" data-d="' + r.day + '"/>'; });
    return s + '</svg>';
  }
  function trendTableHtml(rows, keys, mode) {
    var ms = keys.map(metricOf).filter(Boolean), logged = rows.filter(function (r) { return r.n > 0; });
    if (!logged.length) return '';
    var h = '<div class="scroll"><table class="ttab"><thead><tr><th></th><th>Ø ist</th><th>Ø Ziel</th><th>Quote</th></tr></thead><tbody>';
    ms.forEach(function (m, i) {
      var a = avg(logged, m.get), t = avg(logged, function (r) { return m.tgt(r); });
      h += '<tr><td><span class="sw" style="background:' + m.col + '"></span>' + esc(m.n) + '</td><td>' + de(a) + ' ' + m.u + '</td><td>' + de(t) + ' ' + m.u + '</td><td>' + de(t ? a / t * 100 : 0) + ' %</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function trendDayHtml(rows, keys, sel) {
    var r = rows.filter(function (x) { return x.day === sel; })[0];
    if (!r) return '<p class="note">Tippe im Diagramm auf einen Tag, dann siehst du hier die genauen Werte.</p>';
    var h = '<div class="dayrd"><div class="eyebrow">' + esc(dayLabel(r.day)) + '</div>';
    if (!r.n) return h + '<p class="note">Für diesen Tag ist kein Essen eingetragen.</p></div>';
    h += '<div class="scroll"><table class="ttab"><tbody>';
    keys.map(metricOf).filter(Boolean).forEach(function (m) {
      var v = m.get(r), t = m.tgt(r);
      h += '<tr><td><span class="sw" style="background:' + m.col + '"></span>' + esc(m.n) + '</td><td>' + de(v) + ' ' + m.u + '</td><td>Ziel ' + de(t) + '</td><td>' + de(t ? v / t * 100 : 0) + ' %</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  /* ---------- Körpergewicht ---------- */
  function wSorted(ws, from, to) { return (ws || []).filter(function (w) { return (!from || w.day >= from) && (!to || w.day <= to); }).sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; }); }
  function wTrendAt(all, day) {
    var lo = addDays(day, -6), L = all.filter(function (w) { return w.day >= lo && w.day <= day; });
    return L.length ? avg(L, function (w) { return w.kg; }) : null;
  }
  function weightStats(ws, from, to) {
    var all = wSorted(ws), L = wSorted(ws, from, to);
    if (!L.length) return null;
    var kgs = L.map(function (w) { return w.kg; }), first = L[0], last = L[L.length - 1];
    return { n: L.length, first: first, last: last, delta: last.kg - first.kg, avg: avg(L, function (w) { return w.kg; }), min: Math.min.apply(null, kgs), max: Math.max.apply(null, kgs), trend: wTrendAt(all, last.day) };
  }
  function weightChartSvg(ws, from, to) {
    var all = wSorted(ws), L = wSorted(ws, from, to);
    if (!L.length) return '';
    if (L[0].day > from) from = L[0].day < addDays(to, -6) ? L[0].day : addDays(to, -6);
    var W = 360, H = 200, left = 40, right = 10, top = 12, bot = 26, pw = W - left - right, ph = H - top - bot;
    var span = Math.max(1, Math.round((parseDay(to) - parseDay(from)) / 86400000));
    function X(day) { return left + Math.round((parseDay(day) - parseDay(from)) / 86400000) / span * pw; }
    var trend = L.map(function (w) { return { day: w.day, kg: wTrendAt(all, w.day) }; });
    var vals = L.map(function (w) { return w.kg; }).concat(trend.map(function (t) { return t.kg; }));
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rng = mx - mn;
    var step = rng > 8 ? 2 : rng > 4 ? 1 : 0.5, lo = Math.floor((mn - 0.1) / step) * step, hi = Math.ceil((mx + 0.1) / step) * step;
    if (hi - lo < 1) hi = lo + 1;
    var cnt = Math.round((hi - lo) / step); while (cnt > 6) { step *= 2; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; cnt = Math.round((hi - lo) / step); }
    function Y(v) { return top + ph - (v - lo) / (hi - lo) * ph; }
    var s = '<svg class="vchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Körpergewicht im Zeitraum">';
    for (var v = lo; v <= hi + 1e-9; v += step) s += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="gl"/><text x="' + (left - 5) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end" class="ax">' + de(v, step < 1 ? 1 : 0) + '</text>';
    s += '<path d="' + L.map(function (w, i) { return (i ? 'L' : 'M') + X(w.day).toFixed(1) + ' ' + Y(w.kg).toFixed(1); }).join('') + '" fill="none" class="w-raw"/>';
    s += '<path d="' + trend.map(function (w, i) { return (i ? 'L' : 'M') + X(w.day).toFixed(1) + ' ' + Y(w.kg).toFixed(1); }).join('') + '" fill="none" class="w-trend"/>';
    L.forEach(function (w) { s += '<circle cx="' + X(w.day).toFixed(1) + '" cy="' + Y(w.kg).toFixed(1) + '" r="' + (L.length > 60 ? 1.8 : 3) + '" class="w-pt"/>'; });
    for (var t = 0; t <= 4; t++) { var dd = addDays(from, Math.round(span * t / 4)); s += '<text x="' + X(dd).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (t === 0 ? 'start' : t === 4 ? 'end' : 'middle') + '" class="ax">' + dm(dd) + '</text>'; }
    return s + '</svg>';
  }
  function tile(a, b, c) { return '<div class="tile"><div class="eyebrow">' + esc(a) + '</div><div class="tv">' + esc(b) + '</div>' + (c ? '<div class="note">' + esc(c) + '</div>' : '') + '</div>'; }
  function pill(name, ok, total) {
    var q = total ? ok / total : 0, lv = q >= 0.7 ? 'ok' : q >= 0.4 ? 'mid' : 'low';
    return '<span class="pill ' + lv + '"><i></i>' + esc(name) + ' ' + de(q * 100) + ' %</span>';
  }

  function mealGroupHtml(g, sess) {
    var rl = relLabel(g.time, sess);
    var h = '<details class="meal"><summary><span class="mt">' + esc(g.time || '') + '</span><span class="mn">' + esc(g.label || KINDS[g.kind] || g.kind) + '</span><span class="mv">' + r0(g.c) + ' C · ' + r0(g.p) + ' P · ' + r0(g.f) + ' F</span></summary>';
    if (rl) h += '<p class="note">' + esc(rl) + '</p>';
    g.items.forEach(function (m) {
      h += '<div class="entry"><div class="n">' + esc(m.name) + '</div><div class="d">' + r0(m.g) + ' g · ' + r0(m.c) + ' C · ' + r0(m.p) + ' P · ' + r0(m.f) + ' F</div></div>';
    });
    return h + '</details>';
  }
  function dayListHtml(rows) {
    var h = '', first = true, tdy = today();
    rows.slice().reverse().forEach(function (r) {
      if (!r.n && !r.sess.length) return;
      var a = ampel(r.st);
      h += '<details class="card day"' + (first ? ' open' : '') + '><summary><span class="dl">' + esc(dayLabel(r.day)) + '</span><span class="dv">' + r0(r.st.c) + ' / ' + r.t.c + ' g Carbs</span></summary>';
      first = false;
      h += '<p class="note">Alltagsaktivität ' + r.t.lvl + ' von 5 (' + LVL_NAME[r.t.lvl] + ') · ' + r0(r.st.p) + ' g Eiweiß · ' + r0(r.st.f) + ' g Fett · ' + r0(r.st.k) + ' kcal · Gemüse ' + r0(r.st.veg) + ' g · Obst ' + r0(r.st.fruit) + ' g</p>';
      if (r.sess.length) h += '<p class="note">Training: ' + r.sess.map(function (s) { return (s.tm ? esc(s.tm) + ' ' : '') + esc(s.type) + ' ' + s.min + ' min (' + INT[s.lv] + (s.src === 'plan' ? ', geplant' : '') + ')'; }).join(', ') + '</p>';
      h += dayChartHtml(r);
      h += '<div class="eyebrow" style="margin-top:10px">Tagesauswertung</div>' + reviewHtml(dayReview(r, r.day === tdy ? nowMinutes() : (r.day > tdy ? 0 : null)));
      h += '<div class="ampel">' + [['Gemüse', a.veg.lv], ['Obst', a.fruit.lv]].concat(Object.keys(VITN).map(function (k) { return [VITN[k], a.vit[k].lv]; })).map(function (x) { return '<span class="pill ' + x[1] + '"><i></i>' + esc(x[0]) + '</span>'; }).join('') + '</div>';
      h += '<div class="eyebrow" style="margin-top:10px">Mahlzeiten</div>';
      if (!r.groups.length) h += '<p class="note">Nichts eingetragen.</p>';
      r.groups.forEach(function (g) { h += mealGroupHtml(g, r.sess); });
      h += '</details>';
    });
    return h || '<div class="card empty">Keine Einträge.</div>';
  }


  /* ---------- Export für KI-Analyse (Markdown, enthält den Auftrag an die KI) ---------- */
  var AI_PROMPT = [
    'Du bist ein erfahrener Sporternährungsberater für Ausdauersportler (Radsport). Unten findest du meine Tankplan-Daten für den genannten Zeitraum: Profil, Tagesziele, jedes Training und jede einzelne Mahlzeit mit Uhrzeit, Menge und Nährwerten.',
    '',
    'Analysiere mein Essverhalten und gib mir konkrete, umsetzbare Empfehlungen. Gehe bitte so vor:',
    '1. Fasse zusammen, was gut läuft, und nenne die drei größten Verbesserungsmöglichkeiten.',
    '2. Vergleiche Ist mit Soll pro Tag und im Durchschnitt (Kalorien, Carbs, Eiweiß, Fett, Gemüse, Obst). Wo gibt es wiederkehrende Abweichungen?',
    '3. Prüfe das Timing rund ums Training: Carbs und Eiweiß vor, während und nach den Einheiten (Mengen und Abstände), Tage vor harten oder langen Einheiten, Erholung nach dem Training.',
    '4. Suche Muster: Essenszeiten, lange Pausen zwischen Mahlzeiten, Verteilung von Eiweiß über den Tag, späte große Mahlzeiten, Wochentag-Unterschiede, Snacks, wiederkehrende Lebensmittel.',
    '5. Bewerte Lebensmittelqualität und Vielfalt (Gemüse, Obst, Farben, Ballaststoffe) und nenne Lücken.',
    '6. Bewerte die Entwicklung des Körpergewichts (Abschnitt „Körpergewicht“, falls vorhanden) im Verhältnis zu Energiezufuhr, Trainingsumfang und Zielsetzung. Nutze den 7-Tage-Trend statt einzelner Tageswerte.',
    '7. Gib mir einen Plan für die nächste Woche: Zielwerte pro Tagestyp, Beispielmahlzeiten mit Zeiten und Mengen, Verbesserungen in kleinen Schritten.',
    '',
    'Wichtige Hinweise zu den Daten:',
    '- Alle Nährwerte und Energiewerte sind Schätzungen aus einer Lebensmitteldatenbank und einem Rechenmodell. Der Trainingsverbrauch stammt aus kJ, aus der Beschreibung der Einheit, aus TSS mit FTP oder aus einer Schätzung (steht jeweils dabei).',
    '- Die Zuckerkurve ist ein Modell und kein Messwert. Nutze sie höchstens als grobe Orientierung.',
    '- Körpergewicht: Tageswerte schwanken durch Wasser, Verdauung und Glykogen leicht um 0,5 bis 1,5 kg. Aussagekräftig sind Trends über mehrere Tage. Fehlen Gewichtswerte, nicht raten.',
    '- Gemüse und Obst mit dem Zusatz „(gegart)“ wurden gekocht, gedünstet oder gebraten gegessen, alle anderen roh. Die Nährwerte sind die Angaben der Datenbank (je 100 g) und wurden dafür nicht umgerechnet. Berücksichtige bei Verträglichkeit und Timing rund ums Training, dass gegartes Gemüse meist leichter verdaulich ist als rohes.',
    '- Tage ohne Einträge sind vermutlich nicht dokumentiert und keine Fastentage. Frage nach, wenn dir Informationen fehlen.',
    '- Keine Diagnosen und keine medizinischen Aussagen. Bei gesundheitlichen Fragen verweise auf Ärztin oder Arzt.',
    '- Antworte auf Deutsch, klar gegliedert, und belege Aussagen mit konkreten Tagen und Zahlen aus den Daten.'
  ].join('\n');
  function mdCell(v) { return String(v == null ? '' : v).replace(/\|/g, '/').replace(/\n/g, ' '); }
  function exportMd(model, from, to) {
    var rows = analyze(model, from, to), p = model.profile, L = [], tdy = today(), ws = wSorted(model.weights, from, to);
    function ln(x) { L.push(x === undefined ? '' : x); }
    var withData = rows.filter(function (r) { return r.n || r.sess.length; });
    ln('# Tankplan-Export für KI-Analyse');
    ln();
    ln('Zeitraum: ' + from + ' bis ' + to + ' (' + rows.length + ' Tage, davon ' + withData.length + ' mit Einträgen). Erstellt am ' + tdy + '.');
    ln();
    ln('## Auftrag an die KI');
    ln();
    ln(AI_PROMPT);
    ln();
    ln('## Profil');
    ln();
    var zs = zonesOf(p);
    ln('- Geschlecht: ' + (p.sex === 'm' ? 'männlich' : 'weiblich') + ', Alter ' + p.a + ', Größe ' + p.h + ' cm, Gewicht ' + p.w + ' kg, Grundumsatz ca. ' + r0(bmr(p)) + ' kcal');
    var rlx = normRules(p.rules).rules;
    if (rlx) { ln('- Individuelle Regeln (mit Trainer abgesprochen, von der App angewendet):'); ruleLines(rlx).forEach(function (x) { ln('  - ' + x); }); }
    ln('- Ziel: ' + ({ lose: 'Abnehmen (Kalorienziel ca. 15 % unter Bedarf)', keep: 'Gewicht halten', gain: 'Aufbauen (ca. 10 % über Bedarf)' }[p.goal] || p.goal));
    ln('- FTP: ' + (p.ftp ? p.ftp + ' W' : 'nicht angegeben') + '; Zonen in % der FTP (Obergrenzen): ' + ZONE_NAMES.map(function (nm, i) { return nm + ' bis ' + zs[i] + ' %' + (p.ftp ? ' (' + r0(zs[i] * p.ftp / 100) + ' W)' : ''); }).join('; '));
    var mp0 = macroPct(p);
    ln('- Gewählte Makroverteilung: ' + (mp0 ? mp0.c + ' % Carbs, ' + mp0.p + ' % Eiweiß, ' + mp0.f + ' % Fett der Kalorien' : 'automatisch (g/kg nach Trainingslast)'));
    var mt = Object.assign({}, DEF_MT, p.mt || {});
    ln('- Übliche Essenszeiten: Frühstück ' + mt.b + ', Mittagessen ' + mt.l + ', Abendessen ' + mt.d + ', Snack ' + mt.s);
    if (mt.nf && mt.nt) ln('- Essenspause (keine Mahlzeit möglich): ' + mt.nf + ' bis ' + mt.nt + (mt.nw === '1' ? ', nur Montag bis Freitag' : ''));
    ln();
    ln('## Begriffe');
    ln();
    ln('- Intensität: Locker, Mittel, Hart (aus TSS/IF oder Beschreibung, sonst aus dem Titel geschätzt). IF = Intensitätsfaktor, TSS = Trainingsbelastung, kJ/kcal = Energie des Trainings (beim Rad ist 1 kJ etwa 1 kcal).');
    ln('- Alltagsaktivität: Stufe 1 (sehr ruhig) bis 5 (sehr aktiv) für den Alltag ohne Training.');
    ln('- Mahlzeit-Art: Frühstück, Mittagessen, Abendessen, Snack, Vor dem Training, Beim Training, Nach dem Training.');
    ln('- Soll-Werte sind die Tagesziele der App, abhängig von Profil, Alltagsaktivität und Training.');
    ln();
    ln('## Übersicht pro Tag');
    ln();
    ln('| Datum | Aktivitätsstufe | Training | Kalorien ist/soll | Carbs g ist/soll | Eiweiß g ist/soll | Fett g ist/soll | Ballaststoffe g | Gemüse g | Obst g | Gewicht kg | Mahlzeiten |');
    ln('|---|---|---|---|---|---|---|---|---|---|---|---|');
    var sum = { k: 0, tk: 0, c: 0, tc: 0, p: 0, tp: 0, f: 0, tf: 0, veg: 0, fruit: 0, n: 0 };
    rows.forEach(function (r) {
      var tr = r.sess.length ? r.sess.map(function (x) { return x.type + ' ' + x.min + ' min ' + INT[x.lv]; }).join(' + ') : 'kein Training';
      ln('| ' + r.day + ' | ' + r.t.lvl + ' | ' + mdCell(tr) + ' | ' + r0(r.st.k) + ' / ' + r.t.kcal + ' | ' + r0(r.st.c) + ' / ' + r.t.c + ' | ' + r0(r.st.p) + ' / ' + r.t.p + ' | ' + r0(r.st.f) + ' / ' + r.t.f + ' | ' + r0(r.st.fi) + ' | ' + r0(r.st.veg) + ' | ' + r0(r.st.fruit) + ' | ' + (function () { var w = ws.filter(function (x) { return x.day === r.day; })[0]; return w ? de(w.kg, 1) : ''; })() + ' | ' + r.groups.length + ' |');
      if (r.n) { sum.n++; sum.k += r.st.k; sum.tk += r.t.kcal; sum.c += r.st.c; sum.tc += r.t.c; sum.p += r.st.p; sum.tp += r.t.p; sum.f += r.st.f; sum.tf += r.t.f; sum.veg += r.st.veg; sum.fruit += r.st.fruit; }
    });
    if (sum.n) {
      ln();
      ln('Durchschnitt der ' + sum.n + ' Tage mit Essenseinträgen: ' + r0(sum.k / sum.n) + ' kcal (Soll ' + r0(sum.tk / sum.n) + '), Carbs ' + r0(sum.c / sum.n) + ' g (Soll ' + r0(sum.tc / sum.n) + '), Eiweiß ' + r0(sum.p / sum.n) + ' g (Soll ' + r0(sum.tp / sum.n) + '), Fett ' + r0(sum.f / sum.n) + ' g (Soll ' + r0(sum.tf / sum.n) + '), Gemüse ' + r0(sum.veg / sum.n) + ' g, Obst ' + r0(sum.fruit / sum.n) + ' g pro Tag.');
    }
    var wst = weightStats(model.weights, from, to);
    ln();
    ln('## Körpergewicht');
    ln();
    if (!wst) ln('Im Zeitraum sind keine Gewichtswerte eingetragen.' + (p.w ? ' Profilgewicht: ' + p.w + ' kg.' : ''));
    else {
      ln('- Einträge: ' + wst.n + ' · erster Wert ' + de(wst.first.kg, 1) + ' kg (' + wst.first.day + '), letzter Wert ' + de(wst.last.kg, 1) + ' kg (' + wst.last.day + ')');
      ln('- Veränderung im Zeitraum: ' + (wst.delta > 0 ? '+' : '') + de(wst.delta, 1) + ' kg · Durchschnitt ' + de(wst.avg, 1) + ' kg · niedrigster ' + de(wst.min, 1) + ' kg · höchster ' + de(wst.max, 1) + ' kg');
      ln('- 7-Tage-Mittel am letzten Eintrag: ' + de(wst.trend, 1) + ' kg');
      ln();
      ln('| Datum | Gewicht kg | 7-Tage-Mittel kg |');
      ln('|---|---|---|');
      var allw = wSorted(model.weights);
      ws.forEach(function (w) { ln('| ' + w.day + ' | ' + de(w.kg, 1) + ' | ' + de(wTrendAt(allw, w.day), 1) + ' |'); });
    }
    ln();
    ln('## Details pro Tag');
    rows.forEach(function (r) {
      ln();
      ln('### ' + r.day + ' (' + dayLabel(r.day) + ')' + (r.day === tdy ? ' – heute, noch nicht abgeschlossen' : ''));
      ln();
      if (!r.n && !r.sess.length) { ln('Keine Einträge für diesen Tag.'); return; }
      ln('- Alltagsaktivität: ' + r.t.lvl + ' von 5 (' + LVL_NAME[r.t.lvl] + ')');
      ln('- Tagestyp: ' + r.t.dayType + '. Tagesziel: ' + r.t.kcal + ' kcal, ' + r.t.c + ' g Carbs (' + r.t.gkg + ' g/kg), ' + r.t.p + ' g Eiweiß, ' + r.t.f + ' g Fett');
      ln('- Gegessen: ' + r0(r.st.k) + ' kcal, ' + r0(r.st.c) + ' g Carbs, ' + r0(r.st.p) + ' g Eiweiß, ' + r0(r.st.f) + ' g Fett, ' + r0(r.st.fi) + ' g Ballaststoffe, Gemüse ' + r0(r.st.veg) + ' g, Obst ' + r0(r.st.fruit) + ' g' + (r.st.vegCook > 0 || r.st.fruitCook > 0 ? ' (davon gegart: Gemüse ' + r0(r.st.vegCook) + ' g, Obst ' + r0(r.st.fruitCook) + ' g)' : ''));
      if (r.groups.length) {
        var tms = r.groups.filter(function (g) { return g.t !== null; }).map(function (g) { return g.t; });
        if (tms.length) ln('- Erste Mahlzeit ' + tfmt(Math.min.apply(null, tms)) + ' Uhr, letzte Mahlzeit ' + tfmt(Math.max.apply(null, tms)) + ' Uhr');
      }
      ln();
      ln('**Training**');
      ln();
      if (!r.sess.length) ln('Kein Training.');
      r.sess.forEach(function (x, i) {
        var inf = r.t.info[i], en = tmin(x.tm) === null ? '' : ' bis ' + tfmt(tmin(x.tm) + x.min);
        ln('- ' + (x.tm ? x.tm + en + ' Uhr' : 'ohne Uhrzeit') + ' · ' + x.type + ' · ' + x.min + ' min · Intensität ' + INT[x.lv] + (inf.tss ? ' · TSS ' + r0(inf.tss) : '') + (inf.ifactor ? ' · IF ' + inf.ifactor.toFixed(2) : '') + ' · Energie ca. ' + r0(inf.kcal) + ' kcal (' + inf.basis + ') · ' + (x.src === 'act' ? 'absolviert' : 'geplant') + (x.title ? ' · „' + x.title + '“' : ''));
        ln('  - App-Richtwerte: vorher ' + inf.pre + ' g Carbs (' + inf.preWhen + '), während ' + inf.during + ' g Carbs (' + inf.gph + ' g/h), danach ' + inf.post + ' g Carbs und ' + inf.postP + ' g Eiweiß');
        if (x.desc) ln('  - Beschreibung: ' + String(x.desc).replace(/\s*\n\s*/g, '; '));
      });
      ln();
      ln('**Mahlzeiten (jedes Lebensmittel)**');
      ln();
      if (!r.groups.length) ln('Nichts gegessen eingetragen.');
      r.groups.forEach(function (g) {
        var rl = relLabel(g.time, r.sess);
        ln('- ' + (g.label || KINDS[g.kind] || g.kind) + ' um ' + (g.time || '?') + ' Uhr' + (rl ? ' (' + rl + ')' : '') + ': ' + r0(g.kcal) + ' kcal, ' + r0(g.c) + ' g C, ' + r0(g.p) + ' g P, ' + r0(g.f) + ' g F');
        ln();
        ln('  | Uhrzeit | Lebensmittel | Menge g | kcal | Carbs g | Eiweiß g | Fett g | Ballaststoffe g | Kategorie |');
        ln('  |---|---|---|---|---|---|---|---|---|');
        g.items.forEach(function (m) {
          ln('  | ' + (m.t || '') + ' | ' + mdCell(m.name) + (m.cook === 'g' ? ' (gegart)' : '') + ' | ' + r0(m.g) + ' | ' + r0(m.kcal) + ' | ' + de(m.c, 1) + ' | ' + de(m.p, 1) + ' | ' + de(m.f, 1) + ' | ' + de(m.fi || 0, 1) + ' | ' + (m.grp === 'G' ? 'Gemüse' : m.grp === 'O' ? 'Obst' : 'Sonstiges') + (m.col ? ' (' + (COLN[m.col] || m.col) + ')' : '') + ' |');
        });
        ln();
      });
      var nowM = r.day === tdy ? nowMinutes() : null;
      var rev = dayReview(r, nowM);
      if (rev.length) { ln('**Automatische Regelauswertung der App**'); ln(); rev.forEach(function (x) { ln('- ' + x.t); }); ln(); }
      if (r.meals.length || r.sess.length) {
        var gc = glucoseOf(r, 'ist', nowM), mn = gc[0], mx = gc[0], low = 0;
        gc.forEach(function (q) { if (q.g < mn.g) mn = q; if (q.g > mx.g) mx = q; if (q.g < GLOW) low += 5; });
        ln('Geschätzter Zuckerverlauf (Modell, kein Messwert): niedrigster Wert ca. ' + r0(mn.g) + ' mg/dl um ' + tfmt(mn.t) + ' Uhr, höchster ca. ' + r0(mx.g) + ' mg/dl um ' + tfmt(mx.t) + ' Uhr, ' + low + ' min unter 65 mg/dl.');
      }
    });
    return L.join('\n') + '\n';
  }

  function toCsv(rows, ws) {
    var out = ['Datum;Ziel_Carbs_g;Carbs_g;Eiweiss_g;Fett_g;kcal;Gemuese_g;Obst_g;Training_min;Ballaststoffe_g;Gewicht_kg'];
    rows.forEach(function (r) {
      var w = (ws || []).filter(function (x) { return x.day === r.day; })[0];
      if (!r.n && !r.trainMin && !w) return;
      out.push([r.day, r.t.c, r0(r.st.c), r0(r.st.p), r0(r.st.f), r0(r.st.k), r0(r.st.veg), r0(r.st.fruit), r.trainMin, r0(r.st.fi), w ? String(w.kg).replace('.', ',') : ''].join(';'));
    });
    return out.join('\n');
  }

  var API = {
    INT: INT, TYPES: TYPES, GOALS: GOALS, VITN: VITN, COLN: COLN,
    iso: iso, today: today, addDays: addDays, parseDay: parseDay, dayLabel: dayLabel, dayLabelLong: dayLabelLong, r0: r0, esc: esc, de: de,
    parseFoods: parseFoods, searchFoods: searchFoods, mealFrom: mealFrom, norm: norm,
    isCommute: isCommute, bmr: bmr, mapType: mapType, lvFromLoad: lvFromLoad, intensityFromTss: intensityFromTss, parseWorkoutText: parseWorkoutText, zonesOf: zonesOf, macroPct: macroPct, ZONE_NAMES: ZONE_NAMES, ZONE_UPPER: ZONE_UPPER, sessInfo: sessInfo, daySessions: daySessions, target: target,
    parseLine: parseLine, dayStats: dayStats, ampel: ampel, analyze: analyze,
    DEF_MT: DEF_MT, KINDS: KINDS, tmin: tmin, tfmt: tfmt, hmText: hmText, trainWin: trainWin, guessKind: guessKind, mealPlan: mealPlan, matchMeals: matchMeals, slotKind: slotKind, slotInst: slotInst, slotLabel: slotLabel, relLabel: relLabel, fuelCheck: fuelCheck,
    normRules: normRules, ruleLines: ruleLines, rulesPrompt: rulesPrompt, SHAKE_DEF: SHAKE_DEF, glucoseOf: glucoseOf, exportMd: exportMd, PAL: PAL, LVL_NAME: LVL_NAME, LVL_DESC: LVL_DESC, nowMinutes: nowMinutes, groupMeals: groupMeals, pieSvg: pieSvg, pieCaption: pieCaption, pieLegend: pieLegend, dayChartSvg: dayChartSvg, dayChartHtml: dayChartHtml, dayReview: dayReview, reviewHtml: reviewHtml, parseLabel: parseLabel,
    reportHtml: reportHtml, reportParts: reportParts, METRICS: METRICS, trendChartSvg: trendChartSvg, trendTableHtml: trendTableHtml, trendDayHtml: trendDayHtml, wSorted: wSorted, weightStats: weightStats, weightChartSvg: weightChartSvg, wTrendAt: wTrendAt, dayListHtml: dayListHtml, toCsv: toCsv, chartSvg: chartSvg
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.TP = API;
})(typeof window !== 'undefined' ? window : globalThis);
