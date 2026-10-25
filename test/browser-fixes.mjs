// Focused deployed-game regression: native music timing and bathroom geometry.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { server, wss } from "../server.mjs";

const output = path.resolve("test-results", `fixes-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url =
  process.env.VERIFY_URL || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/verification-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body style="margin:0"></body></html>',
    }),
  );
  await page.goto(`${url}/verification-fixture`);
  await page.evaluate(async () => {
    const { Soundscape } = await import("/audio.mjs");
    window.sound = new Soundscape();
    window.sound.setMode("gameplay");
  });
  await page.evaluate(async () => {
    window.sound.unlock();
    await window.sound.ready;
  });
  const damage = await page.evaluate(() => {
    const sound = window.sound,
      before = sound.stats.hurtPlays,
      start = performance.now();
    sound.hurt();
    const source = [...sound.activeSources].find(
      (entry) => entry.source.buffer === sound.buffers.hurt,
    );
    return {
      elapsed: performance.now() - start,
      plays: sound.stats.hurtPlays - before,
      duration: sound.buffers.hurt.duration,
      rate: source?.source.playbackRate.value,
    };
  });
  assert.equal(damage.plays, 1);
  assert.equal(damage.rate, 1);
  assert.ok(damage.elapsed < 50);
  assert.ok(damage.duration < 1);
  const timings = [];
  for (const track of ["win", "loss", "win", "loss"]) {
    await page.evaluate((track) => window.sound.setOutcome(track), track);
    const el = page.locator(`#music-${track}`);
    await page.waitForFunction((track) => {
      const el = document.getElementById(`music-${track}`);
      return !el.paused && el.readyState >= 3 && el.currentTime > 0.1;
    }, track);
    await el.evaluate((el) => {
      el.defaultPlaybackRate = 1.75;
      el.playbackRate = 2;
    });
    await page.waitForFunction((track) => {
      const el = document.getElementById(`music-${track}`);
      return el.defaultPlaybackRate === 1 && el.playbackRate === 1;
    }, track);
    const ratio = await el.evaluate(async (el) => {
      const time = el.currentTime,
        wall = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return (el.currentTime - time) / ((performance.now() - wall) / 1000);
    });
    assert.ok(ratio > 0.8 && ratio < 1.2, `${track} playback speed ${ratio}`);
    timings.push({ track, ratio });
    await el.evaluate((el) => {
      el.currentTime = el.duration - 0.1;
    });
    await page.waitForFunction((track) => {
      const el = document.getElementById(`music-${track}`);
      return (
        el.loop && !el.paused && el.currentTime > 0.02 && el.currentTime < 3
      );
    }, track);
    assert.equal(await el.evaluate((el) => el.playbackRate), 1);
    await page.evaluate(() => {
      window.sound.setMode("menu");
      window.sound.update(performance.now() + 300);
    });
  }
  await page.evaluate(async () => {
    for (const el of document.querySelectorAll("audio")) el.pause();
    const THREE = await import("/vendor/three.module.js");
    const { buildMansion } = await import("/mansion.mjs");
    const { buildDetails } = await import("/house-details.mjs");
    const { mansionProps } = await import("/shared/mansion.mjs");
    const scene = new THREE.Scene();
    buildMansion(scene);
    buildDetails(scene);
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.PointLight(0xffffff, 60, 30);
    light.position.set(15, 3, -14);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(70, 900 / 650, 0.05, 100);
    camera.position.set(13.5, 3.1, -16.5);
    camera.lookAt(18, 0.7, -12.6);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(900, 650);
    document.body.append(renderer.domElement);
    renderer.render(scene, camera);
    window.preview = { renderer };
    window.bath = mansionProps.find((p) => p.kind === "bathtub");
  });
  assert.equal(await page.evaluate(() => window.bath.z), -15);
  await page.screenshot({ path: path.join(output, "bathroom-clearance.png") });
  for (const model of ["shotgun", "revolver"]) {
    const gunDetails = await page.evaluate(async (model) => {
      const THREE = await import("/vendor/three.module.js");
      const { createSpecialGun, createRevolver } = await import(
        "/special-gun.mjs"
      );
      const gun = model === "shotgun" ? createSpecialGun() : createRevolver();
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x17232a);
      scene.add(gun, new THREE.HemisphereLight(0xffe7c5, 0x536e87, 3));
      const light = new THREE.DirectionalLight(0xffe8cd, 4);
      light.position.set(1, 2, -1);
      scene.add(light);
      const camera = new THREE.PerspectiveCamera(40, 900 / 650, 0.01, 10);
      camera.position.set(1.05, 0.46, -1.25);
      camera.lookAt(0, -0.07, -0.06);
      window.preview.renderer.render(scene, camera);
      return {
        name: gun.name,
        barrels: gun.children.filter((p) => p.name === "Shotgun barrel").length,
        chambers: gun.children.filter((p) => p.name === "Cylinder chamber face")
          .length,
        parts: gun.children.length,
        textures: gun.children.filter((p) => p.material.map).length,
      };
    }, model);
    assert.ok(gunDetails.parts >= 20);
    assert.ok(gunDetails.textures >= 5);
    assert.equal(
      model === "shotgun" ? gunDetails.barrels : gunDetails.chambers,
      model === "shotgun" ? 2 : 6,
    );
    await page.screenshot({ path: path.join(output, model + ".png") });
  }
  assert.deepEqual(await page.evaluate(() => window.sound.stats.errors), []);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "checks.json"),
    JSON.stringify({ url, timings, damage, errors }, null, 2),
  );
  console.log(JSON.stringify({ output, timings, damage, errors }));
} finally {
  await browser?.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise((resolve) => server.close(resolve));
  wss.close();
}
