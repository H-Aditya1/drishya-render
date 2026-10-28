import * as THREE from "./vendor/three.module.js";
import { mansionRooms, mansionProps } from "/shared/mansion.mjs";
import { createSpecialGun, createRevolver } from "./special-gun.mjs";
import { materialTexture, cabinetMirror } from "./material-textures.mjs";

function surface(kind, color = "#685044", motif = "") {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const scale = 2;
  const g = c.getContext("2d");
  g.scale(scale, scale);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  // Deterministic wear: no asset downloads and identical clues on both clients.
  for (let i = 0; i < 700; i++) {
    g.fillStyle = i % 2 ? "#00000016" : "#fff0cb09";
    g.fillRect((i * 47) % 256, (i * 89) % 256, 1 + (i % 7), 1 + (i % 3));
  }
  if (kind === "wood") {
    g.strokeStyle = "#1b1411";
    g.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      g.strokeRect(0, y, 256, 32);
      g.strokeRect(y % 64 ? 75 : 170, y, 256, 32);
      g.fillStyle = "#d3ac7130";
      g.fillRect(0, y + 2, 256, 0.75);
      g.fillStyle = "#171c1645";
      for (const x of [7, 247]) {
        g.beginPath();
        g.arc(x, y + 7, 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Wavy grain and knots give wood a worn, directional surface.
    g.strokeStyle = "#25190f30";
    g.lineWidth = 0.7;
    for (let n = 0; n < 100; n++) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const y = n * 2.6 + Math.sin(x * 0.035 + n) * 1.5;
        if (!x) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = "#a3896225";
    for (let i = 0; i < 50; i++) {
      g.beginPath();
      g.moveTo((i * 47) % 256, i * 5);
      g.lineTo(256, i * 5 + 2);
      g.stroke();
    }
  } else if (kind === "wall") {
    g.strokeStyle = "#d9bd7b28";
    for (let x = 16; x < 256; x += 32)
      for (let y = 16; y < 256; y += 48) {
        g.beginPath();
        g.moveTo(x, y - 12);
        g.lineTo(x + 8, y);
        g.lineTo(x, y + 12);
        g.lineTo(x - 8, y);
        g.closePath();
        g.stroke();
      }
    g.fillStyle = "#131511";
    g.fillRect(0, 180, 256, 76);
    g.strokeStyle = "#6d5335";
    for (let x = 0; x < 256; x += 42) g.strokeRect(x + 4, 188, 34, 58);
    for (let n = 0; n < 35; n++) {
      const x = (n * 67) % 256,
        y = (n * 43) % 175;
      g.strokeStyle = "#14191230";
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 2, y + 6);
      g.lineTo(x - 1, y + 10);
      g.stroke();
    }
  } else {
    g.strokeStyle = "#b8a17b";
    g.lineWidth = 2;
    g.strokeRect(9, 9, 238, 238);
    g.strokeRect(17, 17, 222, 222);
    g.globalAlpha = 0.48;
    for (let x = 42; x < 240; x += 43)
      for (let y = 42; y < 240; y += 43) {
        g.save();
        g.translate(x, y);
        g.strokeStyle = "#d9c395";
        g.fillStyle = "#d9c395";
        if (motif === "tiles") {
          g.fillRect(-13, -13, 26, 26);
        } else if (motif === "cross") {
          g.fillRect(-2, -13, 4, 26);
          g.fillRect(-10, -4, 20, 4);
        } else if (motif === "flower") {
          for (let n = 0; n < 5; n++) {
            g.rotate((Math.PI * 2) / 5);
            g.beginPath();
            g.ellipse(0, 7, 3, 7, 0, 0, 7);
            g.stroke();
          }
        } else if (motif === "clock") {
          g.beginPath();
          g.arc(0, 0, 12, 0, 7);
          g.stroke();
          g.beginPath();
          g.moveTo(-6, 0);
          g.lineTo(0, 0);
          g.lineTo(0, -8);
          g.stroke();
        } else if (motif === "books") {
          g.strokeRect(-10, -12, 20, 24);
          g.fillRect(-2, -12, 2, 24);
        } else {
          g.rotate(Math.PI / 4);
          g.strokeRect(-9, -9, 18, 18);
        }
        g.restore();
      }
    g.globalAlpha = 1;
    for (let n = 0; n < 256; n += 2) {
      g.fillStyle = n % 4 ? "#fff4d110" : "#0b17152a";
      g.fillRect(n, 0, 0.5, 256);
      g.fillRect(0, n, 256, 0.5);
    }
  }
  // Soft edge wear avoids pristine, uniformly flat surfaces.
  const age = g.createLinearGradient(0, 0, 256, 256);
  age.addColorStop(0, "#e2cba014");
  age.addColorStop(0.55, "#00000000");
  age.addColorStop(1, "#05070740");
  g.fillStyle = age;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
  return t;
}
export function buildMansion(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const box = new THREE.BoxGeometry(1, 1, 1),
    batches = new Map();
  const mat = (color, map) =>
    new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: 0.88,
      flatShading: true,
    });
  const wood = mat(0x9e8062, materialTexture("wood")),
    dark = mat(0x302923, materialTexture("wood")),
    brass = mat(0x9b7950, materialTexture("metal")),
    black = mat(0x101514, materialTexture("leather")),
    fabric = mat(0x4b4940, materialTexture("fabric")),
    plaster = mat(0x8b8375, materialTexture("plaster")),
    wall = mat(0xb0a58b, surface("wall", "#51473d"));
  const mirror = cabinetMirror();
  mirror.name = "Dining cupboard mirror";
  function cube(x, y, z, w, h, d, m = wood, angle = 0) {
    if (!batches.has(m)) batches.set(m, []);
    batches.get(m).push([x, y, z, w, h, d, angle]);
  }
  const floorTexture = surface("wood", "#6f5741");
  floorTexture.repeat.set(12, 12);
  cube(0, -0.14, 0, 42, 0.28, 42, mat(0xb9ab92, floorTexture));
  cube(0, 3.9, 0, 42, 0.2, 42, dark);
  for (const p of mansionProps) {
    const { x, z, w, d, h, kind } = p;
    if (["toilet", "bathtub", "basin"].includes(kind)) continue;
    if (kind === "wall") {
      cube(x, h / 2, z, w * 2, h, d * 2, wall);
      cube(x, 0.12, z, w * 2 + 0.06, 0.22, d * 2 + 0.06, dark);
      cube(x, 1.02, z, w * 2 + 0.04, 0.09, d * 2 + 0.04, brass);
      cube(x, 3.55, z, w * 2 + 0.12, 0.2, d * 2 + 0.12, dark);
    } else if (
      ["desk", "table", "counter", "bed", "pew", "altar", "dresser"].includes(
        kind,
      )
    ) {
      cube(x, h - 0.1, z, w * 2, 0.2, d * 2, wood);
      // Aprons and inset edging make table silhouettes readable at eye level.
      for (const side of [-1, 1]) {
        cube(x, h - 0.27, z + side * (d - 0.1), w * 1.9, 0.18, 0.1, dark);
        cube(x + side * (w - 0.1), h - 0.27, z, 0.1, 0.18, d * 1.9, dark);
        cube(
          x,
          h + 0.005,
          z + side * (d - 0.06),
          w * 1.92,
          0.025,
          0.035,
          brass,
        );
      }
      if (kind === "bed") {
        cube(x, h + 0.1, z, w * 1.9, 0.2, d * 1.9, fabric);
        cube(x, h + 0.25, z - d + 0.5, w * 1.7, 0.15, 0.6, plaster);
        cube(x, h, z + d - 0.1, w * 2, 1.3, 0.15, dark);
        for (const side of [-1, 1]) {
          cube(
            x + side * w * 0.48,
            h + 0.27,
            z - d + 0.52,
            w * 0.8,
            0.19,
            0.55,
            plaster,
          );
          cube(
            x + side * (w - 0.09),
            h + 0.35,
            z + d - 0.1,
            0.12,
            0.6,
            0.19,
            wood,
          );
        }
        cube(x, h + 0.22, z + 0.65, w * 1.88, 0.035, 1.1, fabric);
      } else if (kind === "pew")
        cube(x, h - 0.25, z + d - 0.1, w * 2, 0.6, 0.15, wood);
      else if (["counter", "dresser", "altar"].includes(kind))
        cube(x, h / 2, z, w * 1.95, h - 0.2, d * 1.95, dark);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cube(
            x + sx * (w - 0.14),
            h / 2,
            z + sz * (d - 0.14),
            0.16,
            h,
            0.16,
            dark,
          );
    } else if (kind === "chair") {
      const back = Math.sign(z) || 1;
      cube(x, 0.5, z, w * 2, 0.15, d * 2, wood);
      cube(x, 0.61, z, w * 1.75, 0.08, d * 1.75, fabric);
      for (const sx of [-1, 1])
        cube(
          x + sx * (w - 0.06),
          0.93,
          z + back * (d - 0.06),
          0.09,
          0.7,
          0.1,
          dark,
        );
      cube(x, 1.23, z + back * (d - 0.06), w * 2, 0.12, 0.12, wood);
      for (const sx of [-0.5, 0, 0.5])
        cube(x + sx * w, 0.96, z + back * (d - 0.06), 0.055, 0.5, 0.08, wood);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cube(x + sx * 0.3, 0.26, z + sz * 0.3, 0.1, 0.52, 0.1, dark);
    } else if (kind === "screen") {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      cube(x, h / 2, z, w * 2 + 0.02, h - 0.2, d * 2 - 0.2, fabric);
      for (const zz of [-d, d])
        cube(x, h / 2, z + zz, 0.6, h + 0.1, 0.1, brass);
    } else if (kind === "bookcase") {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      cube(x, h - 0.07, z, w * 2, 0.14, d * 2, wood);
      for (const side of [-1, 1])
        cube(x + side * (w - 0.06), h / 2, z - d + 0.03, 0.12, h, 0.12, wood);
      for (let row = 0; row < 4; row++) {
        cube(x, 0.3 + row * 0.65, z - 0.1, w * 2, 0.09, d * 2, wood);
        for (let j = 0; j < 7; j++)
          cube(
            x - w + 0.15 + j * 0.25,
            0.58 + row * 0.65,
            z - d - 0.03,
            0.16,
            0.4 + (j % 3) * 0.04,
            0.15,
            [brass, fabric, wood][j % 3],
          );
      }
    } else if (kind === "wardrobe" && p.room === 0) {
      // Preserve the original solid back and footprint while opening the front.
      cube(x, h / 2, z + d - 0.08, w * 2, h, 0.16, dark);
      for (const side of [-1, 1])
        cube(x + side * (w - 0.09), h / 2, z, 0.18, h, d * 2, wood);
      for (let row = 0; row <= 4; row++) {
        const shelfY = 0.12 + row * 0.56;
        cube(x, shelfY, z, w * 2, 0.09, d * 2, wood);
        if (row === 4) continue;
        for (let book = 0; book < 12; book++) {
          const bookX = x - w + 0.25 + book * 0.22;
          const height = 0.32 + ((book * 7 + row * 3) % 5) * 0.025;
          cube(
            bookX,
            shelfY + height / 2 + 0.05,
            z - d + 0.27,
            0.16 + (book % 2) * 0.025,
            height,
            0.42,
            [fabric, wood, brass, dark][(book + row) % 4],
          );
          if (book % 2 === 0)
            cube(
              bookX,
              shelfY + height * 0.75,
              z - d + 0.052,
              0.115,
              0.022,
              0.012,
              plaster,
            );
        }
      }
      cube(x, h - 0.06, z, w * 2, 0.12, d * 2, wood);
    } else {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      const mirrored = kind === "wardrobe" && p.room === 1;
      // Crown, plinth and recessed panels turn plain cover into readable cabinets.
      cube(x, h - 0.07, z, w * 2, 0.14, d * 2, wood);
      cube(x, 0.1, z, w * 2, 0.18, d * 2, wood);
      for (const side of [-1, 1])
        cube(x + side * (w + 0.005), h / 2, z, 0.025, h - 0.44, d * 1.5, wood);
      for (const side of [-1, 1]) {
        cube(
          x + side * w * 0.49,
          h / 2,
          z - d - 0.025,
          w * 0.92,
          h - 0.18,
          0.06,
          mirrored ? mirror : wood,
        );
        if (!mirrored)
          for (const level of [0.3, 0.72]) {
            cube(
              x + side * w * 0.49,
              h * level,
              z - d - 0.06,
              w * 0.72,
              h * 0.29,
              0.025,
              dark,
            );
            cube(
              x + side * w * 0.49,
              h * level,
              z - d - 0.077,
              w * 0.65,
              h * 0.25,
              0.014,
              wood,
            );
          }
        cube(x + side * 0.12, 1.15, z - d - 0.08, 0.045, 0.2, 0.05, brass);
      }
    }
  }
  // The library's reading desk gains drawers and a small stack of closed books.
  // Every detail stays inside the existing furniture footprint.
  cube(-11, 0.75, -12.65, 1.9, 0.24, 0.07, dark);
  for (const side of [-1, 1]) {
    cube(-11 + side * 0.48, 0.75, -12.7, 0.84, 0.18, 0.035, wood);
    cube(-11 + side * 0.48, 0.75, -12.73, 0.18, 0.035, 0.035, brass);
  }
  for (let n = 0; n < 3; n++) {
    cube(
      -11.6 + n * 0.035,
      1.08 + n * 0.1,
      -12,
      0.46,
      0.025,
      0.32,
      [fabric, dark, brass][n],
    );
    cube(-11.6 + n * 0.035, 1.115 + n * 0.1, -12, 0.43, 0.045, 0.29, plaster);
    cube(
      -11.6 + n * 0.035,
      1.15 + n * 0.1,
      -12,
      0.46,
      0.025,
      0.32,
      [fabric, dark, brass][n],
    );
  }
  // Door lintels, beams, and portraits make the hallway feel like an old house.
  for (const x of [-3, 3])
    for (const z of [-13.5, 0, 13.5]) {
      cube(x, 3.2, z, 0.62, 0.45, 3.2, dark);
      for (const dz of [-1.45, 1.45])
        cube(x, 1.6, z + dz, 0.58, 3.2, 0.12, wood);
    }
  for (const z of [-18, -9, 0, 9, 18]) cube(0, 3.65, z, 6, 0.25, 0.28, wood);
  const carpetMat = mat(0xffffff, surface("rug", "#502c29", "diamond"));
  carpetMat.map.repeat.set(1, 10);
  cube(0, 0.012, 0, 2.6, 0.018, 39, carpetMat);
  const ceiling = mat(0x8d8b80, materialTexture("plaster"));
  for (const [i, r] of mansionRooms.entries()) {
    const col = "#" + r.color.toString(16).padStart(6, "0");
    const rug = mat(0xffffff, surface("rug", col, r.motif));
    if (i !== 3) cube(r.x, 0.018, r.z, 8, 0.025, 8, rug);
    // A coloured wall panel keeps even wall-facing reveals readable.
    const wallpaper = mat(0xffffff, surface("wall", col));
    cube(Math.sign(r.x) * 20.66, 2.05, r.z, 0.025, 2.5, 10, wallpaper);
    // Plaster ceilings have their own finish, independent of each room's rug.
    cube(r.x, 3.77, r.z, 17.5, 0.035, 12.5, ceiling);
    const frameX = Math.sign(r.x) * 20.59;
    cube(frameX, 2.2, r.z, 0.13, 1.65, 1.25, brass);
    cube(frameX - Math.sign(r.x) * 0.08, 2.2, r.z, 0.03, 1.46, 1.06, black);
    const silhouette = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 0),
      mat(0x6f6651),
    );
    silhouette.position.set(frameX - Math.sign(r.x) * 0.12, 2.4, r.z);
    silhouette.scale.set(0.3, 1, 1);
    group.add(silhouette);
    cube(frameX - Math.sign(r.x) * 0.12, 1.96, r.z, 0.05, 0.52, 0.55, dark);
    // Clock faces have distinct times, giving a second clue beyond room colour.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#c2b089";
    g.beginPath();
    g.arc(64, 64, 60, 0, 7);
    g.fill();
    g.strokeStyle = "#292820";
    g.lineWidth = 3;
    for (let k = 0; k < 12; k++) {
      let a = (k * Math.PI) / 6;
      g.beginPath();
      g.moveTo(64 + 46 * Math.sin(a), 64 + 46 * Math.cos(a));
      g.lineTo(64 + 53 * Math.sin(a), 64 + 53 * Math.cos(a));
      g.stroke();
    }
    g.beginPath();
    g.moveTo(64, 22);
    g.lineTo(64, 64);
    g.lineTo(64 + 28 * Math.sin(i + 1), 64 + 28 * Math.cos(i + 1));
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.75),
      mat(0xffffff, t),
    );
    clock.position.set(r.x, 2.65, r.z - 5.95);
    group.add(clock);
    cube(r.x, 2.65, r.z - 6, 0.86, 0.86, 0.08, dark);
    // Frosted windows are dim, so distant rooms still fall into darkness.
    cube(r.x + 3, 2.25, r.z - 6.13, 1.9, 2, 0.1, dark);
    const glass = mat(0x3b4d50);
    glass.emissive.setHex(0x121b21);
    glass.emissiveIntensity = 0.25;
    cube(r.x + 3, 2.25, r.z - 6.05, 1.7, 1.8, 0.04, glass);
    cube(r.x + 3, 2.25, r.z - 6, 0.07, 1.8, 0.05, wood);
    cube(r.x + 3, 2.25, r.z - 6, 1.7, 0.07, 0.05, wood);
  }
  // Quiet, stationary ceiling fans in the living rooms; shared box batches.
  for (const [x, z] of [
    [-12, -13.5],
    [12, 0],
    [12, 13.5],
  ]) {
    cube(x, 3.58, z, 0.1, 0.3, 0.1, brass);
    cube(x, 3.39, z, 0.28, 0.12, 0.28, dark);
    for (let blade = 0; blade < 4; blade++) {
      const angle = Math.PI / 4 + (blade * Math.PI) / 2;
      cube(
        x + Math.cos(angle) * 0.47,
        3.4,
        z - Math.sin(angle) * 0.47,
        0.72,
        0.035,
        0.18,
        wood,
        angle,
      );
    }
  }
  // A small four-candle chandelier, with one restrained, shadow-free light.
  const candleGlow = new THREE.MeshBasicMaterial({
    color: 0xffd99b,
    toneMapped: false,
  });
  cube(-12, 3.65, 0, 0.28, 0.12, 0.28, dark);
  cube(-12, 3.25, 0, 0.035, 0.7, 0.035, brass);
  cube(-12, 2.91, 0, 1.28, 0.045, 0.06, brass);
  cube(-12, 2.91, 0, 0.06, 0.045, 1.28, brass);
  for (const [dx, dz] of [
    [-0.58, 0],
    [0.58, 0],
    [0, -0.58],
    [0, 0.58],
  ]) {
    cube(-12 + dx, 2.97, dz, 0.12, 0.06, 0.12, brass);
    cube(-12 + dx, 3.08, dz, 0.075, 0.18, 0.075, plaster);
    cube(-12 + dx, 3.19, dz, 0.045, 0.07, 0.045, candleGlow);
  }
  const chandelierLight = new THREE.PointLight(0xffd09a, 3.5, 7, 2);
  chandelierLight.name = "Dining chandelier";
  chandelierLight.position.set(-12, 2.95, 0);
  group.add(chandelierLight);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const sg = shadowCanvas.getContext("2d");
  const falloff = sg.createRadialGradient(32, 32, 5, 32, 32, 32);
  falloff.addColorStop(0, "rgba(0,0,0,0.42)");
  falloff.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = falloff;
  sg.fillRect(0, 0, 64, 64);
  const contact = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  });
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowProps = mansionProps.filter((p) => p.kind !== "wall");
  const shadows = new THREE.InstancedMesh(
    contactGeometry,
    contact,
    shadowProps.length,
  );
  const shadowPose = new THREE.Object3D();
  shadowPose.rotation.x = -Math.PI / 2;
  shadowProps.forEach((p, i) => {
    shadowPose.position.set(p.x, 0.042, p.z);
    shadowPose.scale.set(p.w * 2.7, p.d * 2.7, 1);
    shadowPose.updateMatrix();
    shadows.setMatrixAt(i, shadowPose.matrix);
  });
  shadows.computeBoundingSphere();
  group.add(shadows);
  for (const [m, items] of batches) {
    const mesh = new THREE.InstancedMesh(box, m, items.length),
      dummy = new THREE.Object3D();
    items.forEach(([x, y, z, w, h, d, angle], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

// Small shared maps add surface detail without extra meshes or render passes.
const detailMaps = new Map();
function detailMap(kind) {
  if (detailMaps.has(kind)) return detailMaps.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = "#dedbd2";
  g.fillRect(0, 0, 128, 128);
  if (kind === "lens") {
    const glass = g.createRadialGradient(48, 42, 3, 64, 64, 64);
    glass.addColorStop(0, "#fffce5");
    glass.addColorStop(0.6, "#c4d3cb");
    glass.addColorStop(1, "#697d79");
    g.fillStyle = glass;
    g.fillRect(0, 0, 128, 128);
  } else if (kind === "metal") {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = i % 3 ? "#ffffff25" : "#17242322";
      g.fillRect((i * 47) % 128, (i * 29) % 128, 3 + (i % 15), 1);
    }
  } else {
    g.strokeStyle = kind === "grip" ? "#18212165" : "#4c51452b";
    g.lineWidth = kind === "grip" ? 3 : 1;
    for (let n = 0; n < 128; n += kind === "grip" ? 8 : 4) {
      g.beginPath();
      g.moveTo(0, n);
      g.lineTo(128, n);
      g.stroke();
      if (kind !== "grip") {
        g.beginPath();
        g.moveTo(n, 0);
        g.lineTo(n, 128);
        g.stroke();
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  detailMaps.set(kind, map);
  return map;
}

export function createTorch() {
  const group = new THREE.Group();
  const copper = new THREE.MeshStandardMaterial({
    color: 0x8a6841,
    metalness: 0.65,
    roughness: 0.7,
    map: detailMap("metal"),
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x222b30,
    roughness: 0.85,
    map: detailMap("grip"),
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xd7cba0,
    emissive: 0x33270f,
    emissiveIntensity: 0.3,
    roughness: 0.5,
    map: detailMap("lens"),
  });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.038, 0.32, 8),
    dark,
  );
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.05, 0.12, 8),
    copper,
  );
  head.position.y = 0.19;
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.012, 8),
    glass,
  );
  lens.position.y = 0.255;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false }),
  );
  bulb.name = "Torch glow";
  bulb.position.y = 0.273;
  group.add(handle, head, lens, bulb);
  return group;
}

