'use strict';
// Keyboard/mouse and touch controls. Produces movement state and look deltas; calls Game for actions.
const Input = (() => {
  const keys = new Set();
  const state = { mx: 0, mz: 0, jump: false, sneak: false, sprint: false, breakHeld: false, placeHeld: false };
  let lookDX = 0, lookDY = 0;
  let isTouch = false;
  let locked = false;
  // touch
  let stickId = null, stickX = 0, stickY = 0, stickVX = 0, stickVY = 0;
  const looks = new Map(); // touch id -> { x, y, sx, sy, t, moved, breaking, timer }
  let jumpTouch = false, sneakToggle = false, flyDown = false, lastJumpTap = 0;
  let canvas;

  function active() { return Game.state === 'play'; }

  function init(cv) {
    canvas = cv;
    // ---- keyboard ----
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.code;
      if (!keys.has(k)) onKeyPress(k, e);
      keys.add(k);
      if (active() && ['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F3'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); state.breakHeld = state.placeHeld = false; });

    // ---- mouse ----
    canvas.addEventListener('mousedown', (e) => {
      if (isTouch || !active()) return;
      if (!locked) { requestLock(); return; }
      if (e.button === 0) { state.breakHeld = true; Game.startBreak(); }
      else if (e.button === 2) { state.placeHeld = true; Game.place(); }
      else if (e.button === 1) Game.pickBlock();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { state.breakHeld = false; Game.stopBreak(); }
      if (e.button === 2) state.placeHeld = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!locked || !active()) return;
      lookDX += e.movementX * 0.0025; lookDY += e.movementY * 0.0025;
    });
    window.addEventListener('wheel', (e) => { if (active()) Game.scrollHotbar(Math.sign(e.deltaY)); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
      if (!locked && active() && !isTouch) Game.pause();
    });

    // ---- touch ----
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    const hold = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(); }, { passive: false });
      const end = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('on'); if (up) up(); };
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('click', (e) => { if (!isTouch) { down(); if (up) up(); } });
    };
    hold('btnJump', () => {
      jumpTouch = true;
      const now = performance.now();
      if (Game.creative && now - lastJumpTap < 300) Game.toggleFly();
      lastJumpTap = now;
    }, () => { jumpTouch = false; });
    hold('btnSneak', () => {
      if (Player.flying) flyDown = true; else sneakToggle = !sneakToggle;
    }, () => {
      flyDown = false;
      document.getElementById('btnSneak').classList.toggle('on', sneakToggle);
    });
    hold('btnFly', () => Game.toggleFly());
    hold('btnInv', () => Game.openInventory());
    hold('btnPause', () => Game.pause());
    hold('btnBreak', () => { state.breakHeld = true; Game.startBreak(); }, () => { state.breakHeld = false; Game.stopBreak(); });
    hold('btnPlace', () => Game.place());
  }

  function requestLock() {
    if (canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  }

  function onKeyPress(k, e) {
    if (Game.state === 'inventory' && (k === 'KeyE' || k === 'Escape')) { Game.closeInventory(); return; }
    if (!active()) return;
    if (k >= 'Digit1' && k <= 'Digit9') Game.selectSlot(+k.slice(5) - 1);
    else if (k === 'KeyE') Game.openInventory();
    else if (k === 'KeyF') Game.toggleFly();
    else if (k === 'F3') Settings.toggle('showFps');
    else if (k === 'Space') {
      const now = performance.now();
      if (Game.creative && now - lastJumpTap < 280) Game.toggleFly();
      lastJumpTap = now;
    } else if (k === 'KeyQ') Game.pickBlock();
  }

  function setTouchMode(on) {
    if (isTouch === on) return;
    isTouch = on;
    document.body.classList.toggle('touch', on);
  }

  const isUi = (t) => t.closest && t.closest('button, .slot, input, .panel');

  function onTouchStart(e) {
    setTouchMode(true);
    Sound.unlock();
    if (!active()) return;
    for (const t of e.changedTouches) {
      if (isUi(t.target)) continue;
      e.preventDefault();
      if (t.clientX < window.innerWidth * 0.4 && stickId === null) {
        stickId = t.identifier; stickX = t.clientX; stickY = t.clientY; stickVX = stickVY = 0;
        const s = document.getElementById('stick');
        s.style.display = 'block'; s.style.left = stickX + 'px'; s.style.top = stickY + 'px';
        document.getElementById('knob').style.transform = '';
      } else {
        const L = { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: false, breaking: false };
        if (!Settings.data.touchButtons) {
          L.timer = setTimeout(() => {
            if (!L.moved && active()) { L.breaking = true; state.breakHeld = true; Game.startBreak(); }
          }, 280);
        }
        looks.set(t.identifier, L);
      }
    }
  }

  function onTouchMove(e) {
    if (!active()) return;
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        e.preventDefault();
        let dx = t.clientX - stickX, dy = t.clientY - stickY;
        const R = 52, d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        stickVX = dx / R; stickVY = dy / R;
        document.getElementById('knob').style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (looks.has(t.identifier)) {
        e.preventDefault();
        const L = looks.get(t.identifier);
        const dx = t.clientX - L.x, dy = t.clientY - L.y;
        L.x = t.clientX; L.y = t.clientY;
        if (Math.hypot(t.clientX - L.sx, t.clientY - L.sy) > 12) L.moved = true;
        lookDX += dx * 0.0055; lookDY += dy * 0.0055;
      }
    }
  }

  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null; stickVX = stickVY = 0;
        document.getElementById('stick').style.display = 'none';
      } else if (looks.has(t.identifier)) {
        const L = looks.get(t.identifier);
        clearTimeout(L.timer);
        looks.delete(t.identifier);
        if (L.breaking) {
          if (![...looks.values()].some((o) => o.breaking)) { state.breakHeld = false; Game.stopBreak(); }
        } else if (!L.moved && performance.now() - L.t < 280 && active() && !Settings.data.touchButtons) Game.place();
      }
    }
  }

  function update() {
    const k = (c) => keys.has(c);
    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let mz = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    if (mx && mz) { mx *= Math.SQRT1_2; mz *= Math.SQRT1_2; }
    if (stickId !== null) {
      mx = stickVX; mz = -stickVY;
      state.sprint = Math.hypot(stickVX, stickVY) > 0.97 && mz > 0.8;
    } else state.sprint = k('ControlLeft') || k('ControlRight');
    state.mx = mx; state.mz = mz;
    state.jump = k('Space') || jumpTouch;
    state.sneak = k('ShiftLeft') || k('ShiftRight') || sneakToggle || flyDown;
    const s = Settings.data.sens;
    const out = [lookDX * s, lookDY * s];
    lookDX = lookDY = 0;
    return out;
  }

  function release() {
    keys.clear(); state.breakHeld = state.placeHeld = false; jumpTouch = false;
    for (const L of looks.values()) clearTimeout(L.timer);
    looks.clear(); stickId = null; stickVX = stickVY = 0;
    const s = document.getElementById('stick'); if (s) s.style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return {
    init, update, state, release, requestLock, setTouchMode,
    get isTouch() { return isTouch; },
    get locked() { return locked; },
    resetSneak() { sneakToggle = false; flyDown = false; document.getElementById('btnSneak').classList.remove('on'); },
  };
})();
