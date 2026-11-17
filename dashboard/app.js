// Token Radar dashboard: renders window.RADAR (written by main.ts into data.js) with no network.
//
// Views: the board (sortable, filterable), a detail view per protocol (#/detail/<slug>), the live
// token view (market caps, never a model's numbers), and the model page with a sandbox that
// re-ranks the board on the same snapshot when a constant moves. The sandbox recomputes from the
// row's own figures; the shipped board is the one main.ts wrote with the defaults.

(function () {
  'use strict';

  var R = window.RADAR;
  var main = document.getElementById('board');
  if (!R || !Array.isArray(R.rows)) {
    main.setAttribute('aria-busy', 'false');
    main.innerHTML = '<p>Could not load the radar data. Run main.ts first so data.js sits beside this page.</p>';
    return;
  }

  var rows = R.rows;
  var live = R.live || [];
  var model = R.model || {};

  // ---------- small helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function fmtPct(v) {
    if (v == null || !isFinite(v)) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return '<span class="' + (v > 0 ? 'up' : v < 0 ? 'down' : '') + '">' + s + '</span>';
  }

  function fmtAge(d) {
    if (d == null) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // The model's maturity hump, as lib/model.ts states it: 0.55 at birth, 1.00 at the peak, then
  // falling toward 0.75 over 1300 days past it. Unknown age counts as 365 days.
  function maturity(age, peak) {
    var a = age == null ? 365 : age;
    if (a <= peak) return 0.55 + 0.45 * (a / peak);
    return 1 - 0.25 * Math.min((a - peak) / 1300, 1);
  }

  // ---------- state ----------

  var state = { q: '', category: '', chain: '', sort: 'rank', watchlistOnly: false, view: 'board', detail: null };
  var sandbox = null; // null means the shipped ranking; otherwise {base, growth, peak, chain}

  function sandboxImplied(r) {
    if (!sandbox) return r.implied_value_usd;
    var growth = clamp(r.change_7d == null ? 0 : r.change_7d, -60, 150);
    var g = 1 + (growth / 100) * sandbox.growth;
    var m = maturity(r.age_days, sandbox.peak);
    var c = 1 + sandbox.chain * Math.min(Math.max(r.chains.length - 1, 0), 7);
    var cat = 0.85 + 0.3 * (r.category_share == null ? 0.549 : r.category_share);
    return Math.max(1, Math.round(r.tvl_usd * sandbox.base * g * m * c * cat));
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    // Sandbox values re-rank the board; otherwise the shipped rank is the order.
    var withValue = out.map(function (r) { return { r: r, v: sandboxImplied(r) }; });
    var key = state.sort;
    withValue.sort(function (a, b) {
      if (key === 'tvl') return b.r.tvl_usd - a.r.tvl_usd || a.r.slug.localeCompare(b.r.slug);
      if (key === 'growth') return (b.r.change_7d == null ? -1e9 : b.r.change_7d) - (a.r.change_7d == null ? -1e9 : a.r.change_7d) || a.r.slug.localeCompare(b.r.slug);
      if (key === 'age') return (b.r.age_days == null ? -1 : b.r.age_days) - (a.r.age_days == null ? -1 : a.r.age_days) || a.r.slug.localeCompare(b.r.slug);
      if (key === 'name') return a.r.name.localeCompare(b.r.name);
      if (key === 'implied') return b.v - a.v || a.r.slug.localeCompare(b.r.slug);
      return a.r.rank - b.r.rank;
    });
    return withValue;
  }

  // ---------- board ----------

  var tbody = document.querySelector('#rows tbody');
  var countEl = document.getElementById('count');

  function renderBoard() {
    var list = visibleRows();
    countEl.textContent = 'Showing ' + list.length + ' of ' + rows.length + ' protocols · ' + R.watchlist_size + ' on the watchlist · ' + R.early_size + ' early finds below the floor';
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No protocols match these filters.</td></tr>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var r = item.r;
      html += '<tr data-slug="' + esc(r.slug) + '">'
        + '<td>' + (sandbox ? '–' : r.rank) + '</td>'
        + '<td class="name">' + esc(r.name) + (r.watchlist ? '<span class="badge">watchlist</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>'
        + '<td>' + esc(r.category || '—') + '</td>'
        + '<td>' + esc(r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>'
        + '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>'
        + '<td class="num">' + fmtPct(r.change_7d) + '</td>'
        + '<td class="num">' + fmtAge(r.age_days) + '</td>'
        + '<td class="num implied">' + fmtUsd(item.v) + '</td>'
        + '</tr>';
    }
    tbody.innerHTML = html;
  }

  tbody.addEventListener('click', function (ev) {
    var tr = ev.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/detail/' + tr.getAttribute('data-slug');
  });

  // ---------- live view ----------

  var liveBody = document.querySelector('#live-rows tbody');
  (function renderLive() {
    var html = '';
    for (var i = 0; i < live.length; i++) {
      var p = live[i];
      html += '<tr>'
        + '<td class="name">' + esc(p.name) + '<span class="slug">' + esc(p.slug) + '</span></td>'
        + '<td>' + esc(p.category || '—') + '</td>'
        + '<td>' + esc(p.chains.slice(0, 3).join(', ') || '—') + '</td>'
        + '<td class="num">' + fmtUsd(p.tvl_usd) + '</td>'
        + '<td class="num">' + fmtUsd(p.mcap_usd) + '</td>'
        + '<td class="num">' + fmtPct(p.change_7d) + '</td>'
        + '</tr>';
    }
    liveBody.innerHTML = html || '<tr><td colspan="6">No live-token protocols in this snapshot.</td></tr>';
  })();

  // ---------- detail view ----------

  var detailEl = document.getElementById('detail');

  function renderDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) {
      detailEl.innerHTML = '<p>Unknown protocol: ' + esc(slug) + '. <a href="#/">Back to the board</a>.</p>';
      return;
    }
    var share = r.category_share == null ? null : r.category_share;
    var steps = '';
    for (var j = 0; j < r.farm_steps.length; j++) steps += '<li>' + esc(r.farm_steps[j]) + '</li>';
    detailEl.innerHTML =
      '<div class="detail-head"><h2>' + esc(r.name) + '</h2><span class="rank">Rank #' + r.rank + '</span>' + (r.watchlist ? '<span class="badge">watchlist</span>' : '') + '</div>'
      + '<p class="lede">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed')
      + ' · tracked since ' + esc(r.listed_at || 'unknown') + '. The snapshot records no token for this protocol.</p>'
      + '<div class="stats">'
      + '<div class="stat"><div class="k">Implied value</div><div class="v gold">' + fmtUsd(r.implied_value_usd) + '</div></div>'
      + '<div class="stat"><div class="k">TVL</div><div class="v">' + fmtUsd(r.tvl_usd) + '</div></div>'
      + '<div class="stat"><div class="k">7-day change</div><div class="v">' + fmtPct(r.change_7d) + '</div></div>'
      + '<div class="stat"><div class="k">Age</div><div class="v">' + fmtAge(r.age_days) + '</div></div>'
      + '</div>'
      + '<h3>Why this value</h3>'
      + '<table class="model-table"><tbody>'
      + '<tr><td>TVL × ' + (model.base_multiple == null ? '0.25' : model.base_multiple) + ' (base)</td><td>' + fmtUsd(r.tvl_usd * (model.base_multiple == null ? 0.25 : model.base_multiple)) + '</td></tr>'
      + '<tr><td>Growth × ' + r.growth_multiplier + ' (7d ' + (r.change_7d == null ? 'unreported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + ')</td><td>× ' + r.growth_multiplier + '</td></tr>'
      + '<tr><td>Maturity × ' + r.maturity_multiplier + ' (' + fmtAge(r.age_days) + ' old, hump peaks at ~18 months)</td><td>× ' + r.maturity_multiplier + '</td></tr>'
      + '<tr><td>Chains × ' + r.chain_multiplier + ' (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</td><td>× ' + r.chain_multiplier + '</td></tr>'
      + '<tr><td>Category × ' + r.category_multiplier + ' (' + esc(r.category || 'Uncategorised') + (share == null ? '' : ', ' + Math.round(share * 100) + '% of its protocols already record a token') + ')</td><td>× ' + r.category_multiplier + '</td></tr>'
      + '<tr><td><strong>Implied value</strong></td><td><strong>' + fmtUsd(r.implied_value_usd) + '</strong></td></tr>'
      + '</tbody></table>'
      + '<h3>Farm plan — ' + r.farm_steps.length + ' steps</h3>'
      + '<ol class="steps">' + steps + '</ol>'
      + '<p class="note">Implied value is this radar\'s model, not a promise a token launches. Never pay to claim an airdrop; claim only from the protocol\'s own page.</p>';
  }

  // ---------- controls ----------

  function fillSelect(el, values) {
    var cur = el.value;
    var opts = values.slice().sort();
    var html = '<option value="">All ' + (el.id === 'category' ? 'categories' : 'chains') + '</option>';
    for (var i = 0; i < opts.length; i++) html += '<option value="' + esc(opts[i]) + '"' + (opts[i] === cur ? ' selected' : '') + '>' + esc(opts[i]) + '</option>';
    el.innerHTML = html;
  }

  (function initControls() {
    var cats = {}, chains = {};
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].category) cats[rows[i].category] = true;
      for (var j = 0; j < rows[i].chains.length; j++) chains[rows[i].chains[j]] = true;
    }
    fillSelect(document.getElementById('category'), Object.keys(cats));
    fillSelect(document.getElementById('chain'), Object.keys(chains));
  })();

  document.getElementById('q').addEventListener('input', function (ev) { state.q = ev.target.value; renderBoard(); });
  document.getElementById('category').addEventListener('change', function (ev) { state.category = ev.target.value; renderBoard(); });
  document.getElementById('chain').addEventListener('change', function (ev) { state.chain = ev.target.value; renderBoard(); });
  document.getElementById('sort').addEventListener('change', function (ev) { state.sort = ev.target.value; renderBoard(); });
  document.getElementById('watchlist-only').addEventListener('change', function (ev) { state.watchlistOnly = ev.target.checked; renderBoard(); });

  document.querySelectorAll('#rows thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      state.sort = key === 'rank' || key === 'implied' ? 'rank' : key;
      document.getElementById('sort').value = state.sort;
      renderBoard();
    });
  });

  // ---------- sandbox ----------

  var note = document.getElementById('sandbox-note');
  function readSandbox() {
    var base = parseFloat(document.getElementById('s-base').value);
    var growth = parseFloat(document.getElementById('s-growth').value);
    var peak = parseInt(document.getElementById('s-peak').value, 10);
    var chain = parseFloat(document.getElementById('s-chain').value);
    document.getElementById('v-base').textContent = base.toFixed(2);
    document.getElementById('v-growth').textContent = growth.toFixed(2);
    document.getElementById('v-peak').textContent = String(peak);
    document.getElementById('v-chain').textContent = chain.toFixed(3);
    var isDefault = base === 0.25 && growth === 0.5 && peak === 540 && chain === 0.03;
    sandbox = isDefault ? null : { base: base, growth: growth, peak: peak, chain: chain };
    note.textContent = isDefault
      ? 'Defaults — the board below is the shipped ranking.'
      : 'Sandbox active — the board below is re-ranked with your constants, not the shipped ranking.';
    renderBoard();
  }
  ['s-base', 's-growth', 's-peak', 's-chain'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', readSandbox);
  });

  // ---------- routing ----------

  var views = { board: 'view-board', live: 'view-live', model: 'view-model', detail: 'view-detail' };

  function show(view) {
    state.view = view;
    for (var k in views) document.getElementById(views[k]).hidden = k !== view;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === (view === 'detail' ? 'board' : view));
    });
    main.setAttribute('aria-busy', 'false');
  }

  function route() {
    var hash = location.hash || '#/';
    var m = hash.match(/^#\/detail\/([\w.-]+)/);
    if (m) { renderDetail(m[1]); show('detail'); return; }
    if (hash.indexOf('#/live') === 0) { show('live'); return; }
    if (hash.indexOf('#/model') === 0) { show('model'); return; }
    // #/board?category=X&chain=Y&q=Z&sort=S&watchlist=1
    var qm = hash.match(/^#\/board\?(.*)$/);
    if (qm) {
      var params = new URLSearchParams(qm[1]);
      var cat = params.get('category'), ch = params.get('chain'), q = params.get('q'), s = params.get('sort'), w = params.get('watchlist');
      if (cat != null) { state.category = cat; document.getElementById('category').value = cat; }
      if (ch != null) { state.chain = ch; document.getElementById('chain').value = ch; }
      if (q != null) { state.q = q; document.getElementById('q').value = q; }
      if (s != null) { state.sort = s; document.getElementById('sort').value = s; }
      if (w != null) { state.watchlistOnly = w === '1'; document.getElementById('watchlist-only').checked = state.watchlistOnly; }
    }
    show('board');
    renderBoard();
  }

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      location.hash = '#/' + t.getAttribute('data-view');
    });
  });
  window.addEventListener('hashchange', route);

  // ---------- header ----------

  document.getElementById('meta').textContent =
    'Snapshot ' + R.as_of + ' · ' + R.watchlist_size + ' watchlist protocols · ' + R.board_size + ' ranked rows · ' + R.live_size + ' live-token protocols set aside · model ' + R.model_version;

  route();
})();
