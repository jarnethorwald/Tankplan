(function () {
  'use strict';
  var T = window.TP, CFG = window.TP_CONFIG || {}, app = document.getElementById('app');
  var token = new URLSearchParams(location.search).get('t');
  var range = 30, data = null;

  function show(html) { app.innerHTML = html; }
  function load() {
    if (!token || !CFG.SUPABASE_URL) { show('<div class="card empty">Dieser Link ist unvollständig.</div>'); return; }
    var to = T.today(), from = T.addDays(to, -120);
    fetch(CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/trainer_data', {
      method: 'POST', headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_from: from, p_to: T.addDays(to, 14) })
    }).then(function (r) { if (!r.ok) throw new Error('Abruf fehlgeschlagen'); return r.json(); })
      .then(function (j) { if (!j || !j.profile) throw new Error('Link ungültig oder widerrufen.'); data = j; render(); })
      .catch(function (e) { show('<div class="card empty">' + T.esc(e.message) + '</div>'); });
  }
  function render() {
    var to = T.today(), from = T.addDays(to, -(range - 1));
    var model = { profile: data.profile, plan: data.plan || [], acts: data.acts || [], meals: data.meals || [], today: to };
    var rows = T.analyze(model, from, to);
    var h = '<div class="top"><div><div class="brand">Tankplan</div><div class="date">Ernährung und Training, nur Ansicht · ' + range + ' Tage</div></div></div>';
    h += '<div class="seg" role="group" aria-label="Zeitraum">' + [7, 30, 90].map(function (n) { return '<button data-n="' + n + '" aria-pressed="' + (range === n) + '">' + n + ' Tage</button>'; }).join('') + '</div>';
    h += T.reportHtml(rows) + '<h2>Tage</h2>' + T.dayListHtml(rows);
    var up = T.analyze(model, T.addDays(to, 1), T.addDays(to, 7)).filter(function (r) { return r.sess.length; });
    if (up.length) {
      h += '<h2>Geplant</h2><section class="card">' + up.map(function (r) {
        return '<div class="planday"><div class="h"><div>' + T.esc(T.dayLabel(r.day)) + '</div><span>Ziel ' + r.t.c + ' g Carbs</span></div><div class="note">' +
          r.sess.map(function (s) { return T.esc(s.title || s.type) + ' (' + s.min + ' min)'; }).join(', ') + '</div></div>';
      }).join('') + '</section>';
    }
    show(h);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]'); if (!b || !data) return;
    range = +b.dataset.n; render();
  });
  load();
})();
