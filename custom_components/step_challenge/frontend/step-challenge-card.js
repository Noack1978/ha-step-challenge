/**
 * Step Challenge Panel / Card
 * Follows the DHL-Tracking-Card pattern:
 * - _buildDOM() once in setConfig / first hass set
 * - set hass() only updates dynamic parts via targeted innerHTML
 * - Event listeners set once in _buildDOM(), never re-added
 */

const COLORS  = ['#ffd700','#c0c0c0','#cd7f32','#5b8de8','#0ead69','#e94560','#b06cff','#ff9800'];
const FIGURES = ['🚀','🌟','💫','⚡','🔥','🎯','🏅','💎'];
const MEDALS  = ['🥇','🥈','🥉'];
const SC      = 'step_challenge';

class StepChallengeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass        = null;
    this._initialized = false;
    this._isPanel     = false;
    this._showTrack   = false;
    this._showToday   = false;
    this._tableRows   = 7;
    this._showOv      = false;
    this._ovTab       = 'main';
    this._selArchive  = new Set();
    this._addingPart  = false;
    // Debounce service calls
    this._lastCall    = null;
  }

  // ── HA lifecycle ───────────────────────────────────────────────────────────

  setConfig(config) {
    if (!this._initialized) {
      this._buildDOM();
      this._initialized = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._buildDOM();
      this._initialized = true;
    }
    this._updateAll();
  }

  set panel(v) {
    this._isPanel = true;
    const mb = this.shadowRoot.getElementById('menu-btn');
    if (mb) mb.style.display = '';
  }
  set narrow(v) {}
  set route(v)  {}

  getCardSize() { return 8; }
  static getStubConfig() { return {}; }

  // ── Build DOM once ─────────────────────────────────────────────────────────

  _buildDOM() {
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
<div class="root">
  <div class="header">
    <button class="icon-btn" id="menu-btn" style="display:none">☰</button>
    <div class="hl">
      <h1 id="h-name">🏁 Step Challenge</h1>
      <div class="sub" id="h-sub">Day 0 of 30</div>
    </div>
    <button class="icon-btn" id="settings-btn">⚙️</button>
    <span class="badge b-inactive" id="h-badge">Inactive</span>
  </div>

  <div class="prog-wrap">
    <div class="prog-meta"><span>Progress</span><b id="prog-pct">0%</b></div>
    <div class="prog-bg"><div class="prog-fill" id="prog-fill" style="width:0%"></div></div>
  </div>

  <div class="btn-wrap">
    <button class="btn btn-track" id="btn-route">🗺 Route</button>
    <button class="btn btn-track" id="btn-heute">📍 Heute</button>
    <button class="btn btn-track" id="btn-rec">📋 Etappe werten</button>
  </div>

  <div id="win-banner" style="display:none" class="win-banner">
    <h2 id="win-text"></h2><p id="win-sub"></p>
  </div>

  <div class="sec" id="sec-race" style="display:none">
    <div class="sec-label">🏎 Race – Stage Wins</div>
    <div id="race-lanes"></div>
  </div>

  <div class="sec" id="sec-cal" style="display:none">
    <div class="sec-label">📅 Stage Calendar</div>
    <div class="cal-grid" id="cal-grid"></div>
    <div class="leg" id="cal-leg"></div>
  </div>

  <div id="sec-track" style="display:none"></div>
  <div id="sec-today" style="display:none"></div>

  <div class="sec" id="sec-table" style="display:none">
    <div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>📊 Recent Stages</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="row-btn" id="rows-less">−</button>
        <span class="muted sm" id="rows-count" style="min-width:80px;text-align:center">0 / 0</span>
        <button class="row-btn" id="rows-more">+</button>
        <button class="row-btn" id="rows-all">All</button>
      </div>
    </div>
    <div id="table-wrap"></div>
  </div>

  <div class="empty" id="sec-empty">
    <div class="icon">🏃</div>
    <h2>Keine Challenge aktiv</h2>
    <p>Über ⚙️ eine neue Challenge starten.</p>
  </div>
</div>

<div id="overlay" style="display:none"></div>`;

    // ── Bind all events ONCE ────────────────────────────────────────────────
    const root = this.shadowRoot;

    root.getElementById('menu-btn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('hass-toggle-menu', {bubbles:true, composed:true})));

    root.getElementById('settings-btn').addEventListener('click', () => {
      this._showOv = true; this._ovTab = 'main'; this._addingPart = false;
      this._updateOverlay();
    });

    root.getElementById('btn-route').addEventListener('click', () => {
      this._showTrack = !this._showTrack;
      root.getElementById('btn-route').classList.toggle('btn-on', this._showTrack);
      this._updateTrackViews();
    });

    root.getElementById('btn-heute').addEventListener('click', () => {
      this._showToday = !this._showToday;
      root.getElementById('btn-heute').classList.toggle('btn-on', this._showToday);
      this._updateTrackViews();
    });

    root.getElementById('btn-rec').addEventListener('click', () => this._call('record_day'));

    root.getElementById('rows-less').addEventListener('click', () => {
      this._tableRows = Math.max(1, this._tableRows - 7); this._updateTable();
    });
    root.getElementById('rows-more').addEventListener('click', () => {
      this._tableRows = Math.min(this._history().length, this._tableRows + 7); this._updateTable();
    });
    root.getElementById('rows-all').addEventListener('click', () => {
      this._tableRows = this._history().length; this._updateTable();
    });
  }

  // ── Data helpers ───────────────────────────────────────────────────────────

  _find(sub)   { return Object.values(this._hass?.states||{}).find(s => s.entity_id.includes(SC) && s.entity_id.includes(sub)); }
  _num(id)     { const v=parseFloat(this._hass?.states[id]?.state); return isNaN(v)?0:v; }
  _status()    { return this._find('_status')?.state||'inactive'; }
  _elapsed()   { return parseInt(this._find('days_elapsed')?.state)||0; }
  _total()     { return parseInt(this._find('days_elapsed')?.attributes?.duration_days)||30; }
  _pct()       { return parseInt(this._find('days_elapsed')?.attributes?.progress_pct)||0; }
  _start()     { return this._find('days_elapsed')?.attributes?.start_date||null; }
  _history()   { return this._find('_status')?.attributes?.history||[]; }
  _archive()   { return (this._find('_status')?.attributes?.archive||[]).slice().reverse(); }
  _recTime()   { return this._find('_status')?.attributes?.record_time||'23:00:00'; }

  _name() {
    const s = this._find('_status');
    return s ? (s.attributes?.friendly_name||'Step Challenge').replace(/\s*Status$/i,'') : 'Step Challenge';
  }

  _participants() {
    const leader = this._find('leader');
    if (!leader?.attributes?.scores) return [];
    const stages = Object.values(this._hass.states).filter(s => s.entity_id.includes(SC) && s.entity_id.includes('stage'));
    return Object.entries(leader.attributes.scores).map(([name, score]) => {
      const key    = name.toLowerCase().replace(/\s+/g,'_');
      const sensor = stages.find(s => s.attributes?.participant_key===key);
      return { name, score, key,
        steps:     sensor?.attributes?.step_entity ? this._num(sensor.attributes.step_entity) : 0,
        wonDates:  sensor?.attributes?.won_dates||[],
        stepEntity: sensor?.attributes?.step_entity||'' };
    });
  }

  _fmt(n)  { return Number(n).toLocaleString('de-DE'); }
  _fmtD(s) { if(!s) return '—'; return new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }

  // ── Service call with debounce ─────────────────────────────────────────────

  _call(service, data={}) {
    const now = Date.now(), key = service + JSON.stringify(data);
    if (this._lastCall?.key === key && now - this._lastCall.ts < 1000) return;
    this._lastCall = { key, ts: now };
    this._hass?.callService(SC, service, data);
  }

  // ── Main update (called on every hass change) ──────────────────────────────

  _updateAll() {
    if (!this._hass) return;
    const status  = this._status();
    const elapsed = this._elapsed();
    const total   = this._total();
    const pct     = this._pct();
    const name    = this._name();
    const root    = this.shadowRoot;

    // Header
    root.getElementById('h-name').textContent = `🏁 ${name}`;
    root.getElementById('h-sub').textContent  = `Day ${elapsed} of ${total}`;
    root.getElementById('prog-pct').textContent = `${pct}%`;
    root.getElementById('prog-fill').style.width = `${pct}%`;

    const badge = root.getElementById('h-badge');
    badge.className = 'badge ' + (status==='active'?'b-active':status==='finished'?'b-finished':'b-inactive');
    badge.textContent = status==='active'?'Running':status==='finished'?'Finished':'Inactive';

    const inactive = status === 'inactive';
    root.getElementById('sec-empty').style.display = inactive ? '' : 'none';
    root.getElementById('sec-race').style.display  = inactive ? 'none' : '';
    root.getElementById('sec-cal').style.display   = inactive ? 'none' : '';
    root.getElementById('sec-table').style.display = inactive ? 'none' : '';

    if (inactive) { root.getElementById('win-banner').style.display = 'none'; return; }

    const parts = this._participants().sort((a,b) => b.score-a.score||b.steps-a.steps);
    const history = this._history();
    const start   = this._start();

    // Winner banner
    const wb = root.getElementById('win-banner');
    if (status === 'finished' && parts.length) {
      wb.style.display = '';
      root.getElementById('win-text').textContent = `🏆 ${parts[0].name} gewinnt!`;
      root.getElementById('win-sub').textContent  = `${parts[0].score} von ${total} Etappen`;
    } else {
      wb.style.display = 'none';
    }

    // Race lanes
    this._updateLanes(parts);

    // Calendar
    if (elapsed > 0 && start) this._updateCal(elapsed, total, parts, history, start);

    // Track views
    this._updateTrackViews();

    // Table
    this._updateTable();

    // Overlay (refresh archive count etc.)
    if (this._showOv) this._updateOverlay();
  }

  // ── Race lanes ─────────────────────────────────────────────────────────────

  _updateLanes(parts) {
    const maxS = Math.max(...parts.map(p=>p.score), 1);
    let html = '';
    parts.forEach((p,i) => {
      const c=COLORS[i%COLORS.length], fig=FIGURES[i%FIGURES.length], med=MEDALS[i]||(i+1)+'.';
      const bp=Math.max(4,Math.round((p.score/maxS)*100));
      html += `<div class="lane"><div class="lane-inner">
        <div class="l-rank">${med}</div>
        <div class="l-avatar" style="border-color:${c};background:${c}18">🏃</div>
        <div class="l-info">
          <div class="l-name" style="color:${c}">${p.name}</div>
          <div class="l-steps">Today: <b>${this._fmt(p.steps)}</b> steps</div>
        </div>
        <div class="l-bar-wrap"><div class="l-bar-bg">
          <div class="l-bar-fill" data-pct="${bp}" style="width:4%;background:linear-gradient(90deg,${c}88,${c})">
            <span class="l-fig">${fig}</span>
          </div>
        </div></div>
        <div class="l-score" style="color:${c}">${p.score}</div>
      </div></div>`;
    });
    this.shadowRoot.getElementById('race-lanes').innerHTML = html;
    setTimeout(() => {
      this.shadowRoot.querySelectorAll('.l-bar-fill[data-pct]').forEach(el => {
        const w = el.dataset.pct+'%'; el.style.width='0%';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{ el.style.width=w; }));
      });
    }, 50);
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  _updateCal(elapsed, total, parts, history, startIso) {
    const _sd0=new Date(startIso), sd=new Date(_sd0.getFullYear(),_sd0.getMonth(),_sd0.getDate());
    const td=new Date(); td.setHours(0,0,0,0);
    const cMap={}; parts.forEach((p,i)=>{cMap[p.key]=COLORS[i%COLORS.length];});
    let grid='', leg='';
    for(let d=0;d<total;d++){
      const dd=new Date(sd.getTime()+d*86400000); dd.setHours(0,0,0,0);
      const isT=dd.getTime()===td.getTime(), isF=dd>td;
      const ent=history.find(e=>{const [ey,em,eday]=e.date.split('-').map(Number); return Math.round((new Date(ey,em-1,eday)-sd)/86400000)===d;});
      const w=ent?.winner, wc=w?(cMap[w]||'#888'):null;
      let cls='cal-day'; if(isT)cls+=' today'; if(isF)cls+=' future';
      const bg=wc?`background:${wc}18;border-color:${wc}55;`:'';
      const dot=wc?`<div class="dot" style="background:${wc}"></div>`:'';
      grid+=`<div class="${cls}" style="${bg}" title="Day ${d+1}${w?' · '+w:''}">${d+1}${dot}</div>`;
    }
    parts.forEach((p,i)=>{leg+=`<div class="leg-item"><div class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></div>${p.name}</div>`;});
    this.shadowRoot.getElementById('cal-grid').innerHTML = grid;
    this.shadowRoot.getElementById('cal-leg').innerHTML  = leg;
  }

  // ── Track views ─────────────────────────────────────────────────────────────

  _updateTrackViews() {
    const elapsed=this._elapsed(), total=this._total(), start=this._start();
    const parts=this._participants().sort((a,b)=>b.score-a.score||b.steps-a.steps);
    const history=this._history();

    const trackEl = this.shadowRoot.getElementById('sec-track');
    const todayEl = this.shadowRoot.getElementById('sec-today');

    if (this._showTrack && elapsed>0 && start) {
      trackEl.style.display='';
      trackEl.innerHTML = this._raceTrackHTML(elapsed,total,parts,history,start);
    } else {
      trackEl.style.display='none';
    }

    if (this._showToday && elapsed>0 && start) {
      todayEl.style.display='';
      todayEl.innerHTML = this._todayStageHTML(elapsed,total,parts,history,start);
    } else {
      todayEl.style.display='none';
    }
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  _updateTable() {
    const history = this._history();
    const parts   = this._participants().sort((a,b)=>b.score-a.score||b.steps-a.steps);
    const total   = history.length;
    const shown   = Math.min(this._tableRows, total);
    const recent  = history.slice(-this._tableRows).reverse();

    this.shadowRoot.getElementById('rows-count').textContent = `${shown} / ${total}`;
    this.shadowRoot.getElementById('rows-less').disabled = this._tableRows <= 1;
    this.shadowRoot.getElementById('rows-more').disabled = this._tableRows >= total;
    this.shadowRoot.getElementById('rows-all').disabled  = this._tableRows >= total;

    if (!recent.length) { this.shadowRoot.getElementById('table-wrap').innerHTML=''; return; }

    let h=`<table><thead><tr><th>#</th><th>Datum</th><th>Sieger</th>`;
    parts.forEach(p=>{h+=`<th>${p.name}</th>`;});
    h+=`</tr></thead><tbody>`;
    recent.forEach((e,i)=>{
      const wk=e.winner||'', wp=parts.find(p=>p.key===wk);
      h+=`<tr><td class="muted">${recent.length-i}</td><td class="muted sm">${this._fmtD(e.date)}</td><td>${wp?wp.name:'—'}</td>`;
      parts.forEach((p,pi)=>{
        const v=e.steps?.[p.key], iW=wk===p.key;
        h+=`<td style="color:${iW?COLORS[pi%COLORS.length]:'var(--secondary-text-color)'};font-weight:${iW?700:400}">${v!==undefined?this._fmt(v):'—'}</td>`;
      });
      h+=`</tr>`;
    });
    h+=`</tbody></table>`;
    this.shadowRoot.getElementById('table-wrap').innerHTML = h;
  }

  // ── Overlay ────────────────────────────────────────────────────────────────

  _updateOverlay() {
    const ovEl = this.shadowRoot.getElementById('overlay');
    if (!this._showOv) { ovEl.style.display='none'; return; }
    ovEl.style.display='';
    ovEl.innerHTML = this._ovTab==='participants' ? this._ovParticipants()
                   : this._ovTab==='archive'      ? this._ovArchive()
                   : this._ovMain();
    this._bindOverlay();
  }

  _ovMain() {
    const status=this._status(), isActive=status==='active';
    const archive=this._archive(), parts=this._participants();
    return `<div class="ov-bd" id="ov-bd">
      <div class="ov-box" onclick="event.stopPropagation()">
        <div class="ov-hd"><span>⚙️ Challenge-Einstellungen</span><button class="ov-x" id="ov-x">✕</button></div>
        <div class="ov-body">
          <label class="ov-lbl">Challenge-Name</label>
          <input class="ov-in" id="ov-name" type="text" value="${this._name()}">
          <label class="ov-lbl">Dauer (Tage)</label>
          <input class="ov-in" id="ov-days" type="number" min="7" max="365" value="${this._total()}">
          <label class="ov-lbl">Auswertungszeit</label>
          <input class="ov-in" id="ov-time" type="time" value="${this._recTime().substring(0,5)}">
          <div class="ov-div"></div>
          <div class="ov-row-sb">
            <div class="ov-sec">👥 Teilnehmer (${parts.length})</div>
            <button class="ov-sm" id="ov-parts-btn">Verwalten →</button>
          </div>
          <div class="ov-parts-preview">${parts.map(p=>`<span class="ov-part-chip">${p.name}</span>`).join('')}</div>
          <div class="ov-div"></div>
          ${isActive
            ? `<div class="ov-hint">Einstellungen werden bei der nächsten Challenge übernommen.</div>
               <button class="ov-btn ov-stop" id="ov-stop">⏹ Challenge stoppen</button>`
            : `<div class="ov-hint">Einstellungen werden beim Start übernommen.</div>
               <button class="ov-btn ov-start" id="ov-start">🚩 Neue Challenge starten</button>`}
          <div class="ov-div"></div>
          <div class="ov-row-sb">
            <div class="ov-sec">📦 Archiv <span class="ov-badge">${archive.length}</span></div>
            ${archive.length>0?`<button class="ov-sm" id="ov-arch-btn">Anzeigen →</button>`:''}
          </div>
          ${archive.length>0
            ? `<div class="ov-arch-prev">${archive.slice(0,3).map(c=>`
                <div class="ov-arch-row"><b>${c.name}</b>
                <span>${this._fmtD(c.start?.split('T')[0])} · 🏆 ${c.winner||'—'}</span></div>`).join('')}</div>`
            : `<div class="ov-hint">Noch keine archivierten Challenges.</div>`}
        </div>
      </div>
    </div>`;
  }

  _ovParticipants() {
    const parts = this._participants();
    const stepSensors = Object.values(this._hass?.states||{})
      .filter(s=>s.entity_id.includes('daily_steps'))
      .sort((a,b)=>a.entity_id.localeCompare(b.entity_id));
    return `<div class="ov-bd" id="ov-bd">
      <div class="ov-box" onclick="event.stopPropagation()">
        <div class="ov-hd">
          <button class="ov-back" id="ov-back">← Zurück</button>
          <span>👥 Teilnehmer</span>
          <button class="ov-x" id="ov-x">✕</button>
        </div>
        <div class="ov-body">
          ${parts.map(p=>`<div class="ov-part-row">
            <div class="ov-part-info"><b>${p.name}</b><span class="ov-hint">${p.stepEntity}</span></div>
            <button class="ov-sm ov-danger" data-key="${p.key}" id="del-${p.key}">✕</button>
          </div>`).join('')}
          ${!parts.length?`<div class="ov-hint">Keine Teilnehmer vorhanden.</div>`:''}
          <div class="ov-div"></div>
          ${this._addingPart?`
            <div class="ov-sec">Teilnehmer hinzufügen</div>
            <label class="ov-lbl">Name</label>
            <input class="ov-in" id="new-name" type="text" placeholder="z. B. Mirko">
            <label class="ov-lbl">Schritt-Sensor</label>
            <select class="ov-in" id="new-entity">
              <option value="">— Sensor auswählen —</option>
              ${stepSensors.map(s=>`<option value="${s.entity_id}">${s.entity_id}</option>`).join('')}
            </select>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="ov-btn ov-start" id="add-confirm">✓ Hinzufügen</button>
              <button class="ov-btn ov-stop" id="add-cancel">Abbrechen</button>
            </div>`
          : `<button class="ov-btn ov-start" id="add-btn">➕ Teilnehmer hinzufügen</button>`}
        </div>
      </div>
    </div>`;
  }

  _ovArchive() {
    const archive=this._archive(), allSel=this._selArchive.size===archive.length&&archive.length>0;
    return `<div class="ov-bd" id="ov-bd">
      <div class="ov-box ov-wide" onclick="event.stopPropagation()">
        <div class="ov-hd">
          <button class="ov-back" id="ov-back">← Zurück</button>
          <span>📦 Archiv (${archive.length})</span>
          <button class="ov-x" id="ov-x">✕</button>
        </div>
        <div class="ov-body">
          ${!archive.length?`<div class="ov-hint">Kein Archiv vorhanden.</div>`:`
          <div class="ov-row-sb" style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" id="sel-all" ${allSel?'checked':''}> Alle auswählen
            </label>
            <button class="ov-btn ov-danger" id="del-sel" ${this._selArchive.size===0?'disabled':''}>
              🗑 Löschen (${this._selArchive.size})
            </button>
          </div>
          <div class="ov-arch-list">
            ${archive.map(c=>`
              <div class="ov-arc-row ${this._selArchive.has(c.id)?'ov-arc-sel':''}">
                <input type="checkbox" class="arc-cb" data-id="${c.id}" ${this._selArchive.has(c.id)?'checked':''}>
                <div class="ov-arc-info">
                  <div class="ov-arc-name">${c.name}</div>
                  <div class="ov-hint">${this._fmtD(c.start?.split('T')[0])} → ${this._fmtD(c.archived_at?.split('T')[0])} · 🏆 ${c.winner||'—'}</div>
                  <div class="ov-hint">${(c.participants||[]).map(p=>`${p.name}: <b>${p.stages}</b>`).join(' · ')}</div>
                </div>
              </div>`).join('')}
          </div>`}
        </div>
      </div>
    </div>`;
  }

  _bindOverlay() {
    const root = this.shadowRoot;
    const close = () => { this._showOv=false; this._ovTab='main'; this._selArchive.clear(); this._addingPart=false; this._updateOverlay(); };

    root.getElementById('ov-bd')?.addEventListener('click', e => { if(e.target.id==='ov-bd') close(); });
    root.getElementById('ov-x')?.addEventListener('click', close);
    root.getElementById('ov-back')?.addEventListener('click', () => { this._ovTab='main'; this._addingPart=false; this._updateOverlay(); });

    // Main tab
    root.getElementById('ov-parts-btn')?.addEventListener('click', () => { this._ovTab='participants'; this._updateOverlay(); });
    root.getElementById('ov-arch-btn')?.addEventListener('click',  () => { this._ovTab='archive'; this._selArchive.clear(); this._updateOverlay(); });

    root.getElementById('ov-start')?.addEventListener('click', () => {
      const name=root.getElementById('ov-name')?.value?.trim();
      const days=root.getElementById('ov-days')?.value;
      const time=root.getElementById('ov-time')?.value;
      this._call('update_settings',{challenge_name:name||undefined,duration_days:days?parseInt(days):undefined,record_time:time?time+':00':undefined});
      setTimeout(()=>{ this._call('start'); close(); }, 300);
    });

    root.getElementById('ov-stop')?.addEventListener('click', () => {
      const arch=confirm('Challenge stoppen\n\nMöchtest du die Challenge vor dem Stoppen ins Archiv speichern?');
      if(arch) this._call('archive_challenge');
      setTimeout(()=>{ this._call('stop'); close(); }, arch?400:0);
    });

    // Participants tab
    root.querySelectorAll('[id^="del-"]').forEach(btn => {
      if(btn.id==='del-sel') return;
      btn.addEventListener('click', ()=>{
        if(confirm(`${btn.dataset.key} entfernen?`)) this._call('remove_participant',{key:btn.dataset.key});
      });
    });
    root.getElementById('add-btn')?.addEventListener('click', ()=>{ this._addingPart=true; this._updateOverlay(); });
    root.getElementById('add-cancel')?.addEventListener('click', ()=>{ this._addingPart=false; this._updateOverlay(); });
    root.getElementById('add-confirm')?.addEventListener('click', ()=>{
      const name=root.getElementById('new-name')?.value?.trim();
      const entity=root.getElementById('new-entity')?.value;
      if(!name||!entity){alert('Name und Sensor auswählen.');return;}
      this._call('add_participant',{name,entity});
      this._addingPart=false;
      setTimeout(()=>this._updateOverlay(), 500);
    });

    // Archive tab
    root.getElementById('sel-all')?.addEventListener('change', e=>{
      if(e.target.checked) this._archive().forEach(c=>this._selArchive.add(c.id));
      else this._selArchive.clear();
      this._updateOverlay();
    });
    root.querySelectorAll('.arc-cb').forEach(cb=>{
      cb.addEventListener('change', e=>{
        if(e.target.checked) this._selArchive.add(e.target.dataset.id);
        else this._selArchive.delete(e.target.dataset.id);
        this._updateOverlay();
      });
    });
    root.getElementById('del-sel')?.addEventListener('click', ()=>{
      if(!this._selArchive.size) return;
      if(confirm(`${this._selArchive.size} Einträge löschen?`)){
        this._call('delete_archive_entries',{ids:[...this._selArchive]});
        this._selArchive.clear();
        setTimeout(()=>this._updateOverlay(), 500);
      }
    });
  }

  // ── SVG: full race track ───────────────────────────────────────────────────

  _raceTrackHTML(elapsed,total,parts,history,startIso) {
    const W=800,H=200,PL=40,PR=40,PT=30,PB=44,TW=W-PL-PR,TH=H-PT-PB;
    const seed=(this._name().split('').reduce((a,c)=>a+c.charCodeAt(0),0)+total)|0;
    const rng=i=>{const x=Math.sin(seed+i)*43758.5453;return x-Math.floor(x);};
    const elevY=[0.55];
    for(let d=1;d<total;d++){const mid=Math.abs(d/total-0.5)<0.38;elevY.push((mid?0.2:0.55)+rng(d*7)*(mid?0.55:0.3));}
    elevY.push(0.5);
    const toX=d=>PL+(d/total)*TW,toY=e=>PT+e*TH;
    const allX=elevY.map((_,i)=>toX(i)),allY=elevY.map(e=>toY(e));
    const cat=(xs,ys)=>{let d=`M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;for(let i=0;i<xs.length-1;i++){const p0=Math.max(i-1,0),p1=i,p2=i+1,p3=Math.min(i+2,xs.length-1);const cp1x=xs[p1]+(xs[p2]-xs[p0])/6,cp1y=ys[p1]+(ys[p2]-ys[p0])/6,cp2x=xs[p2]-(xs[p3]-xs[p1])/6,cp2y=ys[p2]-(ys[p3]-ys[p1])/6;d+=` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;}return d;};
    const tp=cat(allX,allY),ap=tp+` L ${allX[allX.length-1].toFixed(1)} ${(PT+TH).toFixed(1)} L ${allX[0].toFixed(1)} ${(PT+TH).toFixed(1)} Z`;
    const getY=t=>{const seg=Math.min(Math.floor(t),total-1),lt=t-seg,p0=Math.max(seg-1,0),p1=seg,p2=Math.min(seg+1,total),p3=Math.min(seg+2,total);const cp1y=allY[p1]+(allY[p2]-allY[p0])/6,cp2y=allY[p2]-(allY[p3]-allY[p1])/6,u=1-lt;return u*u*u*allY[p1]+3*u*u*lt*cp1y+3*u*lt*lt*cp2y+lt*lt*lt*allY[p2];};
    const getX=t=>PL+(t/total)*TW;
    let markers='';
    for(let d=1;d<total;d++){const mx=toX(d),done=d<elapsed;markers+=`<line x1="${mx.toFixed(1)}" y1="${PT}" x2="${mx.toFixed(1)}" y2="${(PT+TH).toFixed(1)}" stroke="${done?'#ffffff18':'#ffffff08'}" stroke-width="1" stroke-dasharray="3,4"/>`;if(total<=31||d%5===0)markers+=`<text x="${mx.toFixed(1)}" y="${(PT+TH+14).toFixed(1)}" text-anchor="middle" font-size="8" fill="#6b6b8a">${d}</text>`;}
    for(let d=0;d<=total;d+=total<=31?1:5){markers+=`<text x="${toX(d).toFixed(1)}" y="${(PT+TH+14).toFixed(1)}" text-anchor="middle" font-size="8" fill="#6b6b8a">${d}</text>`;}
    const todayX=toX(elapsed),todayMk=`<line x1="${todayX.toFixed(1)}" y1="${PT}" x2="${todayX.toFixed(1)}" y2="${(PT+TH).toFixed(1)}" stroke="var(--accent-color,#e94560)" stroke-width="1.5" opacity="0.7"/><text x="${todayX.toFixed(1)}" y="${(PT-6).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--accent-color,#e94560)" opacity="0.8">heute</text>`;
    const now2=new Date(),todayFrac=Math.min((now2.getHours()*3600+now2.getMinutes()*60+now2.getSeconds())/(21*3600),1);
    const daySteps={};
    history.forEach(e=>{const[ey,em,eday2]=e.date.split('-').map(Number),ed=new Date(ey,em-1,eday2);const[sy,sm,sday]=startIso.split('T')[0].split('-').map(Number),sd2=new Date(sy,sm-1,sday);daySteps[Math.round((ed-sd2)/86400000)+1]=e.steps||{};});
    const posDay={};parts.forEach(p=>{posDay[p.key]=0;});
    for(let d=1;d<=Math.min(elapsed-1,history.length);d++){const st=daySteps[d]||{},mx=Math.max(...Object.values(st),1);parts.forEach(p=>{posDay[p.key]=(d-1)+(st[p.key]||0)/mx;});}
    const maxTd=Math.max(...parts.map(p=>p.steps),1);
    parts.forEach(p=>{posDay[p.key]=(elapsed-1)+(p.steps/maxTd)*todayFrac;});
    const sorted2=[...parts].sort((a,b)=>posDay[a.key]-posDay[b.key]);
    let dots='';
    sorted2.forEach((p,i)=>{const dp=posDay[p.key],dx=getX(dp),dy=getY(dp),color=COLORS[parts.indexOf(p)%COLORS.length],isL=i===sorted2.length-1,r=isL?8:6;const yOff=(sorted2.length>1&&Math.abs(dp-(posDay[sorted2[i===0?1:i-1]?.key||'']||0))<0.05)?(i%2===0?-8:8):0;dots+=`<circle cx="${dx.toFixed(1)}" cy="${(dy+yOff).toFixed(1)}" r="${r}" fill="${color}" stroke="var(--card-background-color)" stroke-width="2" ${isL?'filter="url(#glow)"':''}/>`;const ly=i%2===0?dy+yOff-r-5:dy+yOff+r+11;dots+=`<text x="${dx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${dp>total*0.85?'end':'middle'}" font-size="9" font-weight="${isL?700:400}" fill="${color}">${p.name}</text>`;});
    return `<div class="sec"><div class="sec-label">🗺 Total Steps Race</div><div class="track-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.18"/><stop offset="100%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.02"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="${ap}" fill="url(#tg)"/>${markers}${todayMk}<path d="${tp}" fill="none" stroke="var(--accent-color,#e94560)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><text x="${(PL-6).toFixed(1)}" y="${(PT+TH+14).toFixed(1)}" text-anchor="middle" font-size="13">🏁</text><text x="${(PL+TW+6).toFixed(1)}" y="${(PT+TH+14).toFixed(1)}" text-anchor="middle" font-size="13">🏆</text>${dots}</svg></div></div>`;
  }

  // ── SVG: today stage ───────────────────────────────────────────────────────

  _todayStageHTML(elapsed,total,parts,history,startIso) {
    const W=800,H=220,PL=48,PR=48,PT=36,PB=48,TW=W-PL-PR,TH=H-PT-PB;
    const seed=(this._name().split('').reduce((a,c)=>a+c.charCodeAt(0),0)+total)|0;
    const rng=i=>{const x=Math.sin(seed+i)*43758.5453;return x-Math.floor(x);};
    const allElev=[0.55];
    for(let d=1;d<total;d++){const mid=Math.abs(d/total-0.5)<0.38;allElev.push((mid?0.2:0.55)+rng(d*7)*(mid?0.55:0.3));}
    allElev.push(0.5);
    const iFrom=Math.max(elapsed-3,0),iTo=Math.min(elapsed+2,total);
    const stagePx=[],stagePy=[];
    for(let i=iFrom;i<=iTo;i++){stagePx.push(PL+((i-(elapsed-1))/1)*TW);stagePy.push(PT+allElev[Math.min(i,total)]*TH);}
    const cat2=(xs,ys)=>{let d=`M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;for(let i=0;i<xs.length-1;i++){const p0=Math.max(i-1,0),p1=i,p2=i+1,p3=Math.min(i+2,xs.length-1);const cp1x=xs[p1]+(xs[p2]-xs[p0])/6,cp1y=ys[p1]+(ys[p2]-ys[p0])/6,cp2x=xs[p2]-(xs[p3]-xs[p1])/6,cp2y=ys[p2]-(ys[p3]-ys[p1])/6;d+=` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;}return d;};
    const fp=cat2(stagePx,stagePy),ap2=fp+` L ${(PL+TW).toFixed(1)} ${(PT+TH).toFixed(1)} L ${PL} ${(PT+TH).toFixed(1)} Z`;
    const stageIdx=elapsed-iFrom;
    const getY2=t=>{const fi=t*(stagePx.length-1),seg=Math.min(Math.floor(fi),stagePx.length-2),lt=fi-seg,p0=Math.max(seg-1,0),p1=seg,p2=Math.min(seg+1,stagePx.length-1),p3=Math.min(seg+2,stagePx.length-1);const cp1y=stagePy[p1]+(stagePy[p2]-stagePy[p0])/6,cp2y=stagePy[p2]-(stagePy[p3]-stagePy[p1])/6,u=1-lt;return u*u*u*stagePy[p1]+3*u*u*lt*cp1y+3*u*lt*lt*cp2y+lt*lt*lt*stagePy[p2];};
    const now3=new Date(),tf=Math.min((now3.getHours()*3600+now3.getMinutes()*60+now3.getSeconds())/(21*3600),1);
    const timeStr=now3.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    const maxSt=Math.max(...parts.map(p=>p.steps),1);
    const sorted3=[...parts].sort((a,b)=>b.steps-a.steps);
    const timeLine=`<line x1="${(PL+tf*TW).toFixed(1)}" y1="${PT}" x2="${(PL+tf*TW).toFixed(1)}" y2="${(PT+TH).toFixed(1)}" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="4,3"/><text x="${(PL+tf*TW).toFixed(1)}" y="${(PT-8).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.5)">${timeStr}</text>`;
    let dots2='',infoRows='';
    sorted3.forEach((p,i)=>{
      const sr=p.steps/maxSt,t=sr*tf,dx2=PL+t*TW,dy2=getY2(t/(stagePx.length/(stagePx.length-1)));
      const color=COLORS[parts.indexOf(p)%COLORS.length],isL=i===0,r=isL?10:7;
      const ly=i%2===0?dy2-r-7:dy2+r+13;
      dots2+=`<circle cx="${dx2.toFixed(1)}" cy="${dy2.toFixed(1)}" r="${r}" fill="${color}" stroke="var(--card-background-color)" stroke-width="2" ${isL?'filter="url(#glow2)"':''}/><text x="${dx2.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${t>0.8*TW?'end':t<0.2*TW?'start':'middle'}" font-size="${isL?10:9}" font-weight="${isL?700:400}" fill="${color}">${p.name}</text>`;
      const pct=Math.round(sr*100);
      infoRows+=`<div class="today-row"><div class="today-dot" style="background:${color}"></div><div class="today-name">${p.name}</div><div class="today-bar-wrap"><div class="today-bar-fill" style="width:${pct}%;background:${color}"></div></div><div class="today-steps">${this._fmt(p.steps)}</div><div class="today-pct" style="color:${color}">${pct}%</div></div>`;
    });
    const[sy2,sm2,sd2]=startIso.split('T')[0].split('-').map(Number);
    const stDt=new Date(sy2,sm2-1,sd2+elapsed-1),dateStr=stDt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    return `<div class="sec"><div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;"><span>📍 Stage ${elapsed} of ${total}</span><span style="font-size:.7rem;color:var(--secondary-text-color)">${dateStr}</span></div><div class="track-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible"><defs><linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--accent-color,#e94560)" stop-opacity="0.02"/></linearGradient><filter id="glow2"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="sc"><rect x="${PL}" y="0" width="${TW}" height="${H}"/></clipPath></defs><path d="${ap2}" fill="url(#tg2)" clip-path="url(#sc)"/><rect x="${PL}" y="${PT}" width="${(TW*tf).toFixed(1)}" height="${TH}" fill="rgba(255,255,255,0.03)" rx="4"/><path d="${fp}" fill="none" stroke="var(--accent-color,#e94560)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#sc)"/><path d="${fp}" fill="none" stroke="var(--accent-color,#e94560)" stroke-width="1.5" opacity="0.2" stroke-dasharray="5,4"/><line x1="${PL}" y1="${PT}" x2="${PL}" y2="${(PT+TH).toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><line x1="${(PL+TW).toFixed(1)}" y1="${PT}" x2="${(PL+TW).toFixed(1)}" y2="${(PT+TH).toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><text x="${PL}" y="${(PT+TH+16).toFixed(1)}" text-anchor="middle" font-size="14">🏁</text><text x="${(PL+TW).toFixed(1)}" y="${(PT+TH+16).toFixed(1)}" text-anchor="middle" font-size="14">🏁</text><text x="${PL}" y="${(PT+TH+30).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--secondary-text-color)">Start</text><text x="${(PL+TW).toFixed(1)}" y="${(PT+TH+30).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--secondary-text-color)">Ziel</text>${timeLine}${dots2}</svg><div class="today-info">${infoRows}</div></div></div>`;
  }
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  :host { display:block; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family,'Segoe UI',system-ui,sans-serif); min-height:100vh; }
  .root { max-width:860px; margin:0 auto; padding-bottom:40px; }
  .header { padding:14px 18px 12px; border-bottom:2px solid var(--accent-color,#e94560); display:flex; align-items:center; gap:10px; }
  .header h1 { font-size:1.2rem; font-weight:700; margin:0; }
  .header .sub { font-size:.7rem; color:var(--secondary-text-color); margin-top:2px; }
  .hl { flex:1; }
  .icon-btn { background:none; border:none; cursor:pointer; font-size:1.15rem; color:var(--secondary-text-color); padding:3px 6px; border-radius:6px; font-family:inherit; }
  .icon-btn:hover { background:rgba(255,255,255,.1); }
  .badge { padding:3px 10px; border-radius:20px; font-size:.67rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  .b-active   { background:rgba(14,173,105,.15); color:#0ead69; border:1px solid #0ead69; }
  .b-inactive { background:rgba(233,69,96,.15);  color:#e94560; border:1px solid #e94560; }
  .b-finished { background:rgba(255,215,0,.15);  color:#ffd700; border:1px solid #ffd700; }
  .prog-wrap { padding:11px 18px; border-bottom:1px solid var(--divider-color); }
  .prog-meta { display:flex; justify-content:space-between; font-size:.7rem; color:var(--secondary-text-color); margin-bottom:6px; }
  .prog-meta b { color:var(--primary-text-color); }
  .prog-bg { height:7px; background:var(--divider-color); border-radius:4px; overflow:hidden; }
  .prog-fill { height:100%; background:linear-gradient(90deg,var(--accent-color,#e94560),#ffd700); border-radius:4px; transition:width 1s ease; }
  .win-banner { margin:12px 16px 0; background:rgba(255,215,0,.08); border:1px solid #ffd700; border-radius:10px; padding:12px; text-align:center; animation:pulse 2s infinite; }
  .win-banner h2 { font-size:1.1rem; color:#ffd700; margin:0; }
  .win-banner p  { font-size:.78rem; color:var(--secondary-text-color); margin:4px 0 0; }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,215,0,.3);} 50%{box-shadow:0 0 0 8px rgba(255,215,0,0);} }
  .btn-wrap { padding:10px 16px 14px; display:flex; gap:7px; flex-wrap:wrap; }
  .btn { padding:8px 14px; border-radius:8px; border:none; font-size:.8rem; font-weight:600; cursor:pointer; transition:opacity .2s; font-family:inherit; }
  .btn:hover { opacity:.8; }
  .btn-track { background:rgba(255,255,255,.06); color:var(--secondary-text-color); border:1px solid var(--divider-color); }
  .btn-on    { background:rgba(233,69,96,.15); color:var(--accent-color,#e94560); border:1px solid var(--accent-color,#e94560); }
  .sec { padding:12px 16px 6px; }
  .sec-label { font-size:.6rem; letter-spacing:.15em; text-transform:uppercase; color:var(--secondary-text-color); margin-bottom:9px; }
  .lane { background:var(--card-background-color); border-radius:10px; border:1px solid var(--divider-color); margin-bottom:8px; overflow:hidden; }
  .lane-inner { padding:9px 12px; display:flex; align-items:center; gap:9px; }
  .l-rank   { font-size:1rem; width:24px; text-align:center; flex-shrink:0; }
  .l-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.9rem; flex-shrink:0; border:2px solid transparent; }
  .l-info   { flex:1; min-width:0; }
  .l-name   { font-size:.86rem; font-weight:600; }
  .l-steps  { font-size:.67rem; color:var(--secondary-text-color); margin-top:1px; }
  .l-steps b { color:#ffd700; }
  .l-bar-wrap { flex:2; min-width:0; }
  .l-bar-bg  { height:12px; background:var(--divider-color); border-radius:6px; overflow:hidden; position:relative; }
  .l-bar-fill { height:100%; border-radius:6px; transition:width 1.2s cubic-bezier(.34,1.56,.64,1); position:relative; }
  .l-bar-fill::after { content:''; position:absolute; right:0; top:0; height:100%; width:16px; background:rgba(255,255,255,.2); border-radius:6px; animation:shim 1.5s infinite; }
  @keyframes shim { 0%,100%{opacity:.3;} 50%{opacity:.8;} }
  .l-fig { font-size:1.2rem; position:absolute; right:-2px; top:-3px; filter:drop-shadow(0 0 3px rgba(255,215,0,.5)); animation:bou .8s infinite alternate; }
  @keyframes bou { from{transform:translateY(0);} to{transform:translateY(-3px);} }
  .l-score { font-size:1rem; font-weight:800; min-width:28px; text-align:right; flex-shrink:0; }
  .cal-grid { display:flex; flex-wrap:wrap; gap:3px; }
  .cal-day { width:25px; height:25px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:.56rem; font-weight:700; border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--secondary-text-color); position:relative; cursor:default; transition:transform .2s; }
  .cal-day:hover { transform:scale(1.25); z-index:1; }
  .cal-day.today  { border-color:var(--accent-color,#e94560); color:var(--accent-color,#e94560); }
  .cal-day.future { opacity:.35; }
  .dot { position:absolute; bottom:2px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; }
  .leg { display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
  .leg-item { display:flex; align-items:center; gap:4px; font-size:.67rem; color:var(--secondary-text-color); }
  .leg-dot  { width:8px; height:8px; border-radius:50%; }
  table { width:100%; border-collapse:collapse; font-size:.76rem; }
  th { text-align:left; color:var(--secondary-text-color); font-weight:600; padding:4px 6px; border-bottom:1px solid var(--divider-color); font-size:.66rem; }
  td { padding:5px 6px; border-bottom:1px solid var(--divider-color); }
  tr:last-child td { border-bottom:none; }
  .muted { color:var(--secondary-text-color); }
  .sm    { font-size:.69rem; }
  .row-btn { background:rgba(255,255,255,.08); border:1px solid var(--divider-color); border-radius:6px; color:var(--primary-text-color); font-size:.76rem; font-weight:600; cursor:pointer; padding:2px 8px; font-family:inherit; }
  .row-btn:hover:not([disabled]) { background:rgba(255,255,255,.15); }
  .row-btn[disabled] { opacity:.35; cursor:default; }
  .track-wrap { background:var(--card-background-color); border-radius:10px; border:1px solid var(--divider-color); padding:6px 4px 4px; overflow:hidden; }
  .today-info { padding:10px 12px 6px; display:flex; flex-direction:column; gap:6px; }
  .today-row  { display:flex; align-items:center; gap:8px; }
  .today-dot  { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .today-name { font-size:.8rem; font-weight:600; min-width:60px; flex-shrink:0; }
  .today-bar-wrap { flex:1; height:7px; background:var(--divider-color); border-radius:4px; overflow:hidden; }
  .today-bar-fill { height:100%; border-radius:4px; transition:width 1s ease; }
  .today-steps { font-size:.76rem; color:var(--secondary-text-color); min-width:52px; text-align:right; flex-shrink:0; }
  .today-pct   { font-size:.74rem; font-weight:700; min-width:36px; text-align:right; flex-shrink:0; }
  .empty { display:flex; align-items:center; justify-content:center; min-height:50vh; flex-direction:column; gap:10px; padding:40px 20px; text-align:center; }
  .empty .icon { font-size:3rem; }
  .empty h2 { color:var(--secondary-text-color); font-size:1rem; margin:0; }
  .empty p  { color:var(--secondary-text-color); font-size:.8rem; max-width:260px; margin:0; }
  #overlay { position:fixed; inset:0; z-index:900; }
  .ov-bd  { position:fixed; inset:0; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
  .ov-box { background:var(--card-background-color); border-radius:14px; border:1px solid var(--divider-color); width:min(480px,94vw); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
  .ov-wide { width:min(560px,96vw); }
  .ov-hd  { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-bottom:1px solid var(--divider-color); font-size:.93rem; font-weight:700; gap:8px; flex-shrink:0; }
  .ov-x   { background:none; border:none; cursor:pointer; font-size:1rem; color:var(--secondary-text-color); padding:2px 6px; border-radius:6px; font-family:inherit; }
  .ov-back { background:none; border:none; cursor:pointer; font-size:.8rem; color:var(--accent-color,#e94560); font-family:inherit; }
  .ov-body { padding:15px; overflow-y:auto; display:flex; flex-direction:column; gap:9px; }
  .ov-lbl  { font-size:.73rem; color:var(--secondary-text-color); font-weight:600; letter-spacing:.05em; text-transform:uppercase; }
  .ov-in   { width:100%; background:rgba(255,255,255,.06); border:1.5px solid var(--divider-color); border-radius:8px; padding:9px 11px; font-size:.88rem; color:var(--primary-text-color); font-family:inherit; box-sizing:border-box; }
  .ov-in:focus { outline:none; border-color:var(--accent-color,#e94560); }
  .ov-div  { height:1px; background:var(--divider-color); margin:2px 0; }
  .ov-sec  { font-size:.76rem; font-weight:700; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.06em; }
  .ov-hint { font-size:.75rem; color:var(--secondary-text-color); line-height:1.45; }
  .ov-badge { background:var(--accent-color,#e94560); color:#fff; border-radius:10px; padding:1px 7px; font-size:.68rem; font-weight:700; margin-left:4px; }
  .ov-row-sb { display:flex; justify-content:space-between; align-items:center; }
  .ov-btn  { padding:9px 14px; border-radius:8px; border:none; font-size:.82rem; font-weight:600; cursor:pointer; font-family:inherit; transition:opacity .2s; width:100%; }
  .ov-btn:hover:not([disabled]) { opacity:.85; }
  .ov-btn[disabled] { opacity:.35; cursor:default; }
  .ov-start  { background:rgba(14,173,105,.2); color:#0ead69; border:1px solid #0ead69; }
  .ov-stop   { background:rgba(233,69,96,.15); color:#e94560; border:1px solid #e94560; }
  .ov-danger { background:rgba(233,69,96,.15); color:#e94560; border:1px solid #e94560; font-size:.76rem; padding:5px 10px; width:auto; }
  .ov-sm     { padding:3px 10px; font-size:.73rem; background:rgba(255,255,255,.08); border:1px solid var(--divider-color); color:var(--secondary-text-color); border-radius:6px; cursor:pointer; font-family:inherit; white-space:nowrap; }
  .ov-sm:hover { background:rgba(255,255,255,.14); }
  .ov-parts-preview { display:flex; gap:6px; flex-wrap:wrap; }
  .ov-part-chip { background:rgba(255,255,255,.07); border:1px solid var(--divider-color); border-radius:20px; padding:3px 10px; font-size:.76rem; }
  .ov-part-row  { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--divider-color); }
  .ov-part-info { flex:1; min-width:0; }
  .ov-part-info b { font-size:.84rem; }
  .ov-arch-prev { display:flex; flex-direction:column; gap:5px; }
  .ov-arch-row  { background:rgba(255,255,255,.04); border-radius:7px; padding:7px 9px; }
  .ov-arch-row b { font-size:.82rem; display:block; }
  .ov-arch-row span { font-size:.72rem; color:var(--secondary-text-color); }
  .ov-arch-list { display:flex; flex-direction:column; gap:6px; max-height:55vh; overflow-y:auto; }
  .ov-arc-row  { display:flex; align-items:flex-start; gap:10px; padding:8px 9px; border-radius:8px; background:rgba(255,255,255,.03); border:1px solid transparent; transition:border-color .15s; }
  .ov-arc-sel  { border-color:var(--accent-color,#e94560); background:rgba(233,69,96,.08); }
  .ov-arc-info { flex:1; min-width:0; }
  .ov-arc-name { font-size:.84rem; font-weight:600; }
  @media(max-width:480px) { .l-bar-wrap { display:none; } }
`;

if (!customElements.get('step-challenge-card')) {
  customElements.define('step-challenge-card', StepChallengeCard);
}
