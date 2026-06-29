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
    this._showTrack = false;       // toggle for race track view
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
        <button class="btn btn-track ${this._showTrack ? 'btn-track-on' : ''}" id="t">🗺 Route</button>
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
    if (this._showTrack && elapsed > 0 && start) h += this._raceTrack(elapsed, total, parts, history, start);
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
    this.shadowRoot.getElementById('t')?.addEventListener('click', () => {
      this._showTrack = !this._showTrack;
      this._render();
    });
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


  _raceTrack(elapsed, total, parts, history, startIso) {
    const W = 800, H = 180, PAD_L = 32, PAD_R = 32, PAD_T = 24, PAD_B = 36;
    const TW = W - PAD_L - PAD_R;  // track width
    const TH = H - PAD_T - PAD_B;  // track height

    // ── Deterministic terrain from challenge name + total days ───────────────
    // Seeded pseudo-random so the same challenge always shows the same profile
    const seed = (this._name().split('').reduce((a,c) => a + c.charCodeAt(0), 0) + total) | 0;
    const rng = (i) => { const x = Math.sin(seed + i) * 43758.5453; return x - Math.floor(x); };

    // Generate elevation profile: num control points proportional to total days
    const nPts = Math.max(6, Math.min(total + 2, 20));
    const ctrlX = [], ctrlY = [];
    ctrlX.push(0); ctrlY.push(0.5);
    for (let i = 1; i < nPts - 1; i++) {
      ctrlX.push(i / (nPts - 1));
      // Mountains in middle third, flatter at start/end
      const mid = Math.abs(i / (nPts - 1) - 0.5) < 0.35;
      const base = mid ? 0.25 : 0.6;
      ctrlY.push(base + rng(i * 7) * (mid ? 0.5 : 0.25));
    }
    ctrlX.push(1); ctrlY.push(0.5);

    // Convert control points to SVG path (catmull-rom spline)
    const px = ctrlX.map(x => PAD_L + x * TW);
    const py = ctrlY.map(y => PAD_T + y * TH);

    const catmull = (pts_x, pts_y) => {
      let d = `M ${pts_x[0].toFixed(1)} ${pts_y[0].toFixed(1)}`;
      for (let i = 0; i < pts_x.length - 1; i++) {
        const p0 = i > 0 ? i - 1 : i;
        const p1 = i, p2 = i + 1;
        const p3 = i < pts_x.length - 2 ? i + 2 : p2;
        const cp1x = pts_x[p1] + (pts_x[p2] - pts_x[p0]) / 6;
        const cp1y = pts_y[p1] + (pts_y[p2] - pts_y[p0]) / 6;
        const cp2x = pts_x[p2] - (pts_x[p3] - pts_x[p1]) / 6;
        const cp2y = pts_y[p2] - (pts_y[p3] - pts_y[p1]) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pts_x[p2].toFixed(1)} ${pts_y[p2].toFixed(1)}`;
      }
      return d;
    };

    const trackPath = catmull(px, py);

    // Area under the track (filled)
    const areaPath = trackPath + ` L ${px[px.length-1].toFixed(1)} ${(PAD_T + TH).toFixed(1)} L ${px[0].toFixed(1)} ${(PAD_T + TH).toFixed(1)} Z`;

    // ── Position of each participant on track ─────────────────────────────────
    // Total steps per participant across all history + today
    const [_sd0, startDt] = (() => {
      const s = new Date(startIso);
      return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate())];
    })();

    // Build cumulative steps per participant from history
    const cumSteps = {};
    parts.forEach(p => { cumSteps[p.key] = 0; });

    // Add steps from completed days
    history.forEach(e => {
      Object.entries(e.steps || {}).forEach(([k, v]) => {
        if (cumSteps[k] !== undefined) cumSteps[k] += v;
      });
    });

    // Add today's steps (partial, weighted by time of day)
    const now = new Date();
    const todayFraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    const todayWeight = Math.min(todayFraction / 0.9, 1); // assume 90% of steps by 21:36
    parts.forEach(p => {
      cumSteps[p.key] = (cumSteps[p.key] || 0) + p.steps * todayWeight;
    });

    // Max steps determines scale
    const maxCum = Math.max(...Object.values(cumSteps), 1);

    // Position = fraction along track [0..1]
    const pos = {};
    parts.forEach(p => { pos[p.key] = Math.min(cumSteps[p.key] / maxCum, 1); });

    // ── Get Y coordinate on catmull-rom at fraction t ─────────────────────────
    const getTrackY = (t) => {
      // Find segment
      const segCount = ctrlX.length - 1;
      const segT = t * segCount;
      const seg = Math.min(Math.floor(segT), segCount - 1);
      const lt = segT - seg;

      const i0 = Math.max(seg - 1, 0);
      const i1 = seg;
      const i2 = Math.min(seg + 1, ctrlX.length - 1);
      const i3 = Math.min(seg + 2, ctrlX.length - 1);

      const cp1x = px[i1] + (px[i2] - px[i0]) / 6;
      const cp1y = py[i1] + (py[i2] - py[i0]) / 6;
      const cp2x = px[i2] - (px[i3] - px[i1]) / 6;
      const cp2y = py[i2] - (py[i3] - py[i1]) / 6;

      // Cubic bezier Y at lt
      const u = 1 - lt;
      return u*u*u*py[i1] + 3*u*u*lt*cp1y + 3*u*lt*lt*cp2y + lt*lt*lt*py[i2];
    };

    const getTrackX = (t) => PAD_L + t * TW;

    // ── Etappen-Markierungen ──────────────────────────────────────────────────
    let etappenMarkers = '';
    for (let d = 1; d < total; d++) {
      const tx = PAD_L + (d / total) * TW;
      const isElapsed = d <= elapsed;
      etappenMarkers += `<line x1="${tx.toFixed(1)}" y1="${PAD_T}" x2="${tx.toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
        stroke="${isElapsed ? '#ffffff18' : '#ffffff08'}" stroke-width="1" stroke-dasharray="3,3"/>`;
      if (total <= 31 || d % 5 === 0) {
        etappenMarkers += `<text x="${tx.toFixed(1)}" y="${(PAD_T+TH+12).toFixed(1)}" text-anchor="middle"
          font-size="7" fill="#6b6b8a">${d}</text>`;
      }
    }

    // ── Today marker ──────────────────────────────────────────────────────────
    const todayX = PAD_L + (Math.min(elapsed, total) / total) * TW;
    const todayMarker = `<line x1="${todayX.toFixed(1)}" y1="${PAD_T}" x2="${todayX.toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
      stroke="var(--accent-color,#e94560)" stroke-width="1.5" opacity="0.6"/>`;

    // ── Participant dots ───────────────────────────────────────────────────────
    // Sort by position descending so leading dot renders on top
    const sortedParts = [...parts].sort((a,b) => pos[a.key] - pos[b.key]);
    let dots = '';
    sortedParts.forEach((p, i) => {
      const t = pos[p.key];
      const dx = getTrackX(t);
      const dy = getTrackY(t);
      const color = COLORS[parts.indexOf(p) % COLORS.length];
      const isLeader = i === sortedParts.length - 1;
      const r = isLeader ? 7 : 5.5;

      // Dot
      dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${r}"
        fill="${color}" stroke="var(--card-background-color)" stroke-width="1.5"
        filter="${isLeader ? 'url(#glow)' : ''}"/>`;

      // Name label: alternate above/below to avoid overlap
      const labelY = i % 2 === 0 ? dy - r - 4 : dy + r + 10;
      dots += `<text x="${dx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle"
        font-size="8" font-weight="${isLeader ? 700 : 400}" fill="${color}">${p.name}</text>`;
    });

    // ── SVG assembly ──────────────────────────────────────────────────────────
    return `<div class="sec">
      <div class="sec-label">🗺 Total Steps Race</div>
      <div class="track-wrap">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;height:auto;display:block;">
          <defs>
            <linearGradient id="trackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.15"/>
              <stop offset="100%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.03"/>
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <!-- Area fill under track -->
          <path d="${areaPath}" fill="url(#trackGrad)"/>

          <!-- Etappen markers -->
          ${etappenMarkers}

          <!-- Today marker -->
          ${todayMarker}

          <!-- Track line -->
          <path d="${trackPath}" fill="none"
            stroke="var(--accent-color,#e94560)" stroke-width="2.5" stroke-linecap="round"/>

          <!-- Start flag -->
          <text x="${(PAD_L - 2).toFixed(1)}" y="${(PAD_T + TH + 12).toFixed(1)}"
            text-anchor="middle" font-size="10">🏁</text>

          <!-- Finish flag -->
          <text x="${(PAD_L + TW + 2).toFixed(1)}" y="${(PAD_T + TH + 12).toFixed(1)}"
            text-anchor="middle" font-size="10">🏆</text>

          <!-- Day labels -->
          <text x="${PAD_L.toFixed(1)}" y="${(PAD_T + TH + 12).toFixed(1)}"
            text-anchor="middle" font-size="7" fill="#6b6b8a">0</text>
          <text x="${(PAD_L + TW).toFixed(1)}" y="${(PAD_T + TH + 12).toFixed(1)}"
            text-anchor="middle" font-size="7" fill="#6b6b8a">${total}</text>

          <!-- Participant dots (on top) -->
          ${dots}
        </svg>
      </div>
    </div>`;
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

  .btn-track { background:rgba(255,255,255,.06); color:var(--secondary-text-color); border:1px solid var(--divider-color); }
  .btn-track-on { background:rgba(233,69,96,.15); color:var(--accent-color,#e94560); border:1px solid var(--accent-color,#e94560); }

  .track-wrap {
    background: var(--card-background-color);
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    padding: 8px 4px 4px;
    overflow: hidden;
  }
`;

customElements.define('step-challenge-card', StepChallengeCard);
