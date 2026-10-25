import * as THREE from "./vendor/three.module.js";

let materials;
function finish(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = { steel: "#52616b", wood: "#633c2c", brass: "#b49358" }[kind];
  ctx.fillRect(0, 0, 256, 256);
  // Fixed patterns keep both players' weapons identical without external assets.
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = i % 3 ? "#090e1422" : "#fff1cc30";
    ctx.fillRect((i * 73) % 256, (i * 109) % 256, 1 + (i % 5), 1);
  }
  if (kind === "steel") {
    for (let i = 0; i < 110; i++) {
      ctx.strokeStyle = i % 4 ? "#c0d2d214" : "#10192144";
      ctx.beginPath();
      ctx.moveTo((i * 47) % 256, (i * 59) % 256);
      ctx.lineTo(((i * 47) % 256) + 10 + (i % 31), ((i * 59) % 256) + 1);
      ctx.stroke();
    }
  } else if (kind === "wood") {
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = i % 3 ? "#1f100f80" : "#c58b5866";
      ctx.beginPath();
      ctx.moveTo(i * 7, 0);
      ctx.bezierCurveTo(i * 7 - 18, 80, i * 7 + 17, 160, i * 7 - 4, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = "#190e0b70";
    for (let i = -256; i < 512; i += 13) {
      for (const direction of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + direction * 256, 256);
        ctx.stroke();
      }
    }
  } else {
    // Engraved eye and double frame connect the special weapon to Drishya's identity.
    ctx.strokeStyle = "#3b352b";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.lineWidth = 2;
    ctx.strokeRect(19, 19, 218, 218);
    ctx.beginPath();
    ctx.moveTo(37, 128);
    ctx.quadraticCurveTo(128, 45, 219, 128);
    ctx.quadraticCurveTo(128, 211, 37, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 128, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#283438";
    ctx.beginPath();
    ctx.arc(128, 128, 12, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [31, 225])
      for (const y of [31, 225]) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function weapon(name) {
  materials ||= {
    steel: new THREE.MeshStandardMaterial({
      color: 0xaebdc4,
      map: finish("steel"),
      metalness: 0.7,
      roughness: 0.38,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xb99b65,
      metalness: 0.7,
      roughness: 0.35,
    }),
    engraved: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: finish("brass"),
      metalness: 0.55,
      roughness: 0.48,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: finish("wood"),
      roughness: 0.72,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x10171b, roughness: 0.76 }),
  };
  const gun = new THREE.Group();
  gun.name = name;
  const part = (name, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    gun.add(mesh);
    return mesh;
  };
  const box = (name, material, x, y, z, w, h, d) =>
    part(name, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const tube = (name, material, x, y, z, radius, length, sides = 16) => {
    const mesh = part(
      name,
      new THREE.CylinderGeometry(radius, radius, length, sides),
      material,
      x,
      y,
      z,
    );
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const guard = (z) => {
    const mesh = part(
      "Brass trigger guard",
      new THREE.TorusGeometry(0.068, 0.008, 6, 16),
      "brass",
      0,
      -0.105,
      z,
    );
    mesh.rotation.y = Math.PI / 2;
    box("Trigger", "steel", 0, -0.1, z, 0.016, 0.05, 0.016).rotation.x = -0.3;
  };
  return { gun, part, box, tube, guard };
}

export function createRevolver() {
  const { gun, part, box, tube, guard } = weapon(
    "Colt-style single-action revolver",
  );
  tube("Long Colt barrel", "steel", 0, 0.025, -0.19, 0.043, 0.44, 12);
  box("Ejector housing", "steel", 0.038, -0.017, -0.16, 0.03, 0.035, 0.36);
  box("Top strap", "steel", 0, 0.112, 0.08, 0.11, 0.03, 0.24);
  box("Revolver frame", "steel", 0, -0.045, 0.1, 0.12, 0.065, 0.25);
  tube("Six-chamber cylinder", "steel", 0, 0.02, 0.09, 0.094, 0.17, 24);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    tube(
      "Cylinder chamber face",
      "dark",
      Math.cos(angle) * 0.062,
      0.02 + Math.sin(angle) * 0.062,
      -0.0005,
      0.021,
      0.005,
      10,
    );
    const flute = box(
      "Cylinder flute",
      "dark",
      Math.cos(angle) * 0.092,
      0.02 + Math.sin(angle) * 0.092,
      0.09,
      0.018,
      0.009,
      0.105,
    );
    flute.rotation.z = angle - Math.PI / 2;
  }
  tube("Recessed muzzle", "dark", 0, 0.025, -0.413, 0.028, 0.007);
  part(
    "Muzzle crown",
    new THREE.TorusGeometry(0.035, 0.006, 6, 16),
    "steel",
    0,
    0.025,
    -0.416,
  );
  const grip = box(
    "Walnut Colt grip",
    "wood",
    0,
    -0.17,
    0.22,
    0.105,
    0.24,
    0.14,
  );
  grip.rotation.x = -0.32;
  box("Grip heel", "brass", 0, -0.275, 0.255, 0.11, 0.022, 0.145).rotation.x =
    -0.32;
  for (const side of [-1, 1]) {
    const screw = part(
      "Grip screw",
      new THREE.CylinderGeometry(0.012, 0.012, 0.008, 10),
      "brass",
      side * 0.056,
      -0.16,
      0.22,
    );
    screw.rotation.z = Math.PI / 2;
    box(
      "Frame sideplate",
      "engraved",
      side * 0.063,
      -0.025,
      0.19,
      0.006,
      0.07,
      0.08,
    );
  }
  guard(0.06);
  box(
    "Exposed Colt hammer",
    "steel",
    0,
    0.12,
    0.23,
    0.035,
    0.06,
    0.055,
  ).rotation.x = -0.4;
  box("Front blade sight", "brass", 0, 0.084, -0.34, 0.014, 0.04, 0.035);
  return gun;
}

export function createSpecialGun() {
  const { gun, part, box, tube, guard } = weapon(
    "Engraved double-barrel special shotgun",
  );
  for (const side of [-1, 1]) {
    const x = side * 0.05;
    tube("Shotgun barrel", "steel", x, 0.027, -0.2, 0.049, 0.58);
    tube("Deep shotgun bore", "dark", x, 0.027, -0.493, 0.036, 0.008);
    part(
      "Shotgun muzzle crown",
      new THREE.TorusGeometry(0.042, 0.007, 6, 16),
      "steel",
      x,
      0.027,
      -0.497,
    );
  }
  box("Double-barrel rib", "steel", 0, 0.071, -0.2, 0.018, 0.018, 0.56);
  box("Break-action receiver", "steel", 0, 0.005, 0.16, 0.205, 0.145, 0.24);
  box("Checkered walnut fore-end", "wood", 0, -0.047, -0.17, 0.16, 0.08, 0.33);
  box("Brass fore-end cap", "brass", 0, -0.047, -0.34, 0.167, 0.083, 0.015);
  const neck = box(
    "Walnut stock wrist",
    "wood",
    0,
    -0.07,
    0.3,
    0.115,
    0.13,
    0.23,
  );
  neck.rotation.x = -0.3;
  const stock = box("Shoulder stock", "wood", 0, -0.13, 0.45, 0.13, 0.21, 0.22);
  stock.rotation.x = -0.17;
  box(
    "Stock butt plate",
    "dark",
    0,
    -0.15,
    0.562,
    0.14,
    0.22,
    0.025,
  ).rotation.x = -0.17;
  for (const side of [-1, 1]) {
    box(
      "Engraved shotgun eye sideplate",
      "engraved",
      side * 0.107,
      0.008,
      0.16,
      0.009,
      0.11,
      0.19,
    );
    const pin = part(
      "Receiver hinge pin",
      new THREE.CylinderGeometry(0.013, 0.013, 0.014, 12),
      "brass",
      side * 0.114,
      -0.035,
      0.07,
    );
    pin.rotation.z = Math.PI / 2;
  }
  guard(0.16);
  box(
    "Break-action top lever",
    "brass",
    0.02,
    0.093,
    0.21,
    0.025,
    0.02,
    0.12,
  ).rotation.y = -0.25;
  part(
    "Front sight bead",
    new THREE.SphereGeometry(0.012, 8, 6),
    "brass",
    0,
    0.096,
    -0.4,
  );
  return gun;
}
