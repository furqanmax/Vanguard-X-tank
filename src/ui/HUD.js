const $ = (id) => document.getElementById(id);

import { weaponIcon } from './icons.js';

const POWER_LABELS = { overdrive: 'OVERDRIVE', aegis: 'AEGIS' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export class HUD {
  constructor() {
    this.root = $('hud');
    this.reticle = $('reticle');
    this.missionEl = $('hud-mission');
    this.objectiveEl = $('hud-objective');
    this.objectiveList = $('objective-list');
    this.countdownEl = $('countdown');
    this.bannerEl = $('banner');
    this.messagesEl = $('messages');
    this.damageEl = $('damage');
    this.healthEl = $('hud-health');
    this.healthBar = $('hud-health-bar');
    this.nanoEl = $('hud-nano');
    this.speedEl = $('hud-speed');
    this.scoreEl = $('hud-score');
    this.timeEl = $('hud-time');
    this.targetWindow = $('target-window');
    this.targetName = $('target-name');
    this.targetHp = $('target-hp');
    this.compass = $('compass');
    this.compassArrow = $('compass-arrow');
    this.compassDist = $('compass-dist');
    this.weaponsEl = $('weapons');
    this.powersEl = $('powers');
    this.weaponPick = $('weapon-pick');
    this.specialBar = $('special-bar');
    this.specialLabel = $('special-label');
    this.powersSig = '';
    this.scoreboardEl = $('scoreboard');
    this.legendEl = $('legend');
    this.legendTimer = 0;
    this.scoreboardTable = $('sb-table');
    this.objectivesPanel = $('objectives-panel');
    this.briefingPanel = $('briefing-panel');
    this.briefingText = $('briefing-text');
    this.cockpit = $('cockpit');
    this.lockHint = $('lock-hint');
    this.hudOn = true;
    this.hitTimer = 0;
    this.bannerTimer = 0;
    this.damage = 0;
    this.messages = [];
    this.weaponSig = '';
    this.iconSet = 'flat';
    this.lastObjective = '';
    this.lowHealth = false;
    this.targetOn = false;
    this.timeText = '';
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  setMission(name) {
    this.missionEl.textContent = name.toUpperCase();
  }

  toggleHud() {
    this.hudOn = !this.hudOn;
    this.root.classList.toggle('hud-off', !this.hudOn);
  }

  toggleCockpit() {
    this.cockpit.classList.toggle('hidden');
  }

  toggleObjectives() {
    this.objectivesPanel.classList.toggle('hidden');
  }

  toggleBriefing(text) {
    const show = this.briefingPanel.classList.contains('hidden');
    this.briefingText.textContent = text;
    this.briefingPanel.classList.toggle('hidden', !show);
  }

  setLockHint(on) {
    this.lockHint.classList.toggle('hidden', !on);
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.objectiveEl.textContent = text;
  }

  setObjectiveList(list) {
    this.objectiveList.innerHTML = list
      .map((o) => `<li class="${o.done ? 'done' : o.active ? 'active' : ''}">${o.text}</li>`)
      .join('');
  }

  setCountdown(value, label = 'LAUNCH') {
    if (value === null) {
      this.countdownEl.classList.add('hidden');
      return;
    }
    this.countdownEl.classList.remove('hidden');
    this.countdownEl.textContent = `${label} ${value}`;
  }

  setVitals(health, max, nano, maxNano, kph) {
    this.healthEl.textContent = Math.round((health / max) * 100);
    this.healthBar.style.width = `${Math.max(0, (health / max) * 100)}%`;
    this.healthBar.classList.toggle('low', health < max * 0.25);
    this.root.querySelector('.hud-bl').classList.toggle('low', health < max * 0.25);
    this.nanoEl.textContent = Array.from({ length: maxNano }, (_, i) => (i < nano ? '◆' : '◇')).join(' ');
    this.speedEl.textContent = Math.round(kph);
  }

  setWeapons(slots) {
    const sig = JSON.stringify(slots);
    if (sig !== this.weaponSig) {
      this.weaponSig = sig;
      this.weaponPick.innerHTML = slots
        .map((s) => `<div class="pick ${s.selected ? 'selected' : ''}" data-key="${s.key}">${weaponIcon(this.iconSet, s.id)}<span>${s.key}</span></div>`)
        .join('');
      this.weaponsEl.innerHTML = slots
        .map((s) => `<div class="slot ${s.selected ? 'selected' : ''}" data-key="${s.key}" title="${s.name}">
            <span class="key">${s.key}</span>
            <span class="wicon">${weaponIcon(this.iconSet, s.id)}</span>
            <span class="ammo">${s.ammo}</span>
            ${s.bound ? '<span class="rmb">RMB</span>' : ''}
          </div>`)
        .join('');
    }
  }

  setReticle(x, y, state) {
    this.reticle.className = `reticle ${state}${this.hitTimer > 0 ? ' hit' : ''}`;
    this.reticle.style.transform = `translate(${x}px, ${y}px)`;
  }

  hitConfirm() {
    this.hitTimer = 0.18;
  }

  damageFlash(amount) {
    this.damage = Math.min(1, this.damage + amount / 35);
  }

  setTarget(target) {
    this.targetOn = !!target;
    this.targetWindow.classList.toggle('hidden', !target);
    if (target) {
      this.targetName.textContent = target.def ? target.def.name : target.label;
      this.targetHp.style.width = `${Math.max(0, (target.health / target.maxHealth) * 100)}%`;
    }
    return this.targetOn;
  }

  targetViewport(canvasHeight) {
    if (!this.targetOn) return null;
    const r = this.targetWindow.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: Math.round(r.left), y: Math.round(canvasHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
  }

  setCompass(rel, distance) {
    if (rel === null) {
      this.compass.classList.add('hidden');
      return;
    }
    this.compass.classList.remove('hidden');
    this.compassArrow.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    this.compassDist.textContent = `${Math.round(distance)} m`;
  }

  setPowers(powers, special, max) {
    const active = Object.entries(powers).filter(([, t]) => t > 0);
    const sig = active.map(([k, t]) => `${k}${Math.ceil(t)}`).join(',');
    if (sig !== this.powersSig) {
      this.powersSig = sig;
      this.powersEl.innerHTML = active
        .map(([k, t]) => `<span class="chip ${k}">${POWER_LABELS[k]} ${Math.ceil(t)}s</span>`)
        .join('');
    }
    const pct = Math.min(100, (special / max) * 100);
    this.specialBar.style.width = `${pct}%`;
    this.specialLabel.textContent = pct >= 100 ? 'SPECIAL READY [X]' : `SPECIAL ${Math.floor(pct)}%`;
    this.specialLabel.classList.toggle('ready', pct >= 100);
  }

  setIconSet(set) {
    this.iconSet = set;
    this.weaponSig = '';
  }

  setLegend(lines) {
    this.legendEl.innerHTML = lines.map(([k, v]) => `<div><b>${k}</b> ${v}</div>`).join('');
  }

  showLegend(seconds = 30) {
    this.legendEl.classList.remove('hidden');
    this.legendTimer = seconds;
  }

  toggleLegend() {
    if (this.legendEl.classList.contains('hidden')) this.showLegend(1e9);
    else {
      this.legendEl.classList.add('hidden');
      this.legendTimer = 0;
    }
  }

  setScoreboard(rows, myId) {
    if (!rows) {
      this.scoreboardEl.classList.add('hidden');
      return;
    }
    this.scoreboardEl.classList.remove('hidden');
    this.scoreboardTable.innerHTML =
      '<tr><td>PILOT</td><td>KILLS</td><td>DEATHS</td></tr>' +
      rows.map((r) => `<tr><td class="${r.id === myId ? 'me' : ''}">${escapeHtml(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`).join('');
  }

  setScore(score, time) {
    this.scoreEl.textContent = score.toLocaleString();
    const s = Math.floor(time);
    const t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (t !== this.timeText) {
      this.timeText = t;
      this.timeEl.textContent = t;
    }
  }

  message(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = `msg ${kind}`;
    el.textContent = text;
    this.messagesEl.prepend(el);
    this.messages.push({ el, t: 3.2 });
    while (this.messages.length > 4) {
      const old = this.messages.shift();
      old.el.remove();
    }
  }

  banner(text) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer = 2.4;
  }

  update(dt) {
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    if (this.legendTimer > 0) {
      this.legendTimer -= dt;
      if (this.legendTimer <= 0) this.legendEl.classList.add('hidden');
    }
    this.damage = Math.max(0, this.damage - dt * 0.8);
    this.damageEl.style.opacity = this.damage.toFixed(3);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.add('hidden');
    }
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      m.t -= dt;
      if (m.t <= 0) {
        m.el.remove();
        this.messages.splice(i, 1);
      }
    }
  }
}
