const TEXT = {
  pylon: 'Disable the shield pylon',
  core: 'Breach the command bunker',
  silos: 'Destroy the three launch silos before the countdown ends',
  extract: 'Land on the VTOL pad',
};

export class Mission {
  constructor(session, refs, objectives) {
    this.session = session;
    this.refs = refs;
    this.ids = objectives;
    this.index = 0;
    this.countdown = null;
    this.extractTimer = 0;
    this.finished = false;
  }

  get current() {
    return this.ids[this.index];
  }

  start() {
    this.announce();
  }

  announce() {
    const hud = this.session.hud;
    const id = this.current;
    if (id) hud.setObjective(TEXT[id]);
    hud.setObjectiveList(this.ids.map((o, i) => ({ text: TEXT[o], done: i < this.index, active: i === this.index })));
  }

  advance() {
    const hud = this.session.hud;
    hud.banner('Objective complete');
    this.session.world.stats.score += 500;
    this.index++;
    this.announce();
  }

  onDestroyed(d) {
    if ((this.current === 'pylon' && d.id === 'pylon') || (this.current === 'core' && d.id === 'core')) {
      this.advance();
    }
  }

  update(dt) {
    if (this.finished) return;
    const id = this.current;
    if (id === 'silos') this.updateSilos(dt);
    else if (id === 'extract') this.updateExtract(dt);
  }

  updateSilos(dt) {
    const hud = this.session.hud, p = this.session.player;
    if (this.refs.silos.every((s) => !s.alive)) {
      this.countdown = null;
      hud.setCountdown(null);
      hud.message('All launch silos destroyed. Launch aborted.', 'good');
      this.advance();
      return;
    }
    const c = this.refs.silosCenter;
    const near = Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < this.refs.silosZone;
    if (this.countdown === null && near && p.alive) {
      this.countdown = this.session.difficulty.launchTime;
      hud.message('Launch sequence started!', 'warn');
    }
    if (this.countdown !== null) {
      this.countdown -= dt;
      hud.setCountdown(Math.max(0, Math.ceil(this.countdown)), 'LAUNCH');
      if (this.countdown <= 0) {
        this.finished = true;
        hud.setCountdown(null);
        this.session.fail('The rockets launched before the silos were destroyed.');
      }
    }
  }

  updateExtract(dt) {
    const hud = this.session.hud, p = this.session.player, pad = this.refs.pad;
    const d = Math.hypot(p.pos.x - pad.x, p.pos.z - pad.z);
    if (d < 7 && Math.abs(p.speed) < 6 && p.alive) {
      if (this.extractTimer === 0) hud.message('VTOL inbound — hold position', 'good');
      this.extractTimer += dt;
      hud.setCountdown(Math.max(0, Math.ceil(3 - this.extractTimer)), 'EXTRACT');
      if (this.extractTimer >= 3) {
        this.finished = true;
        hud.setCountdown(null);
        this.session.complete();
      }
    } else if (this.extractTimer > 0) {
      this.extractTimer = 0;
      hud.setCountdown(null);
      hud.message('Extraction interrupted', 'warn');
    }
    const vtol = this.refs.vtol;
    vtol.position.y = Math.max(2.5, vtol.position.y - dt * 3);
  }

  activeTarget() {
    const r = this.refs;
    switch (this.current) {
      case 'pylon': return r.pylon.pos;
      case 'core': return r.core.pos;
      case 'silos': return r.silosCenter;
      case 'extract': return { x: r.pad.x, z: r.pad.z };
      default: return null;
    }
  }
}
