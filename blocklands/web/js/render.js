'use strict';
// WebGL renderer: terrain shader, chunk buffers, frustum culling, block outline, sun and moon.
const Renderer = (() => {
  let gl, canvas, prog, lineProg, tex, lineBuf, skyBuf;
  const loc = {}, lloc = {};
  const STRIDE = 7 * 4;

  const VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec2 aLight;
uniform mat4 uVP; uniform vec3 uOff;
varying vec2 vUV; varying vec2 vL; varying float vDist;
void main(){
  vec3 p = aPos + uOff;
  gl_Position = uVP * vec4(p, 1.0);
  vUV = aUV; vL = aLight; vDist = length(p);
}`;
  const FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uDay; uniform vec3 uFog; uniform vec2 uFogR; uniform float uAlpha;
varying vec2 vUV; varying vec2 vL; varying float vDist;
void main(){
  vec4 t = texture2D(uTex, vUV);
  if (t.a < 0.5) discard;
  vec3 light = vec3(max(vL.x * uDay, 0.05)) + vec3(1.0, 0.8, 0.55) * vL.y * 1.1;
  vec3 c = t.rgb * min(light, vec3(1.15));
  float f = clamp((vDist - uFogR.x) / (uFogR.y - uFogR.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFog, f), uAlpha);
}`;
  const LVS = `attribute vec3 aPos; uniform mat4 uVP; uniform vec3 uOff; void main(){ gl_Position = uVP * vec4(aPos + uOff, 1.0); }`;
  const LFS = `precision mediump float; uniform vec4 uColor; void main(){ gl_FragColor = uColor; }`;

  function compile(vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function init(cv) {
    canvas = cv;
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is not available on this device.');
    prog = compile(VS, FS);
    for (const n of ['aPos', 'aUV', 'aLight']) loc[n] = gl.getAttribLocation(prog, n);
    for (const n of ['uVP', 'uOff', 'uTex', 'uDay', 'uFog', 'uFogR', 'uAlpha']) loc[n] = gl.getUniformLocation(prog, n);
    lineProg = compile(LVS, LFS);
    lloc.aPos = gl.getAttribLocation(lineProg, 'aPos');
    for (const n of ['uVP', 'uOff', 'uColor']) lloc[n] = gl.getUniformLocation(lineProg, n);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, Atlas.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // unit cube edges for the selection outline
    const e = 0.002, a = -e, b = 1 + e;
    const P = [[a, a, a], [b, a, a], [b, a, b], [a, a, b], [a, b, a], [b, b, a], [b, b, b], [a, b, b]];
    const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    const lines = []; for (const i of E) lines.push(...P[i]);
    lineBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
    skyBuf = gl.createBuffer();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, Settings.data.quality === 'low' ? 1 : 2);
    const w = Math.floor(canvas.clientWidth * dpr * (Settings.data.quality === 'low' ? 0.75 : 1));
    const h = Math.floor(canvas.clientHeight * dpr * (Settings.data.quality === 'low' ? 0.75 : 1));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function upload(c, m) {
    if (c.mesh) freeMesh(c.mesh);
    const mk = (arr) => {
      if (!arr.length) return null;
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      return { buf, count: arr.length / 7 };
    };
    c.mesh = { solid: mk(m.solid), water: mk(m.water) };
  }

  function freeMesh(m) {
    if (m.solid) gl.deleteBuffer(m.solid.buf);
    if (m.water) gl.deleteBuffer(m.water.buf);
  }

  // ---- matrices ----
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function viewRot(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // rows: r0=[cy,0,-sy] r1=[sp*sy,cp,sp*cy] r2=[cp*sy,-sp,cp*cy]; column-major
    return new Float32Array([cy, sp * sy, cp * sy, 0, 0, cp, -sp, 0, -sy, sp * cy, cp * cy, 0, 0, 0, 0, 1]);
  }
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function boxVisible(vp, x0, y0, z0, x1, y1, z1) {
    // all 8 corners outside one clip plane -> culled
    let out = [0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? x1 : x0, y = i & 2 ? y1 : y0, z = i & 4 ? z1 : z0;
      const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
      const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
      const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (cx < -cw) out[0]++; if (cx > cw) out[1]++;
      if (cy < -cw) out[2]++; if (cy > cw) out[3]++;
      if (cw < 0) out[4]++;
    }
    return out.every((n) => n < 8);
  }

  function bindTerrain() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.enableVertexAttribArray(loc.aPos); gl.enableVertexAttribArray(loc.aUV); gl.enableVertexAttribArray(loc.aLight);
  }
  function drawBuf(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(loc.aLight, 2, gl.FLOAT, false, STRIDE, 20);
    gl.drawArrays(gl.TRIANGLES, 0, m.count);
  }

  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // env: { eye, yaw, pitch, timeOfDay (0..1), underwater, target, renderDist }
  function frame(env) {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    const t = env.timeOfDay;
    const sunAngle = t * Math.PI * 2;                // 0 = sunrise, 0.25 = noon
    const sunH = Math.sin(sunAngle);
    const day = Math.max(0.2, Math.min(1, sunH * 2.2 + 0.45));
    const daySky = [0.53, 0.75, 0.98], nightSky = [0.02, 0.03, 0.08], dusk = [0.95, 0.55, 0.35];
    let sky = lerp3(nightSky, daySky, Math.max(0, Math.min(1, sunH * 2 + 0.3)));
    const duskAmt = Math.max(0, 1 - Math.abs(sunH) * 4) * 0.6;
    sky = lerp3(sky, dusk, duskAmt);
    const viewDist = env.renderDist * CS;
    let fog = sky, fogR = [viewDist * 0.55, viewDist * 0.95];
    if (env.underwater) { fog = [0.08 * day + 0.02, 0.22 * day + 0.03, 0.45 * day + 0.06]; fogR = [1, 22]; }
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    const proj = perspective(Settings.data.fov * Math.PI / 180, aspect, 0.08, viewDist + 32);
    const vp = mul(proj, viewRot(env.yaw, env.pitch));
    const [ex, ey, ez] = env.eye;

    // sun & moon (camera-relative quads, drawn behind everything)
    if (!env.underwater) {
      gl.useProgram(lineProg);
      gl.disable(gl.DEPTH_TEST);
      gl.enableVertexAttribArray(lloc.aPos);
      gl.uniformMatrix4fv(lloc.uVP, false, vp);
      gl.uniform3f(lloc.uOff, 0, 0, 0);
      const drawDisc = (dx, dy, size, col) => {
        const d = viewDist * 0.9, cx = dx * d, cy = dy * d;
        size *= d / 200;
        // quad facing the camera roughly: plane spanned by Z axis and the perpendicular in XY
        const px = -dy * size, py = dx * size;
        const q = new Float32Array([cx - px, cy - py, -size, cx + px, cy + py, -size, cx + px, cy + py, size,
          cx - px, cy - py, -size, cx + px, cy + py, size, cx - px, cy - py, size]);
        gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
        gl.bufferData(gl.ARRAY_BUFFER, q, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lloc.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4f(lloc.uColor, col[0], col[1], col[2], 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      drawDisc(Math.cos(sunAngle), sunH, 16, [1, 0.95, 0.7]);
      drawDisc(-Math.cos(sunAngle), -sunH, 11, [0.85, 0.88, 0.95]);
      gl.disableVertexAttribArray(lloc.aPos);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    bindTerrain();
    gl.uniformMatrix4fv(loc.uVP, false, vp);
    gl.uniform1i(loc.uTex, 0);
    gl.uniform1f(loc.uDay, day);
    gl.uniform3f(loc.uFog, fog[0], fog[1], fog[2]);
    gl.uniform2f(loc.uFogR, fogR[0], fogR[1]);
    gl.uniform1f(loc.uAlpha, 1);

    const visibleChunks = [];
    let tris = 0;
    for (const c of World.chunks.values()) {
      if (!c.mesh) continue;
      const ox = c.cx * CS - ex, oz = c.cz * CS - ez, oy = -ey;
      const dx = ox + CS / 2, dz = oz + CS / 2;
      if (dx * dx + dz * dz > (viewDist + CS) * (viewDist + CS)) continue;
      if (!boxVisible(vp, ox, oy, oz, ox + CS, oy + WH, oz + CS)) continue;
      visibleChunks.push([c, ox, oy, oz, dx * dx + dz * dz]);
      if (c.mesh.solid) {
        gl.uniform3f(loc.uOff, ox, oy, oz);
        drawBuf(c.mesh.solid); tris += c.mesh.solid.count / 3;
      }
    }

    // water: blended, back to front
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(loc.uAlpha, 0.72);
    visibleChunks.sort((a, b) => b[4] - a[4]);
    for (const [c, ox, oy, oz] of visibleChunks) {
      if (!c.mesh.water) continue;
      gl.uniform3f(loc.uOff, ox, oy, oz);
      drawBuf(c.mesh.water);
    }
    gl.depthMask(true);
    gl.disableVertexAttribArray(loc.aUV); gl.disableVertexAttribArray(loc.aLight);

    // selection outline
    if (env.target) {
      gl.useProgram(lineProg);
      gl.enableVertexAttribArray(lloc.aPos);
      gl.uniformMatrix4fv(lloc.uVP, false, vp);
      const [tx, ty, tz] = env.target;
      gl.uniform3f(lloc.uOff, tx - ex, ty - ey, tz - ez);
      gl.uniform4f(lloc.uColor, 0, 0, 0, 0.6);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
      gl.vertexAttribPointer(lloc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, 24);
      gl.disableVertexAttribArray(lloc.aPos);
    }
    gl.disable(gl.BLEND);
    return { tris, chunks: visibleChunks.length, day };
  }

  return { init, upload, freeMesh, frame, get gl() { return gl; } };
})();
