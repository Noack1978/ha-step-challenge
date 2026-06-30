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
    this._showToday = false;       // toggle for today's stage zoom
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
        <button class="btn btn-track ${this._showToday ? 'btn-track-on' : ''}" id="td">📍 Heute</button>
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
    if (this._showToday && elapsed > 0 && start) h += this._todayStage(elapsed, total, parts, history, start);
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
    this.shadowRoot.getElementById('td')?.addEventListener('click', () => {
      this._showToday = !this._showToday;
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


  _todayStage(elapsed, total, parts, history, startIso) {
    const W = 800, H = 220, PAD_L = 48, PAD_R = 48, PAD_T = 36, PAD_B = 48;
    const TW = W - PAD_L - PAD_R;
    const TH = H - PAD_T - PAD_B;

    // ── Same deterministic terrain as full track ───────────────────────────
    const seed = (this._name().split('').reduce((a,c)=>a+c.charCodeAt(0),0) + total)|0;
    const rng  = (i) => { const x = Math.sin(seed+i)*43758.5453; return x-Math.floor(x); };

    // Elevation points for ALL days (same as full track)
    const allElev = [];
    allElev.push(0.55);
    for (let d = 1; d < total; d++) {
      const mid = Math.abs(d/total - 0.5) < 0.38;
      allElev.push((mid?0.2:0.55) + rng(d*7)*(mid?0.55:0.3));
    }
    allElev.push(0.5);

    // Extract only the current stage segment (elapsed-1 → elapsed)
    // We need a few extra points for smooth catmull-rom at boundaries
    const stageStart = elapsed - 1;
    const stageEnd   = elapsed;

    // Take 2 extra points on each side for smooth spline
    const iFrom = Math.max(stageStart - 2, 0);
    const iTo   = Math.min(stageEnd   + 2, total);

    // Map these points to fill the full width PAD_L..PAD_L+TW
    // The stage itself (stageStart..stageEnd) maps to PAD_L..PAD_L+TW
    const segCount = iTo - iFrom;
    const segPx = [];
    const segPy = [];
    for (let i = iFrom; i <= iTo; i++) {
      // X: map i relative to stage boundaries → full width
      const fracInStage = (i - stageStart); // -2..0..1..3
      segPx.push(PAD_L + (fracInStage / 1) * TW);
      segPy.push(PAD_T + allElev[Math.min(i, total)] * TH);
    }

    // Catmull-rom through segment points
    const catmull = (xs, ys) => {
      let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
      for (let i = 0; i < xs.length - 1; i++) {
        const p0=Math.max(i-1,0), p1=i, p2=i+1, p3=Math.min(i+2,xs.length-1);
        const cp1x=xs[p1]+(xs[p2]-xs[p0])/6, cp1y=ys[p1]+(ys[p2]-ys[p0])/6;
        const cp2x=xs[p2]-(xs[p3]-xs[p1])/6, cp2y=ys[p2]-(ys[p3]-ys[p1])/6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;
      }
      return d;
    };

    const fullPath = catmull(segPx, segPy);

    // Stage section: only PAD_L to PAD_L+TW (clip extra points)
    const stageAreaPath = fullPath +
      ` L ${(PAD_L+TW).toFixed(1)} ${(PAD_T+TH).toFixed(1)}` +
      ` L ${PAD_L.toFixed(1)} ${(PAD_T+TH).toFixed(1)} Z`;

    // ── Get Y at fraction t along stage (0=start, 1=end) ──────────────────
    const getY = (t) => {
      // t maps to index offset from stageStart
      const fracIdx = t + (stageStart - iFrom); // offset in segPx
      const seg2  = Math.min(Math.floor(fracIdx), segPx.length-2);
      const lt    = fracIdx - seg2;
      const p0=Math.max(seg2-1,0), p1=seg2, p2=Math.min(seg2+1,segPx.length-1), p3=Math.min(seg2+2,segPx.length-1);
      const cp1y=segPy[p1]+(segPy[p2]-segPy[p0])/6;
      const cp2y=segPy[p2]-(segPy[p3]-segPy[p1])/6;
      const u=1-lt;
      return u*u*u*segPy[p1]+3*u*u*lt*cp1y+3*u*lt*lt*cp2y+lt*lt*lt*segPy[p2];
    };
    const getX = (t) => PAD_L + t * TW;

    // ── Time of day ────────────────────────────────────────────────────────
    const now3 = new Date();
    const todayFrac = Math.min(
      (now3.getHours()*3600 + now3.getMinutes()*60 + now3.getSeconds()) / (21*3600), 1
    );
    const timeStr = now3.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});

    // ── Participant positions (0..1 along today's stage) ──────────────────
    const maxSteps = Math.max(...parts.map(p=>p.steps), 1);
    const sorted2  = [...parts].sort((a,b) => b.steps - a.steps);

    // ── Background: shade elapsed portion ─────────────────────────────────
    const elapsedBg = `<rect x="${PAD_L}" y="${PAD_T}"
      width="${(TW * todayFrac).toFixed(1)}" height="${TH}"
      fill="rgba(255,255,255,0.03)" rx="4"/>`;

    // Time marker
    const timeX = PAD_L + todayFrac * TW;
    const timeLine = `
      <line x1="${timeX.toFixed(1)}" y1="${PAD_T}" x2="${timeX.toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
        stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="${timeX.toFixed(1)}" y="${(PAD_T-8).toFixed(1)}" text-anchor="middle"
        font-size="9" fill="rgba(255,255,255,0.5)">${timeStr}</text>`;

    // ── Dots + info rows ───────────────────────────────────────────────────
    let dots = '', infoRows = '';
    sorted2.forEach((p, i) => {
      const stepRatio = p.steps / maxSteps;
      const t = stepRatio * todayFrac;       // position along stage
      const dx = getX(t);
      const dy = getY(t);
      const color = COLORS[parts.indexOf(p) % COLORS.length];
      const isLeader = i === 0;
      const r = isLeader ? 10 : 7;
      const labelY = i % 2 === 0 ? dy - r - 7 : dy + r + 13;

      dots += `
        <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${r}"
          fill="${color}" stroke="var(--card-background-color)" stroke-width="2"
          ${isLeader ? 'filter="url(#glow2)"' : ''}/>
        <text x="${dx.toFixed(1)}" y="${labelY.toFixed(1)}"
          text-anchor="${t > 0.8 ? 'end' : t < 0.2 ? 'start' : 'middle'}"
          font-size="${isLeader ? 10 : 9}" font-weight="${isLeader ? 700 : 400}"
          fill="${color}">${p.name}</text>`;

      // Progress bar row below SVG
      const pct = Math.round(stepRatio * 100);
      infoRows += `
        <div class="today-row">
          <div class="today-dot" style="background:${color}"></div>
          <div class="today-name">${p.name}</div>
          <div class="today-bar-wrap">
            <div class="today-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="today-steps">${this._fmt(p.steps)}</div>
          <div class="today-pct" style="color:${color}">${pct}%</div>
        </div>`;
    });

    // Stage label (e.g. "Etappe 6 von 30")
    const [sy2, sm2, sd2] = startIso.split('T')[0].split('-').map(Number);
    const stageDate = new Date(sy2, sm2-1, sd2+elapsed-1);
    const dateStr = stageDate.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});

    return `<div class="sec">
      <div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
        <span>📍 Stage ${elapsed} of ${total}</span>
        <span style="font-size:.7rem;color:var(--secondary-text-color)">${dateStr}</span>
      </div>
      <div class="track-wrap">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;height:auto;display:block;overflow:visible">
          <defs>
            <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.02"/>
            </linearGradient>
            <filter id="glow2"><feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <clipPath id="stageClip">
              <rect x="${PAD_L}" y="0" width="${TW}" height="${H}"/>
            </clipPath>
          </defs>

          <!-- Stage area fill (clipped to stage boundaries) -->
          <path d="${stageAreaPath}" fill="url(#tg2)" clip-path="url(#stageClip)"/>

          <!-- Elapsed time shading -->
          ${elapsedBg}

          <!-- Full spline (clipped so only stage segment visible) -->
          <path d="${fullPath}" fill="none"
            stroke="var(--accent-color,#e94560)" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round"
            clip-path="url(#stageClip)"/>

          <!-- Faded continuation lines -->
          <path d="${fullPath}" fill="none"
            stroke="var(--accent-color,#e94560)" stroke-width="1.5" opacity="0.2"
            stroke-dasharray="5,4"/>

          <!-- Start / End markers -->
          <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${(PAD_T+TH).toFixed(1)}"
            stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <line x1="${(PAD_L+TW).toFixed(1)}" y1="${PAD_T}" x2="${(PAD_L+TW).toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
            stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <text x="${PAD_L}" y="${(PAD_T+TH+16).toFixed(1)}" text-anchor="middle" font-size="14">🏁</text>
          <text x="${(PAD_L+TW).toFixed(1)}" y="${(PAD_T+TH+16).toFixed(1)}" text-anchor="middle" font-size="14">🏁</text>
          <text x="${PAD_L}" y="${(PAD_T+TH+30).toFixed(1)}" text-anchor="middle"
            font-size="8" fill="var(--secondary-text-color)">Start</text>
          <text x="${(PAD_L+TW).toFixed(1)}" y="${(PAD_T+TH+30).toFixed(1)}" text-anchor="middle"
            font-size="8" fill="var(--secondary-text-color)">Ziel</text>

          <!-- Time marker -->
          ${timeLine}

          <!-- Participant dots -->
          ${dots}
        </svg>

        <!-- Info rows -->
        <div class="today-info">${infoRows}</div>
      </div>
    </div>`;
  }

  _raceTrack(elapsed, total, parts, history, startIso) {
    const W = 800, H = 200, PAD_L = 40, PAD_R = 40, PAD_T = 30, PAD_B = 44;
    const TW = W - PAD_L - PAD_R;
    const TH = H - PAD_T - PAD_B;

    // ── Deterministic terrain ─────────────────────────────────────────────────
    const seed = (this._name().split('').reduce((a,c) => a + c.charCodeAt(0), 0) + total) | 0;
    const rng = (i) => { const x = Math.sin(seed + i) * 43758.5453; return x - Math.floor(x); };

    // One elevation point per day boundary (total+1 points for 0..total)
    const elevY = [];
    elevY.push(0.55); // start
    for (let d = 1; d < total; d++) {
      const mid = Math.abs(d / total - 0.5) < 0.38;
      const base = mid ? 0.2 : 0.55;
      const range = mid ? 0.55 : 0.3;
      elevY.push(base + rng(d * 7) * range);
    }
    elevY.push(0.5); // finish

    // Convert to SVG coords
    const toX = (d) => PAD_L + (d / total) * TW;
    const toY = (e) => PAD_T + e * TH;

    // Catmull-Rom through all day-boundary points
    const allX = elevY.map((_, i) => toX(i));
    const allY = elevY.map(e => toY(e));

    const catmull = (xs, ys) => {
      let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
      for (let i = 0; i < xs.length - 1; i++) {
        const p0 = Math.max(i-1, 0), p1=i, p2=i+1, p3=Math.min(i+2, xs.length-1);
        const cp1x = xs[p1] + (xs[p2]-xs[p0])/6, cp1y = ys[p1] + (ys[p2]-ys[p0])/6;
        const cp2x = xs[p2] - (xs[p3]-xs[p1])/6, cp2y = ys[p2] - (ys[p3]-ys[p1])/6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;
      }
      return d;
    };

    // Get Y at fractional day position using cubic bezier interpolation
    const getYatDay = (dayFrac) => {
      const seg = Math.min(Math.floor(dayFrac), total - 1);
      const t   = dayFrac - seg;
      const p0 = Math.max(seg-1,0), p1=seg, p2=Math.min(seg+1,total), p3=Math.min(seg+2,total);
      const cp1y = allY[p1] + (allY[p2]-allY[p0])/6;
      const cp2y = allY[p2] - (allY[p3]-allY[p1])/6;
      const u = 1-t;
      return u*u*u*allY[p1] + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*allY[p2];
    };
    const getXatDay = (dayFrac) => PAD_L + (dayFrac / total) * TW;

    const trackPath = catmull(allX, allY);
    const areaPath  = trackPath + ` L ${allX[allX.length-1].toFixed(1)} ${(PAD_T+TH).toFixed(1)} L ${allX[0].toFixed(1)} ${(PAD_T+TH).toFixed(1)} Z`;

    // ── Etappen-Markierungen ──────────────────────────────────────────────────
    let markers = '';
    for (let d = 1; d < total; d++) {
      const mx = toX(d);
      const done = d < elapsed;
      markers += `<line x1="${mx.toFixed(1)}" y1="${PAD_T}" x2="${mx.toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
        stroke="${done ? '#ffffff18' : '#ffffff08'}" stroke-width="1" stroke-dasharray="3,4"/>`;
    }
    // Day labels – show every day if ≤ 31, else every 5
    for (let d = 0; d <= total; d++) {
      if (total <= 31 || d % 5 === 0) {
        markers += `<text x="${toX(d).toFixed(1)}" y="${(PAD_T+TH+14).toFixed(1)}"
          text-anchor="middle" font-size="8" fill="#6b6b8a">${d}</text>`;
      }
    }

    // ── Today marker ──────────────────────────────────────────────────────────
    const todayX = toX(elapsed);
    const todayMarker = `<line x1="${todayX.toFixed(1)}" y1="${PAD_T}" x2="${todayX.toFixed(1)}" y2="${(PAD_T+TH).toFixed(1)}"
      stroke="var(--accent-color,#e94560)" stroke-width="1.5" opacity="0.7"/>
      <text x="${todayX.toFixed(1)}" y="${(PAD_T-6).toFixed(1)}" text-anchor="middle"
        font-size="8" fill="var(--accent-color,#e94560)" opacity="0.8">heute</text>`;

    // ── Participant positions ─────────────────────────────────────────────────
    // For each completed day: winner is at day boundary, others proportionally behind
    // For current day: position within today's etappe based on steps × time-of-day

    // Build per-day step map from history
    const daySteps = {}; // daySteps[d] = {key: steps}
    history.forEach(e => {
      const [ey, em, eday2] = e.date.split('-').map(Number);
      const ed = new Date(ey, em-1, eday2);
      const [sy, sm, sday] = startIso.split('T')[0].split('-').map(Number);
      const sd = new Date(sy, sm-1, sday);
      const dayNum = Math.round((ed - sd) / 86400000) + 1; // 1-indexed
      daySteps[dayNum] = e.steps || {};
    });

    // Cumulative day position for each participant
    // After day d: position = d + (own_steps_d / max_steps_d * 0 gap) → all at d
    // Actually: winner is exactly at day d boundary.
    // Others are placed at d - (1 - ratio) * stage_gap
    // where stage_gap = fraction of one stage they "lost"
    // Simpler: all at same X per completed day (they all finished the stage)
    // Visual interest: within each completed stage, show finishing order
    // → for completed days: dots stacked slightly offset at day boundary
    // → for current day: dots at partial position within today's stage

    const now2 = new Date();
    const todayFrac = Math.min(
      (now2.getHours() * 3600 + now2.getMinutes() * 60 + now2.getSeconds()) / (21 * 3600),
      1
    ); // fraction of active day (assume day ends at 21:00)

    // Position per participant: a fractional day value
    const posDay = {};
    parts.forEach(p => { posDay[p.key] = 0; });

    // For each completed stage, winner is at stage end, others proportionally behind within stage
    for (let d = 1; d <= Math.min(elapsed - 1, history.length); d++) {
      const stepsToday = daySteps[d] || {};
      const maxS = Math.max(...Object.values(stepsToday), 1);
      parts.forEach(p => {
        const ratio = (stepsToday[p.key] || 0) / maxS;
        // Move to start of this stage + fraction of stage based on ratio
        // Winner (ratio=1) reaches end of stage (day d)
        // Others reach proportionally less
        posDay[p.key] = (d - 1) + ratio;
      });
    }

    // Current day (elapsed): partial position within today's stage
    const todayStepsMap = {};
    parts.forEach(p => { todayStepsMap[p.key] = p.steps; });
    const maxTodaySteps = Math.max(...parts.map(p => p.steps), 1);
    parts.forEach(p => {
      const stepRatio = p.steps / maxTodaySteps;
      // Position: start of today's stage + (stepRatio × todayFrac)
      posDay[p.key] = (elapsed - 1) + stepRatio * todayFrac;
    });

    // ── Draw dots ─────────────────────────────────────────────────────────────
    const sorted = [...parts].sort((a,b) => posDay[a.key] - posDay[b.key]);
    let dots = '';
    sorted.forEach((p, i) => {
      const dayPos = posDay[p.key];
      const dx = getXatDay(dayPos);
      const dy = getYatDay(dayPos);
      const color = COLORS[parts.indexOf(p) % COLORS.length];
      const isLeader = i === sorted.length - 1;
      const r = isLeader ? 8 : 6;

      // Offset overlapping dots slightly vertically
      const yOff = (sorted.length > 1 && Math.abs(posDay[p.key] - posDay[sorted[i===0?1:i-1]?.key||'']) < 0.05)
        ? (i % 2 === 0 ? -8 : 8) : 0;

      dots += `<circle cx="${dx.toFixed(1)}" cy="${(dy+yOff).toFixed(1)}" r="${r}"
        fill="${color}" stroke="var(--card-background-color)" stroke-width="2"
        ${isLeader ? 'filter="url(#glow)"' : ''}/>`;

      // Label: alternate above/below
      const labelY = i % 2 === 0 ? dy + yOff - r - 5 : dy + yOff + r + 11;
      dots += `<text x="${dx.toFixed(1)}" y="${labelY.toFixed(1)}"
        text-anchor="${dayPos > total * 0.85 ? 'end' : 'middle'}"
        font-size="9" font-weight="${isLeader ? 700 : 400}"
        fill="${color}">${p.name}</text>`;
    });

    return `<div class="sec">
      <div class="sec-label">🗺 Total Steps Race</div>
      <div class="track-wrap">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;height:auto;display:block;overflow:visible">
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.02"/>
            </linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <path d="${areaPath}" fill="url(#tg)"/>
          ${markers}
          ${todayMarker}
          <path d="${trackPath}" fill="none"
            stroke="var(--accent-color,#e94560)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

          <!-- Start / Finish -->
          <text x="${(PAD_L-6).toFixed(1)}" y="${(PAD_T+TH+14).toFixed(1)}" text-anchor="middle" font-size="13">🏁</text>
          <text x="${(PAD_L+TW+6).toFixed(1)}" y="${(PAD_T+TH+14).toFixed(1)}" text-anchor="middle" font-size="13">🏆</text>

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

  /* Today stage info rows */
  .today-info { padding: 10px 12px 6px; display: flex; flex-direction: column; gap: 7px; }
  .today-row { display: flex; align-items: center; gap: 8px; }
  .today-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .today-name { font-size: .82rem; font-weight: 600; min-width: 60px; flex-shrink: 0; }
  .today-bar-wrap { flex: 1; height: 8px; background: var(--divider-color); border-radius: 4px; overflow: hidden; }
  .today-bar-fill { height: 100%; border-radius: 4px; transition: width 1s ease; }
  .today-steps { font-size: .78rem; color: var(--secondary-text-color); min-width: 52px; text-align: right; flex-shrink: 0; }
  .today-pct   { font-size: .75rem; font-weight: 700; min-width: 36px; text-align: right; flex-shrink: 0; }

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
