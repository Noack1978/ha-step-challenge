/**
 * Step Challenge Panel
 * Custom Element – HA passes `hass`, `panel`, `narrow`, `route` as properties.
 * No token required.
 */

const COLORS  = ['#ffd700','#c0c0c0','#cd7f32','#5b8de8','#0ead69','#e94560','#b06cff','#ff9800'];
const FIGURES = ['🚀','🌟','💫','⚡','🔥','🎯','🏅','💎'];
const MEDALS  = ['🥇','🥈','🥉'];
const SC      = 'step_challenge';

class StepChallengeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass     = null;
    this._inited   = false;
    this._unsubFn  = null;         // cleanup handle for event subscription
    this._stateKey = '';           // hash of relevant states for change detection
  }

  // ── HA lifecycle ─────────────────────────────────────────────────────────

  set hass(hass) {
    this._hass = hass;

    if (!this._inited) {
      this._inited = true;
      this._render();
      this._subscribe();
      return;
    }

    // Only re-render when step_challenge states actually changed in value
    const key = this._stateHash(hass);
    if (key !== this._stateKey) {
      this._stateKey = key;
      this._render();
    }
  }

  set panel(v) { this._isPanel = true; this._render(); }
  set narrow(v) { /* not used, required by HA */ }
  set route(v)  { /* not used, required by HA */ }

  // Cleanup when element is removed from DOM
  disconnectedCallback() {
    if (this._unsubFn) {
      this._unsubFn();
      this._unsubFn = null;
    }
  }

  // ── State change detection ────────────────────────────────────────────────

  _stateHash(hass) {
    return Object.values(hass.states)
      .filter(s => s.entity_id.includes(SC))
      .map(s => `${s.entity_id}:${s.state}:${s.last_changed}`)
      .sort()
      .join('|');
  }

  // ── Live event subscription ───────────────────────────────────────────────

  _subscribe() {
    if (!this._hass?.connection) return;
    this._hass.connection
      .subscribeEvents(
        (msg) => {
          const eid = msg.data?.entity_id || '';
          if (eid.includes(SC)) this._render();
        },
        'state_changed'
      )
      .then(unsub => { this._unsubFn = unsub; })
      .catch(err => console.warn('Step Challenge Panel: event subscription failed', err));
  }

  // ── HA data helpers ───────────────────────────────────────────────────────

  _find(sub) {
    if (!this._hass) return null;
    return Object.values(this._hass.states).find(
      s => s.entity_id.includes(SC) && s.entity_id.includes(sub)
    );
  }

  _num(id) {
    const v = parseFloat(this._hass?.states[id]?.state);
    return isNaN(v) ? 0 : v;
  }

  _status()   { return this._find('_status')?.state || 'inactive'; }
  _elapsed()  { return parseInt(this._find('days_elapsed')?.state) || 0; }
  _total()    { return parseInt(this._find('days_elapsed')?.attributes?.duration_days) || 30; }
  _pct()      { return parseInt(this._find('days_elapsed')?.attributes?.progress_pct) || 0; }
  _start()    { return this._find('days_elapsed')?.attributes?.start_date || null; }
  _history()  { return this._find('_status')?.attributes?.history || []; }

  _name() {
    const s = this._find('_status');
    if (!s) return 'Step Challenge';
    return (s.attributes?.friendly_name || 'Step Challenge').replace(/\s*Status$/i, '');
  }

  _participants() {
    const leader = this._find('leader');
    if (!leader?.attributes?.scores) return [];
    const stages = Object.values(this._hass.states).filter(
      s => s.entity_id.includes(SC) && s.entity_id.includes('stage')
    );
    return Object.entries(leader.attributes.scores).map(([name, score]) => {
      const key    = name.toLowerCase().replace(/\s+/g, '_');
      const sensor = stages.find(s => s.attributes?.participant_key === key);
      return {
        name, score, key,
        steps:    sensor?.attributes?.step_entity ? this._num(sensor.attributes.step_entity) : 0,
        wonDates: sensor?.attributes?.won_dates || [],
      };
    });
  }

  _fmt(n)  { return Number(n).toLocaleString('de-DE'); }
  _fmtD(s) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
  }

  // ── Service calls ─────────────────────────────────────────────────────────

  _call(service) {
    this._hass?.callService(SC, service, {});
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _render() {
    const status  = this._status();
    const elapsed = this._elapsed();
    const total   = this._total();
    const pct     = this._pct();
    const name    = this._name();
    const start   = this._start();
    const history = this._history();

    const bCls = status==='active' ? 'b-active' : status==='finished' ? 'b-finished' : 'b-inactive';
    const bTxt = status==='active' ? 'Running'  : status==='finished' ? 'Finished'   : 'Inactive';

    let h = `
      <div class="header">
        ${this._isPanel ? `<button class="menu-btn" id="menu-btn" title="Menu">☰</button>` : ''}
        <div class="hl">
          <h1>🏁 ${name}</h1>
          <div class="sub">Day ${elapsed} of ${total}</div>
        </div>
        <span class="badge ${bCls}">${bTxt}</span>
      </div>
      <div class="prog-wrap">
        <div class="prog-meta"><span>Progress</span><b>${pct}%</b></div>
        <div class="prog-bg"><div class="prog-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="btn-wrap">
        <button class="btn btn-start" id="s">🚩 Start</button>
        <button class="btn btn-stop"  id="x">⏹ Stop</button>
        <button class="btn btn-rec"   id="r">📋 Record Day</button>
      </div>`;

    if (status === 'inactive') {
      h += `<div class="empty">
        <div class="icon">🏃</div>
        <h2>No challenge active</h2>
        <p>Press Start to begin the race.</p>
      </div>`;
      this._paint(h);
      this._bind();
      return;
    }

    const parts = this._participants().sort((a,b) => b.score-a.score || b.steps-a.steps);

    if (!parts.length) {
      h += `<div class="empty"><div class="icon">⚙️</div><h2>No participants found</h2></div>`;
      this._paint(h);
      this._bind();
      return;
    }

    if (status === 'finished') {
      h += `<div class="win-banner">
        <h2>🏆 ${parts[0].name} wins!</h2>
        <p>${parts[0].score} of ${total} stages won</p>
      </div>`;
    }

    const maxS = Math.max(...parts.map(p => p.score), 1);
    h += `<div class="sec"><div class="sec-label">🏎 Race – Stage Wins</div>`;
    parts.forEach((p, i) => {
      const c   = COLORS[i % COLORS.length];
      const fig = FIGURES[i % FIGURES.length];
      const med = MEDALS[i] || `${i+1}.`;
      const bp  = Math.max(4, Math.round((p.score / maxS) * 100));
      h += `<div class="lane"><div class="lane-inner">
        <div class="l-rank">${med}</div>
        <div class="l-avatar" style="border-color:${c};background:${c}18">🏃</div>
        <div class="l-info">
          <div class="l-name" style="color:${c}">${p.name}</div>
          <div class="l-steps">Today: <b>${this._fmt(p.steps)}</b> steps</div>
        </div>
        <div class="l-bar-wrap"><div class="l-bar-bg">
          <div class="l-bar-fill" data-pct="${bp}"
               style="width:4%;background:linear-gradient(90deg,${c}88,${c})">
            <span class="l-fig">${fig}</span>
          </div>
        </div></div>
        <div class="l-score" style="color:${c}">${p.score}</div>
      </div></div>`;
    });
    h += `</div>`;

    if (elapsed > 0 && start) h += this._cal(elapsed, total, parts, history, start);
    if (history.length > 0)   h += this._table(history.slice(-7).reverse(), parts);

    this._paint(h);
    this._bind();

    // Animate bars after paint
    setTimeout(() => {
      this.shadowRoot.querySelectorAll('.l-bar-fill[data-pct]').forEach(el => {
        const w = el.dataset.pct + '%';
        el.style.width = '0%';
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w; }));
      });
    }, 50);
  }

  _paint(html) {
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="root">${html}</div>`;
  }

  _bind() {
    this.shadowRoot.getElementById('s')?.addEventListener('click', () => this._call('start'));
    this.shadowRoot.getElementById('x')?.addEventListener('click', () => this._call('stop'));
    this.shadowRoot.getElementById('r')?.addEventListener('click', () => this._call('record_day'));
    this.shadowRoot.getElementById('menu-btn')?.addEventListener('click', () => {
      // Fire HA sidebar toggle event – same method used by Music Assistant / Beatify
      this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true }));
    });
  }

  _cal(elapsed, total, parts, history, startIso) {
    // Normalize start date to local midnight to avoid timezone drift
    const _sd0 = new Date(startIso);
    const sd   = new Date(_sd0.getFullYear(), _sd0.getMonth(), _sd0.getDate());
    const td   = new Date(); td.setHours(0,0,0,0);
    const cMap = {}; parts.forEach((p,i) => { cMap[p.key] = COLORS[i % COLORS.length]; });

    let h = `<div class="sec"><div class="sec-label">📅 Stage Calendar</div><div class="cal-grid">`;
    for (let d = 0; d < total; d++) {
      const dd = new Date(sd.getTime() + d * 86400000); dd.setHours(0,0,0,0);
      const isT = dd.getTime() === td.getTime(), isF = dd > td;
      const ent = history.find(e => {
        // Parse YYYY-MM-DD as local date (avoid UTC offset issues)
        const [ey, em, eday] = e.date.split('-').map(Number);
        const ed = new Date(ey, em - 1, eday);
        return Math.round((ed - sd) / 86400000) === d;
      });
      const w = ent?.winner, wc = w ? (cMap[w] || '#888') : null;
      let cls = 'cal-day'; if (isT) cls += ' today'; if (isF) cls += ' future';
      const bg  = wc ? `background:${wc}18;border-color:${wc}55;` : '';
      const dot = wc ? `<div class="dot" style="background:${wc}"></div>` : '';
      h += `<div class="${cls}" style="${bg}" title="Day ${d+1}${w?' · '+w:''}">${d+1}${dot}</div>`;
    }
    h += `</div><div class="leg">`;
    parts.forEach((p,i) => {
      h += `<div class="leg-item"><div class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></div>${p.name}</div>`;
    });
    return h + `</div></div>`;
  }

  _table(recent, parts) {
    let h = `<div class="sec"><div class="sec-label">📊 Recent Stages</div>
      <table><thead><tr><th>#</th><th>Date</th><th>Winner</th>`;
    parts.forEach(p => { h += `<th>${p.name}</th>`; });
    h += `</tr></thead><tbody>`;
    recent.forEach((e, i) => {
      const wk = e.winner || '', wp = parts.find(p => p.key === wk);
      h += `<tr>
        <td class="muted">${recent.length - i}</td>
        <td class="muted sm">${this._fmtD(e.date)}</td>
        <td>${wp ? wp.name : '—'}</td>`;
      parts.forEach((p, pi) => {
        const v = e.steps?.[p.key], iW = wk === p.key;
        h += `<td style="color:${iW?COLORS[pi%COLORS.length]:'var(--secondary-text-color)'};font-weight:${iW?700:400}">
          ${v !== undefined ? this._fmt(v) : '—'}</td>`;
      });
      h += `</tr>`;
    });
    return h + `</tbody></table></div>`;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
  :host {
    display: block;
    background: var(--primary-background-color);
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family,'Segoe UI',system-ui,sans-serif);
    min-height: 100vh;
  }
  .root { max-width: 860px; margin: 0 auto; padding-bottom: 40px; }

  .header { padding:16px 20px 14px; border-bottom:2px solid var(--accent-color,#e94560);
    display:flex; align-items:center; gap:12px; }
  .menu-btn { background:none; border:none; cursor:pointer; font-size:1.3rem;
    color:var(--primary-text-color); padding:4px 8px 4px 0; line-height:1;
    flex-shrink:0; opacity:.8; }
  .menu-btn:hover { opacity:1; }
  .header h1 { font-size:1.25rem; font-weight:700; margin:0; }
  .header .sub { font-size:.72rem; color:var(--secondary-text-color); margin-top:2px; }
  .hl { flex:1; }

  .badge { padding:3px 10px; border-radius:20px; font-size:.68rem;
    font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  .b-active   { background:rgba(14,173,105,.15); color:#0ead69; border:1px solid #0ead69; }
  .b-inactive { background:rgba(233,69,96,.15);  color:#e94560; border:1px solid #e94560; }
  .b-finished { background:rgba(255,215,0,.15);  color:#ffd700; border:1px solid #ffd700; }

  .prog-wrap { padding:12px 20px; border-bottom:1px solid var(--divider-color); }
  .prog-meta { display:flex; justify-content:space-between; font-size:.72rem;
    color:var(--secondary-text-color); margin-bottom:7px; }
  .prog-meta b { color:var(--primary-text-color); }
  .prog-bg { height:8px; background:var(--divider-color); border-radius:4px; overflow:hidden; }
  .prog-fill { height:100%; background:linear-gradient(90deg,var(--accent-color,#e94560),#ffd700);
    border-radius:4px; transition:width 1s ease; }

  .win-banner { margin:14px 18px 0; background:rgba(255,215,0,.08); border:1px solid #ffd700;
    border-radius:10px; padding:14px; text-align:center; animation:pulse 2s infinite; }
  .win-banner h2 { font-size:1.1rem; color:#ffd700; margin:0; }
  .win-banner p  { font-size:.8rem; color:var(--secondary-text-color); margin:4px 0 0; }
  @keyframes pulse {
    0%,100% { box-shadow:0 0 0 0 rgba(255,215,0,.3); }
    50%      { box-shadow:0 0 0 8px rgba(255,215,0,0); }
  }

  .btn-wrap { padding:12px 18px 16px; display:flex; gap:8px; flex-wrap:wrap; }
  .btn { padding:9px 16px; border-radius:8px; border:none; font-size:.82rem;
    font-weight:600; cursor:pointer; transition:opacity .2s; font-family:inherit; }
  .btn:hover { opacity:.8; }
  .btn-start { background:rgba(14,173,105,.15); color:#0ead69; border:1px solid #0ead69; }
  .btn-stop  { background:rgba(233,69,96,.15);  color:#e94560; border:1px solid #e94560; }
  .btn-rec   { background:rgba(255,215,0,.15);  color:#ffd700; border:1px solid #ffd700; }

  .sec { padding:14px 18px 6px; }
  .sec-label { font-size:.6rem; letter-spacing:.15em; text-transform:uppercase;
    color:var(--secondary-text-color); margin-bottom:10px; }

  .lane { background:var(--card-background-color); border-radius:10px;
    border:1px solid var(--divider-color); margin-bottom:9px; overflow:hidden; }
  .lane-inner { padding:9px 12px; display:flex; align-items:center; gap:9px; }
  .l-rank   { font-size:1.1rem; width:26px; text-align:center; flex-shrink:0; }
  .l-avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:1rem; flex-shrink:0; border:2px solid transparent; }
  .l-info   { flex:1; min-width:0; }
  .l-name   { font-size:.88rem; font-weight:600; }
  .l-steps  { font-size:.68rem; color:var(--secondary-text-color); margin-top:2px; }
  .l-steps b { color:#ffd700; }
  .l-bar-wrap { flex:2; min-width:0; }
  .l-bar-bg { height:13px; background:var(--divider-color); border-radius:7px;
    overflow:hidden; position:relative; }
  .l-bar-fill { height:100%; border-radius:7px;
    transition:width 1.2s cubic-bezier(.34,1.56,.64,1); position:relative; }
  .l-bar-fill::after { content:''; position:absolute; right:0; top:0; height:100%;
    width:18px; background:rgba(255,255,255,.2); border-radius:7px; animation:shim 1.5s infinite; }
  @keyframes shim { 0%,100%{opacity:.3;} 50%{opacity:.8;} }
  .l-fig { font-size:1.3rem; position:absolute; right:-2px; top:-3px;
    filter:drop-shadow(0 0 4px rgba(255,215,0,.5)); animation:bou .8s infinite alternate; }
  @keyframes bou { from{transform:translateY(0);} to{transform:translateY(-3px);} }
  .l-score { font-size:1.05rem; font-weight:800; min-width:32px; text-align:right; flex-shrink:0; }

  .cal-grid { display:flex; flex-wrap:wrap; gap:3px; }
  .cal-day { width:26px; height:26px; border-radius:5px; display:flex; align-items:center;
    justify-content:center; font-size:.58rem; font-weight:700;
    border:1px solid var(--divider-color); background:var(--card-background-color);
    color:var(--secondary-text-color); position:relative; cursor:default; transition:transform .2s; }
  .cal-day:hover { transform:scale(1.25); z-index:1; }
  .cal-day.today  { border-color:var(--accent-color,#e94560); color:var(--accent-color,#e94560); }
  .cal-day.future { opacity:.35; }
  .dot { position:absolute; bottom:2px; left:50%; transform:translateX(-50%);
    width:4px; height:4px; border-radius:50%; }
  .leg { display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
  .leg-item { display:flex; align-items:center; gap:4px; font-size:.68rem;
    color:var(--secondary-text-color); }
  .leg-dot { width:9px; height:9px; border-radius:50%; }

  table { width:100%; border-collapse:collapse; font-size:.78rem; }
  th { text-align:left; color:var(--secondary-text-color); font-weight:600;
    padding:5px 7px; border-bottom:1px solid var(--divider-color); font-size:.67rem; }
  td { padding:6px 7px; border-bottom:1px solid var(--divider-color); }
  tr:last-child td { border-bottom:none; }
  .muted { color:var(--secondary-text-color); }
  .sm    { font-size:.7rem; }

  .empty { display:flex; align-items:center; justify-content:center; min-height:50vh;
    flex-direction:column; gap:12px; padding:40px 20px; text-align:center; }
  .empty .icon { font-size:3.5rem; }
  .empty h2 { color:var(--secondary-text-color); font-size:1.1rem; margin:0; }
  .empty p  { color:var(--secondary-text-color); font-size:.82rem; max-width:280px; margin:0; }

  @media(max-width:480px) { .l-bar-wrap { display:none; } }
`;

customElements.define('step-challenge-card', StepChallengeCard);

