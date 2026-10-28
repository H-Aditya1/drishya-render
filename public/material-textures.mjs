import * as THREE from "./vendor/three.module.js";

const cache = new Map();

export function cabinetMirror() {
  // A small static environment gives smoked glass a reflection without rendering
  // the scene again. It is decorative and does not reveal hidden players.
  const faces = Array.from({ length: 6 }, (_, side) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const g = canvas.getContext("2d");
    const room = g.createLinearGradient(0, 0, 0, 128);
    room.addColorStop(0, "#242e35");
    room.addColorStop(0.5, "#63767a");
    room.addColorStop(0.72, "#303b3d");
    room.addColorStop(1, "#28271e");
    g.fillStyle = room;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#151f24";
    for (const x of [9, 103]) g.fillRect(x, 5, 13, 110);
    g.fillRect(0, 80, 128, 5);
    if (side % 2 === 0) {
      g.fillStyle = "#a9b9b4";
      g.fillRect(43, 26, 28, 42);
      g.fillStyle = "#334246";
      g.fillRect(55, 26, 3, 42);
      g.fillRect(43, 45, 28, 3);
    }
    return canvas;
  });
  const environment = new THREE.CubeTexture(faces);
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: 0x9caeac,
    metalness: 0.95,
    roughness: 0.16,
    envMap: environment,
    envMapIntensity: 0.7,
  });
}

// Shared, deterministic colour maps only. No extra lights, geometry or shader passes.
export function materialTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ["wood", "plaster"].includes(kind) ? 256 : 128;
  const g = canvas.getContext("2d");
  const size = canvas.width;
  g.scale(size / 128, size / 128);
  g.fillStyle = "#e3dfd5";
  g.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 1200; n++) {
    g.fillStyle = n % 3 ? "#ffffff12" : "#343c3515";
    g.fillRect((n * 47) % 128, (n * 79) % 128, 1, 1);
  }
  if (kind === "wood") {
    for (let n = 0; n < 75; n++) {
      g.strokeStyle = n % 4 ? "#40332925" : "#fff5cf40";
      g.lineWidth = n % 4 ? 0.5 : 1;
      g.beginPath();
      for (let y = 0; y <= 128; y += 2) {
        const x = n * 1.75 + Math.sin((y * Math.PI) / 64 + n) * 1.3;
        if (!y) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (const [x, y] of [
      [31, 44],
      [94, 99],
    ]) {
      for (let r = 1; r < 5; r++) {
        g.strokeStyle = "#30251c18";
        g.beginPath();
        g.ellipse(x, y, r * 1.5, r * 4, 0.06, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (kind === "fabric" || kind === "leather" || kind === "fur") {
    for (let n = 0; n < 128; n += 3) {
      g.strokeStyle = "#39403828";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(n, 0);
      g.lineTo(n, 128);
      g.stroke();
      if (kind === "fabric") {
        g.strokeStyle = "#ffffff38";
        g.beginPath();
        g.moveTo(0, n);
        g.lineTo(128, n);
        g.stroke();
      }
    }
    if (kind === "leather") {
      g.strokeStyle = "#493a2c26";
      for (let n = 0; n < 70; n++) {
        const x = (n * 37) % 128,
          y = (n * 61) % 128;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 3, y + 2);
        g.lineTo(x + 1, y + 5);
        g.stroke();
      }
    }
    if (kind === "fur") {
      for (let n = 0; n < 14; n++) {
        g.fillStyle = "#363b3630";
        g.fillRect(n * 10, 0, 2 + (n % 3), 128);
      }
    }
  } else if (kind === "metal") {
    for (let n = 0; n < 128; n++) {
      g.fillStyle = n % 3 ? "#ffffff10" : "#2534331d";
      g.fillRect(0, n, 128, 0.5);
    }
    for (let n = 0; n < 50; n++) {
      g.fillStyle = n % 2 ? "#fff0c84a" : "#32372b35";
      g.fillRect((n * 41) % 128, (n * 59) % 128, 2 + (n % 9), 0.7);
    }
  } else if (kind === "water") {
    g.strokeStyle = "#7eaaa235";
    g.lineWidth = 1;
    for (let n = 0; n < 10; n++) {
      g.beginPath();
      for (let x = 0; x <= 128; x += 2) {
        const y = n * 14 + Math.sin((x * Math.PI) / 32 + n) * 3;
        if (!x) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    // Sparse glaze crazing on ceramic; irregular hairline wear on plaster.
    const ceramic = kind === "ceramic";
    g.strokeStyle = ceramic ? "#66766b18" : "#5b574538";
    g.lineWidth = ceramic ? 0.35 : 0.65;
    for (let n = 0; n < (ceramic ? 7 : 16); n++) {
      const x = (n * 47) % 128,
        y = (n * 31) % 128;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3, y + 7);
      g.lineTo(x, y + 11);
      g.lineTo(x + 5, y + 18);
      g.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 2;
  cache.set(kind, map);
  return map;
}
