'use strict';
// Player movement, collision, block targeting, health.
const Player = {
  pos: [0, 60, 0], vel: [0, 0, 0], yaw: 0, pitch: 0,
  onGround: false, inWater: false, headInWater: false, flying: false, sneaking: false, sprinting: false,
  health: 20, fallStart: null, hurtFlash: 0, regenTimer: 0, stepTimer: 0,
  W: 0.3, H: 1.8, EYE: 1.62,

  eye() { return [this.pos[0], this.pos[1] + (this.sneaking && !this.flying ? this.EYE - 0.15 : this.EYE), this.pos[2]]; },
  forward() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  },

  collides(x, y, z) {
    const W = this.W;
    const x0 = Math.floor(x - W), x1 = Math.floor(x + W), y0 = Math.floor(y), y1 = Math.floor(y + this.H - 0.001);
    const z0 = Math.floor(z - W), z1 = Math.floor(z + W);
    for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) for (let bx = x0; bx <= x1; bx++) {
      if (!World.isLoaded(bx, bz)) return true; // treat unloaded terrain as solid
      if (SOLID[World.getBlock(bx, by, bz)]) return true;
    }
    return false;
  },

  moveAxis(a, d) {
    if (d === 0) return false;
    const steps = Math.ceil(Math.abs(d) / 0.3);
    const sd = d / steps;
    for (let i = 0; i < steps; i++) {
      const p = this.pos.slice(); p[a] += sd;
      if (this.collides(p[0], p[1], p[2])) {
        // snap flush against the block
        if (a === 1) {
          if (sd < 0) { this.pos[1] = Math.floor(p[1]) + 1; this.onGround = true; }
          else this.pos[1] = Math.floor(p[1] + this.H - 0.001) - this.H;
        } else {
          const snapped = sd > 0 ? Math.floor(p[a] + this.W) - this.W - 0.001 : Math.floor(p[a] - this.W) + 1 + this.W + 0.001;
          const q = this.pos.slice(); q[a] = snapped;
          if (!this.collides(q[0], q[1], q[2])) this.pos[a] = snapped;
        }
        this.vel[a] = 0;
        return true;
      }
      // sneaking keeps you from walking off ledges
      if (a !== 1 && this.sneaking && this.onGround && !this.flying && !this.inWater && !this.collides(p[0], p[1] - 0.6, p[2])) {
        this.vel[a] = 0; return true;
      }
      this.pos[a] = p[a];
    }
    return false;
  },

  // input: { mx, mz (-1..1 local move), jump, sneak, sprint }
  update(dt, input, creative) {
    const feet = World.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.2), Math.floor(this.pos[2]));
    const eyeB = World.getBlock(Math.floor(this.pos[0]), Math.floor(this.eye()[1]), Math.floor(this.pos[2]));
    this.inWater = feet === B.WATER;
    this.headInWater = eyeB === B.WATER;
    if (!creative) this.flying = false;
    this.sneaking = !!input.sneak && !this.flying;
    this.sprinting = !!input.sprint && input.mz > 0.5 && !this.sneaking;

    let speed = this.flying ? (this.sprinting ? 18 : 10) : this.sneaking ? 1.4 : this.sprinting ? 5.8 : 4.3;
    if (this.inWater && !this.flying) speed *= 0.55;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // forward (-sin, -cos), right (cos, -sin)
    let wx = (-sy * input.mz + cy * input.mx) * speed;
    let wz = (-cy * input.mz - sy * input.mx) * speed;
    const accel = this.onGround || this.flying || this.inWater ? 14 : 4;
    const k = Math.min(1, accel * dt);
    this.vel[0] += (wx - this.vel[0]) * k;
    this.vel[2] += (wz - this.vel[2]) * k;

    if (this.flying) {
      const vy = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0);
      this.vel[1] += (vy * 9 - this.vel[1]) * Math.min(1, 10 * dt);
    } else if (this.inWater) {
      this.vel[1] -= 9 * dt;
      if (input.jump) this.vel[1] = Math.min(this.vel[1] + 30 * dt, 3.6);
      this.vel[1] = Math.max(this.vel[1], -3.5);
      this.fallStart = null;
    } else {
      this.vel[1] -= 30 * dt;
      this.vel[1] = Math.max(this.vel[1], -55);
      if (input.jump && this.onGround) { this.vel[1] = 8.6; this.onGround = false; }
    }

    const wasGround = this.onGround;
    this.onGround = false;
    const hitX = this.moveAxis(0, this.vel[0] * dt);
    const hitZ = this.moveAxis(2, this.vel[2] * dt);
    this.moveAxis(1, this.vel[1] * dt);
    if (this.flying && this.onGround && creative && !input.jump) this.flying = false;

    // auto-jump onto one-block steps (touch controls)
    if (Settings.data.autoJump && (hitX || hitZ) && wasGround && !this.flying && !this.inWater && (Math.abs(input.mx) + Math.abs(input.mz) > 0.1)) {
      const nx = this.pos[0] + Math.sign(wx) * 0.4, nz = this.pos[2] + Math.sign(wz) * 0.4;
      if (!this.collides(nx, this.pos[1] + 1.05, nz) && !this.collides(this.pos[0], this.pos[1] + 1.05, this.pos[2])) this.vel[1] = 8.6;
    }

    // fall damage
    if (!creative) {
      if (!this.onGround && !this.inWater && this.vel[1] < 0) { if (this.fallStart === null) this.fallStart = this.pos[1]; }
      if (this.onGround && this.fallStart !== null) {
        const dist = this.fallStart - this.pos[1];
        if (dist > 3.5) this.damage(Math.floor(dist - 3));
        this.fallStart = null;
      }
      if (this.onGround && !wasGround) Sound.play('step', World.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.5), Math.floor(this.pos[2])));
      this.regenTimer += dt;
      if (this.regenTimer > 4 && this.health < 20) { this.health++; this.regenTimer = 0; }
    } else this.fallStart = null;

    // footsteps
    const hs = Math.hypot(this.vel[0], this.vel[2]);
    if (this.onGround && hs > 1) {
      this.stepTimer += dt * hs;
      if (this.stepTimer > 2.2) { this.stepTimer = 0; Sound.play('step', World.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.5), Math.floor(this.pos[2]))); }
    }
    if (this.pos[1] < -20) { this.damage(100); }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
  },

  damage(n) {
    if (Game.creative || n <= 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - n);
    this.hurtFlash = 0.35;
    this.regenTimer = 0;
    Sound.play('hurt');
    if (this.health <= 0) Game.die();
  },

  // DDA voxel raycast; returns { pos:[x,y,z], normal:[nx,ny,nz], id } or null
  raycast(maxDist) {
    const o = this.eye(), d = this.forward();
    let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
    const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
    const tdx = Math.abs(1 / d[0]), tdy = Math.abs(1 / d[1]), tdz = Math.abs(1 / d[2]);
    const frac = (v, s) => s > 0 ? Math.ceil(v) - v : v - Math.floor(v);
    let tmx = d[0] ? frac(o[0], sx) * tdx : Infinity;
    let tmy = d[1] ? frac(o[1], sy) * tdy : Infinity;
    let tmz = d[2] ? frac(o[2], sz) * tdz : Infinity;
    if (tmx === 0) tmx = tdx; if (tmy === 0) tmy = tdy; if (tmz === 0) tmz = tdz;
    let n = [0, 0, 0], t = 0;
    while (t <= maxDist) {
      const id = World.getBlock(x, y, z);
      if (TARGETABLE[id]) return { pos: [x, y, z], normal: n, id };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  },

  intersectsBlock(bx, by, bz) {
    const W = this.W;
    return bx + 1 > this.pos[0] - W && bx < this.pos[0] + W && by + 1 > this.pos[1] && by < this.pos[1] + this.H &&
      bz + 1 > this.pos[2] - W && bz < this.pos[2] + W;
  },
};
