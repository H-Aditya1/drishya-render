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

export function createSpecialGun() {
  materials ||= {
    steel: new THREE.MeshStandardMaterial({
      color: 0x9caeb7,
      map: finish("steel"),
      metalness: 0.75,
      roughness: 0.4,
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
    dark: new THREE.MeshStandardMaterial({ color: 0x12191d, roughness: 0.76 }),
  };
  const gun = new THREE.Group();
  gun.name = "Engraved special hand cannon";
  const part = (name, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    gun.add(mesh);
    return mesh;
  };
  const box = (name, material, x, y, z, w, h, d) =>
    part(name, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const barrel = part(
    "Octagonal worn steel barrel",
    new THREE.CylinderGeometry(0.067, 0.078, 0.48, 8),
    "steel",
    0,
    0.025,
    -0.15,
  );
  barrel.rotation.x = Math.PI / 2;
  box("Breech", "steel", 0, 0.005, 0.11, 0.145, 0.16, 0.23);
  box("Barrel rib", "steel", 0, 0.096, -0.12, 0.032, 0.018, 0.43);
  for (const z of [-0.32, -0.02]) {
    const band = part(
      "Brass barrel band",
      new THREE.CylinderGeometry(0.079, 0.079, 0.025, 8),
      "brass",
      0,
      0.025,
      z,
    );
    band.rotation.x = Math.PI / 2;
  }
  const muzzle = part(
    "Dark recessed bore",
    new THREE.CylinderGeometry(0.047, 0.047, 0.007, 16),
    "dark",
    0,
    0.025,
    -0.393,
  );
  muzzle.rotation.x = Math.PI / 2;
  part(
    "Muzzle crown",
    new THREE.TorusGeometry(0.057, 0.009, 6, 16),
    "brass",
    0,
    0.025,
    -0.395,
  );
  const grip = box(
    "Checkered walnut grip",
    "wood",
    0,
    -0.17,
    0.17,
    0.115,
    0.26,
    0.145,
  );
  grip.rotation.x = -0.25;
  const cap = box(
    "Brass grip heel",
    "brass",
    0,
    -0.295,
    0.2,
    0.122,
    0.025,
    0.15,
  );
  cap.rotation.x = -0.25;
  for (const side of [-1, 1]) {
    box(
      "Engraved eye sideplate",
      "engraved",
      side * 0.077,
      0.01,
      0.11,
      0.009,
      0.117,
      0.185,
    );
    for (const z of [0.045, 0.175]) {
      const screw = part(
        "Sideplate screw",
        new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8),
        "steel",
        side * 0.084,
        0.045,
        z,
      );
      screw.rotation.z = Math.PI / 2;
    }
  }
  const guard = part(
    "Brass trigger guard",
    new THREE.TorusGeometry(0.071, 0.009, 6, 16),
    "brass",
    0,
    -0.115,
    0.015,
  );
  guard.rotation.y = Math.PI / 2;
  box("Trigger", "steel", 0, -0.108, 0.018, 0.018, 0.065, 0.018).rotation.x =
    -0.35;
  box("Hammer", "steel", 0, 0.116, 0.185, 0.035, 0.07, 0.065).rotation.x = -0.4;
  box("Front brass sight", "brass", 0, 0.123, -0.32, 0.018, 0.04, 0.025);
  for (const side of [-1, 1])
    box("Rear sight", "steel", side * 0.025, 0.112, 0.12, 0.018, 0.035, 0.035);
  return gun;
}
