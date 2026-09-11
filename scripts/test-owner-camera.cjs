const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/owner/login/camera-motion.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const camera = { exports: {} };
new Function("module", "exports", compiled)(camera, camera.exports);
const { getCameraPose, createCameraKeyframes, CAMERA_CYCLE_MS, CAMERA_SCALE } = camera.exports;

const near = (a, b, tolerance = 0.0001) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const start = getCameraPose(0);
const end = getCameraPose(1);
for (const axis of ["x", "y", "rotation"]) {
  near(start[axis], end[axis]);
  const h = 0.00001;
  const incoming = (end[axis] - getCameraPose(1-h)[axis]) / h;
  const outgoing = (getCameraPose(h)[axis] - start[axis]) / h;
  near(incoming, outgoing, 0.01);
}

const keyframes = createCameraKeyframes();
assert.equal(keyframes.length, 121);
assert.equal(keyframes[0].offset, 0);
assert.equal(keyframes.at(-1).offset, 1);
assert.equal(keyframes[0].transform, keyframes.at(-1).transform);
assert.equal(CAMERA_CYCLE_MS, 12000);

for (let sample = 0; sample <= 1200; sample++) {
  const progress = sample / 1200;
  const pose = getCameraPose(progress);
  const next = getCameraPose(progress + 0.00001);
  const speed = Math.hypot(next.x - pose.x, next.y - pose.y) / 0.00001 / (CAMERA_CYCLE_MS / 1000);
  assert.ok(speed > 2, "Camera must not stop at a direction change");
  assert.ok(speed < 16, "Camera movement must remain gentle");
  assert.ok(Math.abs(pose.x) <= 24 && Math.abs(pose.y) <= 12.5);
  assert.ok(Math.abs(pose.rotation) <= 0.201);

  // Inverse-transform all viewport corners: no exposed edges, including rotation.
  for (const [width, height] of [[320,568], [414,896], [1280,720], [1920,1080], [3840,2160]]) {
    const overscan = Math.max(32, Math.max(width, height) * 0.02);
    const angle = pose.rotation * Math.PI / 180;
    for (const x of [0, width]) for (const y of [0, height]) {
      const dx = x - width/2 - pose.x;
      const dy = y - height/2 - pose.y;
      const localX = (dx * Math.cos(angle) + dy * Math.sin(angle)) / CAMERA_SCALE;
      const localY = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / CAMERA_SCALE;
      assert.ok(Math.abs(localX) <= width/2 + overscan);
      assert.ok(Math.abs(localY) <= height/2 + overscan);
    }
  }
}
console.log("Owner camera: seam position/velocity, continuous motion, and mobile-to-4K edge coverage passed.");