export function createFigure(scene, index) {
  const group = new THREE.Group();
  scene.add(group);
  const coat = new THREE.MeshStandardMaterial({
    color: index ? 0x5b4f3c : 0x465351,
    roughness: 1,
    flatShading: true,
    map: detailMap("cloth"),
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xaca18a,
    roughness: 1,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x242421,
    roughness: 1,
    map: detailMap("cloth"),
  });
  const mesh = (geometry, material, x, y, z) => {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.65, 8), coat, 0, 1.12, 0);
  // Collar, coat seams, belt, hair and boots add detail within the existing hit volume.
  mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.13, 8), dark, 0, 1.45, 0);
  mesh(new THREE.BoxGeometry(0.035, 0.48, 0.025), dark, 0, 1.13, -0.29);
  mesh(new THREE.BoxGeometry(0.5, 0.07, 0.36), dark, 0, 0.87, 0);
  for (const y of [0.99, 1.12, 1.25])
    mesh(new THREE.SphereGeometry(0.018, 5, 4), skin, 0.035, y, -0.29);
  mesh(
    new THREE.SphereGeometry(0.245, 8, 5, 0, Math.PI * 2, 0, 1.35),
    dark,
    0,
    1.64,
    0,
  );
  mesh(new THREE.BoxGeometry(0.48, 0.23, 0.3), dark, 0, 0.72, 0);
  mesh(new THREE.IcosahedronGeometry(0.25, 1), skin, 0, 1.62, 0);
  mesh(new THREE.BoxGeometry(0.25, 0.045, 0.045), dark, 0, 1.66, -0.21);
  mesh(new THREE.BoxGeometry(0.055, 0.08, 0.06), skin, 0, 1.59, -0.23);
  const legs = [-1, 1].map((s) =>
    mesh(new THREE.BoxGeometry(0.19, 0.65, 0.22), dark, s * 0.16, 0.36, 0),
  );
  legs.forEach((leg) => {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.17, 0.31), dark);
    boot.position.set(0, -0.24, -0.045);
    leg.add(boot);
  });
  const arms = [-1, 1].map((s) =>
    mesh(new THREE.BoxGeometry(0.17, 0.58, 0.2), coat, s * 0.36, 1.13, 0),
  );
  // Bake stationary clothing/head details into one draw per material.
  // Legs and arms stay independent for the existing movement animation.
  const stationary = group.children.filter(
    (part) => !legs.includes(part) && !arms.includes(part),
  );
  for (const material of [coat, skin, dark]) {
    const parts = stationary.filter((part) => part.material === material);
    if (!parts.length) continue;
    const geometries = parts.map((part) => {
      part.updateMatrix();
      return (
        part.geometry.index
          ? part.geometry.toNonIndexed()
          : part.geometry.clone()
      ).applyMatrix4(part.matrix);
    });
    const merged = new THREE.BufferGeometry();
    for (const attribute of ["position", "normal", "uv"]) {
      const size = geometries[0].getAttribute(attribute).itemSize;
      const count = geometries.reduce(
        (sum, geometry) => sum + geometry.getAttribute(attribute).array.length,
        0,
      );
      const array = new Float32Array(count);
      let offset = 0;
      for (const geometry of geometries) {
        const source = geometry.getAttribute(attribute).array;
        array.set(source, offset);
        offset += source.length;
      }
      merged.setAttribute(attribute, new THREE.BufferAttribute(array, size));
    }
    merged.computeBoundingSphere();
    for (const part of parts) {
      group.remove(part);
      part.geometry.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    group.add(new THREE.Mesh(merged, material));
  }
  const gun = createRevolver();
  scene.add(gun);
  const specialGun = createSpecialGun();
  scene.add(specialGun);
  const torch = createTorch();
  scene.add(torch);
  return {
    group,
    legs,
    arms,
    gun,
    specialGun,
    torch,
    lastX: 0,
    lastZ: 0,
    stride: 0,
  };
}
