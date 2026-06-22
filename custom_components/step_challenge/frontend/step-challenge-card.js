/**
 * Step Challenge Card
 * Custom Lovelace card - uses hass object directly, no token needed.
 */

const COLORS  = ['#ffd700','#c0c0c0','#cd7f32','#5b8de8','#0ead69','#e94560','#b06cff','#ff9800'];
const FIGURES = ['🚀','🌟','💫','⚡','🔥','🎯','🏅','💎'];
const MEDALS  = ['🥇','🥈','🥉'];
const DOMAIN  = 'step_challenge';

const STYLES = `
  :host {
    display: block;
    --sc-bg: var(--card-background-color, #1a1a2e);
    --sc-accent: #e94560;
    --sc-gold: #ffd700;
    --sc-text: var(--primary-text-color, #e8e8f0);
    --sc-muted: var(--secondary-text-color, #6b6b8a);
    --sc-track: rgba(0,0,0,0.2);
    --sc-r: 10px;
  }
  ha-card { padding: 0; overflow: hidden; }

  .header {
    padding: 14px 16px 12px;
    border-bottom: 2px solid var(--sc-accent);
    display: flex; align-items: center; gap: 10px;
  }
  .header h1 { font-size: 1.1rem; font-weight: 700; flex: 1; margin: 0; }
  .header .sub { font-size: .7rem; color: var(--sc-muted); margin-top: 2px; }
  .hl { flex: 1; }

  .badge {
    padding: 3px 9px; border-radius: 20px; font-size: .65rem;
    font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  }
  .b-active   { background: #0ead6922; color: #0ead69; border: 1px solid #0ead69; }
  .b-inactive { background: #e9456022; color: var(--sc-accent); border: 1px solid var(--sc-accent); }
  .b-finished { background: #ffd70022; color: var(--sc-gold); border: 1px solid var(--sc-gold); }

  .prog-wrap { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .prog-meta { display: flex; justify-content: space-between; font-size: .7rem;
    color: var(--sc-muted); margin-bottom: 6px; }
  .prog-meta b { color: var(--sc-text); }
  .prog-bg { height: 7px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
  .prog-fill { height: 100%; background: linear-gradient(90deg, var(--sc-accent), var(--sc-gold));
    border-radius: 4px; transition: width 1s ease; }

  .win-banner {
    margin: 12px 14px 0;
    background: rgba(255,215,0,0.08); border: 1px solid var(--sc-gold);
    border-radius: var(--sc-r); padding: 12px; text-align: center;
    animation: pulse 2s infinite;
  }
  .win-banner h2 { font-size: 1.1rem; color: var(--sc-gold); margin: 0; }
  .win-banner p  { font-size: .78rem; color: var(--sc-muted); margin: 4px 0 0; }
  @keyframes pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,215,0,.3); }
    50%      { box-shadow: 0 0 0 8px rgba(255,215,0,0); }
  }

  .sec { padding: 12px 14px 4px; }
  .sec-label { font-size: .6rem; letter-spacing: .15em; text-transform: uppercase;
    color: var(--sc-muted); margin-bottom: 8px; }

  .lane {
    background: var(--sc-track); border-radius: var(--sc-r);
    border: 1px solid rgba(255,255,255,0.06); margin-bottom: 8px; overflow: hidden;
  }
  .lane-inner { padding: 8px 11px; display: flex; align-items: center; gap: 8px; }
  .l-rank   { font-size: 1rem; width: 24px; text-align: center; flex-shrink: 0; }
  .l-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; font-size: .9rem;
    flex-shrink: 0; border: 2px solid transparent; }
  .l-info   { flex: 1; min-width: 0; }
  .l-name   { font-size: .85rem; font-weight: 600; }
  .l-steps  { font-size: .65rem; color: var(--sc-muted); margin-top: 2px; }
  .l-steps b { color: var(--sc-gold); }
  .l-bar-wrap { flex: 2; min-width: 0; }
  .l-bar-bg { height: 12px; background: rgba(255,255,255,0.06); border-radius: 6px;
    overflow: hidden; position: relative; }
  .l-bar-fill {
    height: 100%; border-radius: 6px;
    transition: width 1.2s cubic-bezier(.34,1.56,.64,1); position: relative;
  }
  .l-bar-fill::after {
    content: ''; position: absolute; right: 0; top: 0; height: 100%; width: 16px;
    background: rgba(255,255,255,0.2); border-radius: 6px;
    animation: shim 1.5s infinite;
  }
  @keyframes shim { 0%,100%{opacity:.3;} 50%{opacity:.8;} }
  .l-fig {
    font-size: 1.2rem; position: absolute; right: -2px; top: -3px;
    filter: drop-shadow(0 0 3px rgba(255,215,0,.5));
    animation: bou .8s infinite alternate;
  }
  @keyframes bou { from{transform:translateY(0);} to{transform:translateY(-3px);} }
  .l-score { font-size: 1rem; font-weight: 800; min-width: 28px; text-align: right; flex-shrink: 0; }

  .btn-wrap { padding: 10px 14px 14px; display: flex; gap: 7px; flex-wrap: wrap; }
  .btn {
    padding: 8px 14px; border-radius: 8px; border: none; font-size: .8rem;
    font-weight: 600; cursor: pointer; transition: opacity .2s; font-family: inherit;
  }
  .btn:hover { opacity: .8; }
  .btn-start { background: rgba(14,173,105,.15); color: #0ead69; border: 1px solid #0ead69; }
  .btn-stop  { background: rgba(233,69,96,.15);  color: var(--sc-accent); border: 1px solid var(--sc-accent); }
  .btn-rec   { background: rgba(255,215,0,.15);  color: var(--sc-gold); border: 1px solid var(--sc-gold); }

  .cal-grid { display: flex; flex-wrap: wrap; gap: 3px; }
  .cal-day {
    width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center;
    justify-content: center; font-size: .55rem; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
    color: var(--sc-muted); position: relative; cursor: default; transition: transform .15s;
  }
  .cal-day:hover { transform: scale(1.25); z-index: 1; }
  .cal-day.today  { border-color: var(--sc-accent); color: var(--sc-accent); }
  .cal-day.future { opacity: .3; }
  .dot { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
    width: 3px; height: 3px; border-radius: 50%; }
  .leg { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
  .leg-item { display: flex; align-items: center; gap: 4px; font-size: .65rem; color: var(--sc-muted); }
  .leg-dot  { width: 8px; height: 8px; border-radius: 50%; }

  table { width: 100%; border-collapse: collapse; font-size: .75rem; }
  th { text-align: left; color: var(--sc-muted); font-weight: 600; padding: 4px 6px;
       border-bottom: 1px solid rgba(255,255,255,0.08); font-size: .64rem; }
  td { padding: 5px 6px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  tr:last-child td { border-bottom: none; }

  .empty { display: flex; align-items: center; justify-content: center; min-height: 200px;
    flex-direction: column; gap: 10px; padding: 32px 16px; text-align: center; }
  .empty .icon { font-size: 3rem; }
  .empty h2 { color: var(--sc-muted); font-size: 1rem; margin: 0; }
  .empty p  { color: var(--sc-muted); font-size: .8rem; max-width: 250px; margin: 0; }
`;

class StepChallengeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._initialized = false;
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._render();
    } else {
      this._updateDynamic();
    }
  }

  getCardSize() { return 6; }

  getGridOptions() {
    return { rows: 6, columns: 12, min_rows: 4 };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _findEnt(sub) {
    if (!this._hass) return null;
    return Object.values(this._hass.states).find(s =>
      s.entity_id.includes('step_challenge') && s.entity_id.includes(sub)
    );
  }

  _stNum(id) {
    const v = parseFloat(this._hass?.states[id]?.state);
    return isNaN(v) ? 0 : v;
  }

  _getStatus()  { return this._findEnt('_status')?.state || 'inactive'; }
  _getElapsed() { return parseInt(this._findEnt('days_elapsed')?.state) || 0; }
  _getTotal()   { return parseInt(this._findEnt('days_elapsed')?.attributes?.duration_days) || 30; }
  _getPct()     { return parseInt(this._findEnt('days_elapsed')?.attributes?.progress_pct) || 0; }
  _getStart()   { return this._findEnt('days_elapsed')?.attributes?.start_date || null; }

  _getName() {
    const s = this._findEnt('_status');
    if (!s) return 'Step Challenge';
    return (s.attributes?.friendly_name || 'Step Challenge').replace(/\s*Status$/i, '');
  }

  _getParticipants() {
    const leader = this._findEnt('leader');
    if (!leader?.attributes?.scores) return [];
    const stageSensors = Object.values(this._hass.states).filter(s =>
      s.entity_id.includes('step_challenge') && s.entity_id.includes('stage')
    );
    return Object.entries(leader.attributes.scores).map(([name, score]) => {
      const key = name.toLowerCase().replace(/\s+/g, '_');
      const sensor = stageSensors.find(s => s.attributes?.participant_key === key);
      const stepEnt = sensor?.attributes?.step_entity || null;
      const wonDates = sensor?.attributes?.won_dates || [];
      return { name, score, key, steps: stepEnt ? this._stNum(stepEnt) : 0, wonDates };
    });
  }

  _getHistory(parts) {
    // Build history from all stage sensor won_dates
    const histMap = {};
    parts.forEach(p => {
      p.wonDates.forEach(date => {
        if (!histMap[date]) histMap[date] = { date, winner: p.key, steps: {} };
      });
    });
    return Object.values(histMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  _fmt(n) { return Number(n).toLocaleString('de-DE'); }
  _fmtD(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  // ── Service calls ──────────────────────────────────────────────────────────

  async _callService(service) {
    await this._hass.callService(DOMAIN, service, {});
    // Small delay then update display
    setTimeout(() => this._render(), 800);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    if (!this._hass) return;

    const status  = this._getStatus();
    const elapsed = this._getElapsed();
    const total   = this._getTotal();
    const pct     = this._getPct();
    const name    = this._getName();
    const startIso = this._getStart();

    const bCls = status==='active' ? 'b-active' : status==='finished' ? 'b-finished' : 'b-inactive';
    const bTxt = status==='active' ? 'Running' : status==='finished' ? 'Finished' : 'Inactive';

    let html = `
      <div class="header">
        <div class="hl">
          <h1>🏁 ${name}</h1>
          <div class="sub">Day ${elapsed} of ${total}</div>
        </div>
        <div class="badge ${bCls}">${bTxt}</div>
      </div>
      <div class="prog-wrap">
        <div class="prog-meta"><span>Progress</span><b>${pct}%</b></div>
        <div class="prog-bg"><div class="prog-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="btn-wrap">
        <button class="btn btn-start" id="btn-start">🚩 Start</button>
        <button class="btn btn-stop"  id="btn-stop">⏹ Stop</button>
        <button class="btn btn-rec"   id="btn-rec">📋 Record Day</button>
      </div>`;

    if (status === 'inactive') {
      html += `<div class="empty"><div class="icon">🏃</div>
        <h2>No challenge active</h2><p>Press Start to begin the race.</p></div>`;
      this._setContent(html);
      this._bindButtons();
      return;
    }

    const parts = this._getParticipants().sort((a,b) => b.score-a.score || b.steps-a.steps);

    if (!parts.length) {
      html += `<div class="empty"><div class="icon">⚙️</div><h2>No participants found</h2></div>`;
      this._setContent(html);
      this._bindButtons();
      return;
    }

    if (status === 'finished') {
      html += `<div class="win-banner"><h2>🏆 ${parts[0].name} wins!</h2>
        <p>${parts[0].score} of ${total} stages won</p></div>`;
    }

    const maxS = Math.max(...parts.map(p => p.score), 1);
    html += `<div class="sec"><div class="sec-label">🏎 Race – Stage Wins</div>`;
    parts.forEach((p, i) => {
      const c   = COLORS[i % COLORS.length];
      const fig = FIGURES[i % FIGURES.length];
      const med = MEDALS[i] || (i+1)+'.';
      const bp  = Math.max(4, Math.round((p.score / maxS) * 100));
      html += `<div class="lane"><div class="lane-inner">
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
    html += `</div>`;

    const history = this._getHistory(parts);
    if (elapsed > 0 && startIso) html += this._renderCal(elapsed, total, parts, history, startIso);
    if (history.length > 0) html += this._renderTable(history.slice(-7).reverse(), parts);

    this._setContent(html);
    this._bindButtons();

    // Animate bars after render
    setTimeout(() => {
      this.shadowRoot.querySelectorAll('.l-bar-fill[data-pct]').forEach(el => {
        const w = el.dataset.pct + '%';
        el.style.width = '0%';
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w; }));
      });
    }, 50);
  }

  _updateDynamic() {
    // On hass updates just re-render (guarded by initialized flag)
    this._render();
  }

  _setContent(html) {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>${html}</ha-card>`;
  }

  _bindButtons() {
    const root = this.shadowRoot;
    root.getElementById('btn-start')?.addEventListener('click', () => this._callService('start'));
    root.getElementById('btn-stop')?.addEventListener('click',  () => this._callService('stop'));
    root.getElementById('btn-rec')?.addEventListener('click',   () => this._callService('record_day'));
  }

  _renderCal(elapsed, total, parts, history, startIso) {
    const startDt = new Date(startIso);
    const today   = new Date(); today.setHours(0,0,0,0);
    const cMap    = {}; parts.forEach((p,i) => { cMap[p.key] = COLORS[i % COLORS.length]; });

    let h = `<div class="sec"><div class="sec-label">📅 Stage Calendar</div><div class="cal-grid">`;
    for (let d = 0; d < total; d++) {
      const dd = new Date(startDt.getTime() + d * 86400000); dd.setHours(0,0,0,0);
      const isT = dd.getTime() === today.getTime(), isF = dd > today;
      const ent = history.find(e => {
        const ed = new Date(e.date); ed.setHours(0,0,0,0);
        return Math.round((ed - startDt) / 86400000) === d;
      });
      const w  = ent?.winner, wc = w ? (cMap[w] || '#888') : null;
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

  _renderTable(recent, parts) {
    let h = `<div class="sec"><div class="sec-label">📊 Recent Stages</div><table>
      <thead><tr><th>#</th><th>Date</th><th>Winner</th>`;
    parts.forEach(p => { h += `<th>${p.name}</th>`; });
    h += `</tr></thead><tbody>`;
    recent.forEach((e, i) => {
      const wk = e.winner || '', wp = parts.find(p => p.key === wk);
      h += `<tr>
        <td style="color:var(--sc-muted)">${recent.length - i}</td>
        <td style="color:var(--sc-muted);font-size:.64rem">${this._fmtD(e.date)}</td>
        <td>${wp ? wp.name : '—'}</td>`;
      parts.forEach((p, pi) => {
        const v = e.steps?.[p.key], isW = wk === p.key;
        h += `<td style="color:${isW ? COLORS[pi%COLORS.length] : 'var(--sc-muted)'};font-weight:${isW?700:400}">
          ${v !== undefined ? this._fmt(v) : '—'}</td>`;
      });
      h += `</tr>`;
    });
    return h + `</tbody></table></div>`;
  }
}

customElements.define('step-challenge-card', StepChallengeCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'step-challenge-card',
  name:        'Step Challenge',
  preview:     false,
  description: 'Animated step-count race card for the Step Challenge integration.',
});
