export class Screens {
  constructor(onAction, onSetting) {
    this.root = document.getElementById('screens');
    this.sections = {};
    this.current = null;
    for (const el of this.root.querySelectorAll('[data-screen]')) {
      this.sections[el.dataset.screen] = el;
    }
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (b) onAction(b.dataset.action);
    });
    this.root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-setting]');
      if (!el) return;
      const value = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : parseFloat(el.value);
      onSetting(el.dataset.setting, value);
    });
  }

  show(name, data = null) {
    for (const s of Object.values(this.sections)) s.classList.add('hidden');
    this.sections[name].classList.remove('hidden');
    this.root.classList.remove('hidden');
    this.current = name;
    if (name === 'briefing' && data) {
      this.setText('brief-sub', 'MISSION BRIEFING');
      this.setText('brief-name', data.name);
      this.setText('brief-text', data.briefing);
    }
    if (name === 'complete' && data) {
      this.setText('stat-time', fmtTime(data.time));
      this.setText('stat-enemies', data.enemies);
      this.setText('stat-objects', data.objects);
      this.setText('stat-accuracy', `${data.accuracy}%`);
      this.setText('stat-pickups', data.pickups);
      this.setText('stat-score', data.score.toLocaleString());
    }
    if (name === 'gameover' && data) this.setText('fail-reason', data.reason);
    if (name === 'vsresult' && data) {
      const rows = data.rows.map((r, i) =>
        `<tr><td class="${r.id === data.myId ? 'me' : ''}">${i + 1}. ${escapeHtml(r.name)}</td><td>${r.kills} kills</td><td>${r.deaths} deaths</td></tr>`
      );
      document.getElementById('vs-rows').innerHTML = rows.join('');
    }
  }

  hide() {
    this.root.classList.add('hidden');
    for (const s of Object.values(this.sections)) s.classList.add('hidden');
    this.current = null;
  }

  syncSettings(settings) {
    const sens = this.root.querySelector('[data-setting="sensitivity"]');
    if (sens) sens.value = settings.sensitivity;
    const inv = this.root.querySelector('[data-setting="invertY"]');
    if (inv) inv.checked = settings.invertY;
    const diff = this.root.querySelector('[data-setting="difficulty"]');
    if (diff) diff.value = settings.difficulty;
    const af = this.root.querySelector('[data-setting="autoFire"]');
    if (af) af.checked = settings.autoFire;
    for (const key of ['quality', 'iconSet', 'controlPreset']) {
      const el = this.root.querySelector(`[data-setting="${key}"]`);
      if (el) el.value = settings[key];
    }
    const aim = this.root.querySelector('[data-setting="aimStyle"]');
    if (aim) aim.value = settings.aimStyle;
    this.setText('opt-sens-val', settings.sensitivity.toFixed(1));
  }

  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function fmtTime(sec) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
