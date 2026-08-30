import * as THREE from 'three';
import type { DesignQRQuality, TreeTheme } from '../../config/types.ts';
import type { TreeData, VoxelBlock } from '../../designs/tree/treeBuilder.ts';
import {
  BLOCK_SIZE,
  QR_SCAN_DESKTOP_DISTANCE,
  QR_SCAN_DESKTOP_VERTICAL_FOV,
  QR_SCAN_MOBILE_DISTANCE,
  QR_SCAN_MOBILE_HORIZONTAL_FOV,
  QR_VISUAL_REFERENCE_GRID_SIZE,
  VIEW_TRANSITION_DURATION_SECONDS,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
  TreeBlockType,
  SEASON_ENV_CONFIGS,
  hexToRgbTuple,
} from '../../designs/tree/constants.ts';

const DEFAULT_TREE_YAW = 0.785398;
const DEFAULT_TREE_PITCH = -0.55;
const TREE_DESKTOP_DISTANCE = 2.85;
const TREE_MOBILE_DISTANCE = 2.45;
const ROTATION_RESET_DURATION_MS = 600;

// 1. Authentic 5-Petal Flower Blossom Geometry (Spring / Custom)
function createBlossomFlowerGeometry(
  size: number,
  baseColor: THREE.Color,
  tipColor: THREE.Color,
  centerColor: THREE.Color
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  const numPetals = 5;
  const numSegments = 4;
  const petalLength = size * 1.15;
  const petalWidth = size * 0.44;
  const curlHeight = size * 0.16;

  const baseDeep = baseColor.clone().multiplyScalar(0.96);

  for (let p = 0; p < numPetals; p++) {
    const angle = (p / numPetals) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let s = 0; s < numSegments; s++) {
      const t0 = s / numSegments;
      const t1 = (s + 1) / numSegments;

      const d0 = t0 * petalLength;
      const d1 = t1 * petalLength;

      const hw0 = petalWidth * Math.sin(t0 * Math.PI) * Math.sqrt(1.0 - t0 * 0.28);
      const hw1 = petalWidth * Math.sin(t1 * Math.PI) * Math.sqrt(1.0 - t1 * 0.28);

      const curl0 = curlHeight * 4.0 * t0 * (1.0 - t0);
      const curl1 = curlHeight * 4.0 * t1 * (1.0 - t1);

      // Left 0
      const v0x = d0 * cosA - hw0 * -sinA;
      const v0y = curl0;
      const v0z = d0 * sinA - hw0 * cosA;

      // Right 0
      const v1x = d0 * cosA + hw0 * -sinA;
      const v1y = curl0;
      const v1z = d0 * sinA + hw0 * cosA;

      // Left 1
      const v2x = d1 * cosA - hw1 * -sinA;
      const v2y = curl1;
      const v2z = d1 * sinA - hw1 * cosA;

      // Right 1
      const v3x = d1 * cosA + hw1 * -sinA;
      const v3y = curl1;
      const v3z = d1 * sinA + hw1 * cosA;

      // Triangle 1: v0 -> v1 -> v2
      verts.push(v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
      // Triangle 2: v1 -> v3 -> v2
      verts.push(v1x, v1y, v1z, v3x, v3y, v3z, v2x, v2y, v2z);

      for (let k = 0; k < 6; k++) norms.push(0, 1, 0);

      const c0 = t0 < 0.3 ? baseDeep.clone().lerp(baseColor, t0 / 0.3) : baseColor.clone().lerp(tipColor, (t0 - 0.3) / 0.7);
      const c1 = t1 < 0.3 ? baseDeep.clone().lerp(baseColor, t1 / 0.3) : baseColor.clone().lerp(tipColor, (t1 - 0.3) / 0.7);

      colors.push(c0.r * 0.98, c0.g * 0.98, c0.b * 0.98);
      colors.push(c0.r, c0.g, c0.b);
      colors.push(c1.r * 0.98, c1.g * 0.98, c1.b * 0.98);

      colors.push(c0.r, c0.g, c0.b);
      colors.push(c1.r, c1.g, c1.b);
      colors.push(c1.r * 0.98, c1.g * 0.98, c1.b * 0.98);
    }
  }

  // Central Raised Pistil Disc (10 radial triangles matching theme)
  const centerRadius = size * 0.14;
  const centerElevation = curlHeight * 0.75;
  const diskSegs = 10;

  for (let i = 0; i < diskSegs; i++) {
    const a0 = (i / diskSegs) * Math.PI * 2;
    const a1 = ((i + 1) / diskSegs) * Math.PI * 2;

    verts.push(
      0, centerElevation, 0,
      Math.cos(a0) * centerRadius, centerElevation * 0.85, Math.sin(a0) * centerRadius,
      Math.cos(a1) * centerRadius, centerElevation * 0.85, Math.sin(a1) * centerRadius
    );

    for (let k = 0; k < 3; k++) {
      norms.push(0, 1, 0);
      colors.push(centerColor.r, centerColor.g, centerColor.b);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 2. Realistic 3-Blade Pointed Leaf Geometry (Summer & Autumn)
function createLeafGeometry(
  size: number,
  baseColor: THREE.Color,
  tipColor: THREE.Color
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  const numLeaves = 3;
  const numSegments = 4;
  const leafLength = size * 1.35;
  const leafWidth = size * 0.38;
  const curlHeight = size * 0.12;

  const baseDeep = baseColor.clone().multiplyScalar(0.94);

  for (let p = 0; p < numLeaves; p++) {
    const angle = (p / numLeaves) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let s = 0; s < numSegments; s++) {
      const t0 = s / numSegments;
      const t1 = (s + 1) / numSegments;

      const d0 = t0 * leafLength;
      const d1 = t1 * leafLength;

      const hw0 = leafWidth * Math.sin(t0 * Math.PI) * Math.sqrt(1.0 - t0 * 0.2);
      const hw1 = leafWidth * Math.sin(t1 * Math.PI) * Math.sqrt(1.0 - t1 * 0.2);

      const curl0 = curlHeight * 4.0 * t0 * (1.0 - t0);
      const curl1 = curlHeight * 4.0 * t1 * (1.0 - t1);

      const rib0 = curl0 + size * 0.05 * Math.sin(t0 * Math.PI);
      const rib1 = curl1 + size * 0.05 * Math.sin(t1 * Math.PI);

      const v0x = d0 * cosA - hw0 * -sinA;
      const v0y = curl0;
      const v0z = d0 * sinA - hw0 * cosA;

      const vr0x = d0 * cosA;
      const vr0y = rib0;
      const vr0z = d0 * sinA;

      const v1x = d0 * cosA + hw0 * -sinA;
      const v1y = curl0;
      const v1z = d0 * sinA + hw0 * cosA;

      const v2x = d1 * cosA - hw1 * -sinA;
      const v2y = curl1;
      const v2z = d1 * sinA - hw1 * cosA;

      const vr1x = d1 * cosA;
      const vr1y = rib1;
      const vr1z = d1 * sinA;

      const v3x = d1 * cosA + hw1 * -sinA;
      const v3y = curl1;
      const v3z = d1 * sinA + hw1 * cosA;

      verts.push(v0x, v0y, v0z, vr0x, vr0y, vr0z, vr1x, vr1y, vr1z);
      verts.push(v0x, v0y, v0z, vr1x, vr1y, vr1z, v2x, v2y, v2z);

      verts.push(vr0x, vr0y, vr0z, v1x, v1y, v1z, v3x, v3y, v3z);
      verts.push(vr0x, vr0y, vr0z, v3x, v3y, v3z, vr1x, vr1y, vr1z);

      for (let k = 0; k < 12; k++) norms.push(0, 1, 0);

      const c0 = t0 < 0.3 ? baseDeep.clone().lerp(baseColor, t0 / 0.3) : baseColor.clone().lerp(tipColor, (t0 - 0.3) / 0.7);
      const c1 = t1 < 0.3 ? baseDeep.clone().lerp(baseColor, t1 / 0.3) : baseColor.clone().lerp(tipColor, (t1 - 0.3) / 0.7);

      for (let k = 0; k < 6; k++) {
        colors.push(c0.r * 0.97, c0.g * 0.97, c0.b * 0.97);
      }
      for (let k = 0; k < 6; k++) {
        colors.push(c1.r * 1.03, c1.g * 1.03, c1.b * 1.03);
      }
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 3. Delicate 6-Point Snowflake Crystal Geometry
function createSnowflakeGeometry(size: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  const arms = 6;
  const armLen = size * 1.2;
  const armW = size * 0.18;

  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const perpX = -sinA * armW;
    const perpZ = cosA * armW;

    // Main needle arm
    verts.push(
      -perpX, 0, -perpZ,
       perpX, 0,  perpZ,
       cosA * armLen, 0, sinA * armLen
    );
    for (let k = 0; k < 3; k++) {
      norms.push(0, 1, 0);
      colors.push(0.96, 0.98, 1.0); // Pure ice white
    }

    // Side crystal branches
    const branchStart = armLen * 0.5;
    const branchLen = armLen * 0.45;
    const ba1 = a + Math.PI * 0.25;
    const ba2 = a - Math.PI * 0.25;

    verts.push(
      cosA * branchStart, 0, sinA * branchStart,
      cosA * branchStart + perpX, 0, sinA * branchStart + perpZ,
      cosA * branchStart + Math.cos(ba1) * branchLen, 0, sinA * branchStart + Math.sin(ba1) * branchLen
    );
    verts.push(
      cosA * branchStart, 0, sinA * branchStart,
      cosA * branchStart - perpX, 0, sinA * branchStart - perpZ,
      cosA * branchStart + Math.cos(ba2) * branchLen, 0, sinA * branchStart + Math.sin(ba2) * branchLen
    );
    for (let k = 0; k < 6; k++) {
      norms.push(0, 1, 0);
      colors.push(0.92, 0.96, 1.0);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 2c. Soft Volumetric Frosted Snowdrifts
function createSnowdriftsGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const segments = 8;
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];
  const w = 0.0095;
  const h = 0.022;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

    // Base ring to mid mound
    verts.push(
      cos0 * w, 0, sin0 * w,
      cos1 * w, 0, sin1 * w,
      cos0 * (w * 0.65), h * 0.65, sin0 * (w * 0.65)
    );
    verts.push(
      cos1 * w, 0, sin1 * w,
      cos1 * (w * 0.65), h * 0.65, sin1 * (w * 0.65),
      cos0 * (w * 0.65), h * 0.65, sin0 * (w * 0.65)
    );

    // Mid mound to soft rounded apex
    verts.push(
      cos0 * (w * 0.65), h * 0.65, sin0 * (w * 0.65),
      cos1 * (w * 0.65), h * 0.65, sin1 * (w * 0.65),
      0, h, 0
    );

    for (let k = 0; k < 6; k++) norms.push(cos0 * 0.5, 0.7, sin0 * 0.5);
    for (let k = 0; k < 3; k++) norms.push(0, 1.0, 0);

    for (let k = 0; k < 6; k++) colors.push(0.88, 0.94, 0.99);
    for (let k = 0; k < 3; k++) colors.push(1.0, 1.0, 1.0);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 2a. Flat 2D Petal Geometry for Ground Fallen Leaves (same outline as canopy blossom, all y=0)
function createFlatGroundPetalGeometry(
  size: number,
  baseColor: THREE.Color,
  tipColor: THREE.Color,
  centerColor: THREE.Color
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  const numPetals = 5;
  const numSegments = 4;
  const petalLength = size * 1.15;
  const petalWidth = size * 0.44;

  const baseDeep = baseColor.clone().multiplyScalar(0.85);

  for (let p = 0; p < numPetals; p++) {
    const angle = (p / numPetals) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let s = 0; s < numSegments; s++) {
      const t0 = s / numSegments;
      const t1 = (s + 1) / numSegments;

      const d0 = t0 * petalLength;
      const d1 = t1 * petalLength;

      const hw0 = petalWidth * Math.sin(t0 * Math.PI) * Math.sqrt(1.0 - t0 * 0.28);
      const hw1 = petalWidth * Math.sin(t1 * Math.PI) * Math.sqrt(1.0 - t1 * 0.28);

      // All vertices at y = 0 (completely flat 2D)
      const v0x = d0 * cosA - hw0 * -sinA;
      const v0z = d0 * sinA - hw0 * cosA;
      const v1x = d0 * cosA + hw0 * -sinA;
      const v1z = d0 * sinA + hw0 * cosA;
      const v2x = d1 * cosA - hw1 * -sinA;
      const v2z = d1 * sinA - hw1 * cosA;
      const v3x = d1 * cosA + hw1 * -sinA;
      const v3z = d1 * sinA + hw1 * cosA;

      verts.push(v0x, 0, v0z, v1x, 0, v1z, v2x, 0, v2z);
      verts.push(v1x, 0, v1z, v3x, 0, v3z, v2x, 0, v2z);

      for (let k = 0; k < 6; k++) norms.push(0, 1, 0);

      const c0 = t0 < 0.3 ? baseDeep.clone().lerp(baseColor, t0 / 0.3) : baseColor.clone().lerp(tipColor, (t0 - 0.3) / 0.7);
      const c1 = t1 < 0.3 ? baseDeep.clone().lerp(baseColor, t1 / 0.3) : baseColor.clone().lerp(tipColor, (t1 - 0.3) / 0.7);

      colors.push(c0.r * 0.94, c0.g * 0.94, c0.b * 0.94);
      colors.push(c0.r, c0.g, c0.b);
      colors.push(c1.r * 0.94, c1.g * 0.94, c1.b * 0.94);
      colors.push(c0.r, c0.g, c0.b);
      colors.push(c1.r, c1.g, c1.b);
      colors.push(c1.r * 0.94, c1.g * 0.94, c1.b * 0.94);
    }
  }

  // Flat center disc
  const centerRadius = size * 0.28;
  const diskSegs = 10;
  for (let i = 0; i < diskSegs; i++) {
    const a0 = (i / diskSegs) * Math.PI * 2;
    const a1 = ((i + 1) / diskSegs) * Math.PI * 2;
    verts.push(
      0, 0, 0,
      Math.cos(a0) * centerRadius, 0, Math.sin(a0) * centerRadius,
      Math.cos(a1) * centerRadius, 0, Math.sin(a1) * centerRadius
    );
    for (let k = 0; k < 3; k++) {
      norms.push(0, 1, 0);
      colors.push(centerColor.r, centerColor.g, centerColor.b);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 2b. Flat 2D Leaf Geometry for Ground Fallen Leaves (same outline as canopy leaf, all y=0)
function createFlatGroundLeafGeometry(
  size: number,
  baseColor: THREE.Color,
  tipColor: THREE.Color
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  const numLeaves = 3;
  const numSegments = 4;
  const leafLength = size * 1.35;
  const leafWidth = size * 0.38;

  const baseDeep = baseColor.clone().multiplyScalar(0.75);

  for (let p = 0; p < numLeaves; p++) {
    const angle = (p / numLeaves) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let s = 0; s < numSegments; s++) {
      const t0 = s / numSegments;
      const t1 = (s + 1) / numSegments;

      const d0 = t0 * leafLength;
      const d1 = t1 * leafLength;

      const hw0 = leafWidth * Math.sin(t0 * Math.PI) * Math.sqrt(1.0 - t0 * 0.2);
      const hw1 = leafWidth * Math.sin(t1 * Math.PI) * Math.sqrt(1.0 - t1 * 0.2);

      // All vertices at y = 0 (completely flat 2D)
      const v0x = d0 * cosA - hw0 * -sinA;
      const v0z = d0 * sinA - hw0 * cosA;
      const v1x = d0 * cosA + hw0 * -sinA;
      const v1z = d0 * sinA + hw0 * cosA;
      const v2x = d1 * cosA - hw1 * -sinA;
      const v2z = d1 * sinA - hw1 * cosA;
      const v3x = d1 * cosA + hw1 * -sinA;
      const v3z = d1 * sinA + hw1 * cosA;

      verts.push(v0x, 0, v0z, v1x, 0, v1z, v2x, 0, v2z);
      verts.push(v1x, 0, v1z, v3x, 0, v3z, v2x, 0, v2z);

      for (let k = 0; k < 6; k++) norms.push(0, 1, 0);

      const c0 = t0 < 0.3 ? baseDeep.clone().lerp(baseColor, t0 / 0.3) : baseColor.clone().lerp(tipColor, (t0 - 0.3) / 0.7);
      const c1 = t1 < 0.3 ? baseDeep.clone().lerp(baseColor, t1 / 0.3) : baseColor.clone().lerp(tipColor, (t1 - 0.3) / 0.7);

      for (let k = 0; k < 3; k++) {
        colors.push(c0.r * 0.90, c0.g * 0.90, c0.b * 0.90);
      }
      for (let k = 0; k < 3; k++) {
        colors.push(c1.r * 1.05, c1.g * 1.05, c1.b * 1.05);
      }
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 3b. Realistic Sculpted Bonsai Wood Bark Geometry (textured, fluted bark with knotholes and natural shading)
function createOrganicBranchGeometry(
  topRadius: number,
  bottomRadius: number,
  length: number,
  depth: number,
  seed: number,
  isWinter: boolean
): THREE.BufferGeometry {
  const segments = 10;
  const heightSegments = 3;
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const colors: number[] = [];

  // Multi-tonal rich aged wood bark palette
  const deepShadow = isWinter ? new THREE.Color(0.18, 0.14, 0.12) : new THREE.Color(0.19, 0.09, 0.04);
  const midBark = isWinter ? new THREE.Color(0.28, 0.22, 0.18) : new THREE.Color(0.30, 0.16, 0.08);
  const ridgeLight = isWinter ? new THREE.Color(0.38, 0.32, 0.28) : new THREE.Color(0.44, 0.26, 0.14);
  const tipWood = isWinter ? new THREE.Color(0.48, 0.44, 0.40) : new THREE.Color(0.54, 0.36, 0.20);

  const depthFactor = Math.min(1.0, depth * 0.35);
  const baseTone = midBark.clone().lerp(tipWood, depthFactor);

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const currentY = (v - 0.5) * length;
    let currentRadius = bottomRadius + (topRadius - bottomRadius) * v;

    // Gentle natural flare at trunk ground contact
    if (depth === 0 && v < 0.20) {
      currentRadius *= (1.0 + (0.20 - v) * 0.85);
    }

    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const angle = u * Math.PI * 2;

      // Natural bark fluting and knothole noise
      const ridgeNoise = Math.sin(angle * 5.0 + v * 4.0 + seed * 7.1) * 0.12;
      const organicR = currentRadius * (1.0 + ridgeNoise * (depth === 0 ? 0.18 : 0.10));

      const px = Math.cos(angle) * organicR;
      const pz = Math.sin(angle) * organicR;

      verts.push(px, currentY, pz);
      norms.push(Math.cos(angle), 0, Math.sin(angle));

      // Fluted Bark Shading
      const barkVal = (Math.sin(angle * 6.0 + seed * 13.0 + v * 3.0) * 0.5 + 0.5);
      const c = deepShadow.clone().lerp(ridgeLight, barkVal).lerp(baseTone, 0.45);
      colors.push(c.r, c.g, c.b);
    }
  }

  const indices: number[] = [];
  const stride = segments + 1;
  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < segments; x++) {
      const i0 = y * stride + x;
      const i1 = y * stride + (x + 1);
      const i2 = (y + 1) * stride + x;
      const i3 = (y + 1) * stride + (x + 1);

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }
  }

  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// 4. Summer Rain Streak Geometry
function createRainStreakGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const h = 0.055;
  const w = 0.0012;
  const verts = new Float32Array([
    -w,  h * 0.5, 0,
     w,  h * 0.5, 0,
     0, -h * 0.5, 0,
  ]);
  const norms = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const colors = new Float32Array([
    0.75, 0.88, 1.0,
    0.75, 0.88, 1.0,
    0.90, 0.96, 1.0,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function createButterflyWingGeometry(species: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // 6 vertices per wing (2 triangles forming realistic curved wing shape)
  // Vertex 0: Body base pivot (0,0,0)
  // Vertex 1: Outer high wing tip
  // Vertex 2: Outer bottom wing corner
  // Vertex 3: Body bottom edge
  const verts = new Float32Array([
    0, 0, 0,
    0.019, 0.014, 0.002,
    0.016, -0.009, -0.001,

    0, 0, 0,
    0.016, -0.009, -0.001,
    0, -0.007, 0,
  ]);

  // Distinct species color palettes:
  // 0: Morpho Electric Blue (base: #1c4ed8, tip: #60a5fa, edge: #0f172a)
  // 1: Monarch Vivid Orange (base: #ea580c, tip: #fbbf24, edge: #431407)
  // 2: Emerald Swallowtail (base: #059669, tip: #34d399, edge: #064e3b)
  // 3: Sakura Pink Pearl (base: #db2777, tip: #f472b6, edge: #500724)
  const speciesPalettes = [
    { base: [0.11, 0.31, 0.85], tip: [0.38, 0.65, 0.98], edge: [0.06, 0.09, 0.20] },
    { base: [0.92, 0.35, 0.05], tip: [0.99, 0.75, 0.14], edge: [0.26, 0.08, 0.03] },
    { base: [0.02, 0.59, 0.41], tip: [0.20, 0.83, 0.60], edge: [0.02, 0.30, 0.23] },
    { base: [0.86, 0.15, 0.47], tip: [0.96, 0.45, 0.71], edge: [0.31, 0.03, 0.14] },
  ];

  const pal = speciesPalettes[species % speciesPalettes.length];
  const b = pal.base;
  const t = pal.tip;
  const e = pal.edge;

  const colors = new Float32Array([
    b[0], b[1], b[2],
    t[0], t[1], t[2],
    e[0], e[1], e[2],

    b[0], b[1], b[2],
    e[0], e[1], e[2],
    b[0] * 0.7, b[1] * 0.7, b[2] * 0.7,
  ]);

  const norms = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
  return geo;
}

interface ButterflyState {
  mesh: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  currentPos: THREE.Vector3;
  velocity: THREE.Vector3;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  height: number;
  species: number;
  seed: number;
  flapSpeed: number;
  scale: number;
}

function disposeObjectResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          const value = uniform.value;
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export class ThreeFallbackRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private isRunning = false;
  private isDestroyed = false;
  private quality: DesignQRQuality;
  public onProgressUpdate?: (progress: number, blurIntensity: number) => void;
  public onAfterRender?: () => void;

  // Tree and Meshes
  private treeData: TreeData | null = null;
  private groundTilesMesh: THREE.InstancedMesh | null = null;
  private groundFallenLeavesMesh: THREE.InstancedMesh | null = null;
  private morphVoxelMesh: THREE.InstancedMesh | null = null;
  private morphBlocks: VoxelBlock[] = [];
  private branchesGroup: THREE.Group = new THREE.Group();
  private canopyFlowersMesh: THREE.InstancedMesh | null = null;
  private grassMesh: THREE.InstancedMesh | null = null;
  private petalsInstancedMesh: THREE.InstancedMesh | null = null;
  private rainMesh: THREE.InstancedMesh | null = null;
  private snowMesh: THREE.InstancedMesh | null = null;
  private islandBaseMesh: THREE.Mesh | null = null;
  private butterfliesGroup: THREE.Group = new THREE.Group();
  private butterflies: ButterflyState[] = [];

  // Interactive Cursor Tracking for Butterfly Follow
  private mouse3D: THREE.Vector3 = new THREE.Vector3(0, 0.35, 0);
  private mouseActive: boolean = false;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private hoverPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35);

  // Cached positions
  private groundPositions: VoxelBlock[] = [];
  private flowerBaseData: { x: number; y: number; z: number; normX: number; normZ: number; angle: number; scale: number; seed: number }[] = [];
  private flowerBaseMatrices: Float32Array = new Float32Array(0);
  private rainData: { x: number; y: number; z: number; speed: number; seed: number }[] = [];
  private snowData: { x: number; y: number; z: number; speed: number; rotSpeed: number; swaySeed: number; scale: number }[] = [];
  private fallingLeavesData: { x: number; y: number; z: number; speed: number; swayFreq: number; driftFreq: number; rotSpeed: number; seed: number; scale: number; phaseOffset: number }[] = [];
  private spawnStartTime: number = performance.now();
  private hasSpawned: boolean = false;

  // Material & Theme
  private season: number = 0;
  private customColor: THREE.Color = new THREE.Color(0.96, 0.48, 0.65);
  private customStrength: number = 0;
  private activeCustomTheme: TreeTheme | null = null;
  private startTime: number = performance.now();

  // Camera Orbit State & Smooth Ease-Out Transition
  public yaw: number = DEFAULT_TREE_YAW;
  public pitch: number = DEFAULT_TREE_PITCH;
  private _targetProgress: number = 0;
  public currentProgress: number = 0;
  private transitionStartTime: number = 0;
  private transitionStartVal: number = 0;
  private transitionSpeed: number = VIEW_TRANSITION_SPEED_DEFAULT;
  private transitionDuration: number = VIEW_TRANSITION_DURATION_SECONDS;
  private isTransitioning: boolean = false;
  private lastGroundProgress: number = -1;
  public isTurntable: boolean = false;
  private isResettingRotation: boolean = false;
  private rotationResetStartTime: number = 0;
  private rotationResetStartYaw: number = DEFAULT_TREE_YAW;
  private rotationResetStartPitch: number = DEFAULT_TREE_PITCH;

  public get targetProgress(): number {
    return this._targetProgress;
  }

  public set targetProgress(val: number) {
    if (Math.abs(this._targetProgress - val) > 0.001) {
      this.transitionStartVal = this.currentProgress;
      this._targetProgress = val;
      this.transitionDuration = VIEW_TRANSITION_DURATION_SECONDS / this.transitionSpeed;
      this.transitionStartTime = performance.now();
      this.isTransitioning = true;
    }
  }

  public setTransitionSpeed(speed: number) {
    const nextSpeed = THREE.MathUtils.clamp(
      speed,
      VIEW_TRANSITION_SPEED_MIN,
      VIEW_TRANSITION_SPEED_MAX
    );
    if (Math.abs(nextSpeed - this.transitionSpeed) < 0.001) return;

    const now = performance.now();
    const previousDuration = this.transitionDuration;
    const elapsedRatio = this.isTransitioning && previousDuration > 0
      ? THREE.MathUtils.clamp(
          ((now - this.transitionStartTime) * 0.001) / previousDuration,
          0,
          1
        )
      : 0;

    this.transitionSpeed = nextSpeed;
    this.transitionDuration = VIEW_TRANSITION_DURATION_SECONDS / nextSpeed;

    // Preserve the current point in an active morph while changing its remaining pace.
    if (this.isTransitioning) {
      this.transitionStartTime = now - elapsedRatio * this.transitionDuration * 1000;
    }
  }

  public setProgressImmediate(val: number) {
    const progress = THREE.MathUtils.clamp(val, 0, 1);
    this.currentProgress = progress;
    this._targetProgress = progress;
    this.transitionStartVal = progress;
    this.isTransitioning = false;
    this.lastGroundProgress = -1;
  }

  public resetRotation() {
    this.isTurntable = false;
    this.rotationResetStartTime = performance.now();
    this.rotationResetStartYaw = this.yaw;
    this.rotationResetStartPitch = this.pitch;
    this.isResettingRotation = true;
  }

  public cancelRotationReset() {
    this.isResettingRotation = false;
  }

  constructor(canvas: HTMLCanvasElement, quality: DesignQRQuality = 'high') {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = null;

    const width = canvas.clientWidth || window.innerWidth || 800;
    const height = canvas.clientHeight || window.innerHeight || 600;
    const aspect = width / height;
    const initialFov = aspect < 1.0
      ? (2 * Math.atan(Math.tan((QR_SCAN_MOBILE_HORIZONTAL_FOV * Math.PI) / 360) / aspect) * 180) / Math.PI
      : QR_SCAN_DESKTOP_VERTICAL_FOV;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 100);
    this.camera.position.set(1.5, 1.8, 1.5);
    this.camera.lookAt(0, 0.2, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.resolvePixelRatio());
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.NoToneMapping;
    // Remove Three.js version fingerprint from DOM
    this.renderer.domElement.removeAttribute('data-engine');

    this.scene.add(this.branchesGroup);
    this.scene.add(this.butterfliesGroup);

    this.initWeatherParticles();
    this.startLoop();
  }

  public setMousePosition(ndcX: number, ndcY: number, isHovering: boolean) {
    this.mouseActive = isHovering;
    if (isHovering) {
      this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.hoverPlane, hit)) {
        this.mouse3D.copy(hit);
      }
    }
  }

  private initWeatherParticles() {
    // Generate 180 Rain Streaks (Summer)
    this.rainData = [];
    for (let i = 0; i < 180; i++) {
      this.rainData.push({
        x: (Math.random() - 0.5) * 1.8,
        y: Math.random() * 1.8,
        z: (Math.random() - 0.5) * 1.8,
        speed: 0.9 + Math.random() * 0.4,
        seed: Math.random(),
      });
    }

    // Generate 300 Floating Snowflakes
    this.snowData = [];
    for (let i = 0; i < 300; i++) {
      this.snowData.push({
        x: (Math.random() - 0.5) * 2.0,
        y: Math.random() * 1.9,
        z: (Math.random() - 0.5) * 2.0,
        speed: 0.08 + Math.random() * 0.06,
        rotSpeed: (Math.random() - 0.5) * 2.0,
        swaySeed: Math.random() * 100,
        scale: 0.010 + Math.random() * 0.008,
      });
    }
  }

  public setTreeData(data: TreeData) {
    this.treeData = data;
    if (!this.hasSpawned) {
      this.spawnStartTime = performance.now();
      this.hasSpawned = true;
    }
    this.rebuildMeshes();
  }

  private getEnvConfig() {
    if (this.activeCustomTheme) {
      const p = this.activeCustomTheme.particleType;
      const customCanopyDensity =
        typeof this.activeCustomTheme.canopyDensity === 'number'
          ? Math.max(0.15, Math.min(1.0, this.activeCustomTheme.canopyDensity > 1.0 ? this.activeCustomTheme.canopyDensity / 100 : this.activeCustomTheme.canopyDensity))
          : 1.0;

      if (p === 'leaf' || p === 'sakura') {
        const amount =
          typeof this.activeCustomTheme.particleAmount === 'number'
            ? Math.max(0, Math.min(500, this.activeCustomTheme.particleAmount))
            : 60;
        const groundAmount =
          typeof this.activeCustomTheme.groundLeavesAmount === 'number'
            ? Math.max(0, Math.min(200, this.activeCustomTheme.groundLeavesAmount))
            : Math.round(amount * 0.85);

        return {
          id: 0,
          name: 'custom_leaves',
          canopyDensity: customCanopyDensity,
          fallingLeavesCount: amount,
          fallingLeafType: 'leaf',
          groundLeafCoverage: groundAmount === 0 ? 0.0 : Math.min(0.50, 0.05 + groundAmount * 0.0035),
          groundLeafCount: groundAmount,
          butterflyCount: 2,
          butterflyColor: 0xffedf4,
          snowflakesCount: 0,
        };
      } else if (p === 'fireflies') {
        return {
          id: 1,
          name: 'custom_fireflies',
          canopyDensity: customCanopyDensity,
          fallingLeavesCount: 0,
          fallingLeafType: 'none',
          groundLeafCoverage: 0.08,
          groundLeafCount: 16,
          butterflyCount: 12,
          butterflyColor: 0xffea44, // Bright glowing golden fireflies
          snowflakesCount: 0,
        };
      } else if (p === 'snow') {
        return {
          id: 3,
          name: 'custom_snow',
          canopyDensity: customCanopyDensity,
          fallingLeavesCount: 0,
          fallingLeafType: 'none',
          groundLeafCoverage: 0.0,
          groundLeafCount: 0,
          butterflyCount: 0,
          butterflyColor: 0xffedf4,
          snowflakesCount: 300,
        };
      } else {
        // 'none' / clean
        return {
          id: 4,
          name: 'custom_clean',
          canopyDensity: customCanopyDensity,
          fallingLeavesCount: 0,
          fallingLeafType: 'none',
          groundLeafCoverage: 0.0,
          groundLeafCount: 0,
          butterflyCount: 0,
          butterflyColor: 0xffffff,
          snowflakesCount: 0,
        };
      }
    }
    return SEASON_ENV_CONFIGS[this.season] || SEASON_ENV_CONFIGS[0];
  }

  private rebuildMeshes() {
    if (!this.treeData) return;

    const envConfig = this.getEnvConfig();
    const gridSize = this.treeData.gridSize;
    const islandWidth = gridSize * BLOCK_SIZE; // Flush with QR code grid — NO exposed border frame!

    // 1. Floating Island Pedestal Slab (Flush with QR matrix)
    if (this.islandBaseMesh) {
      this.scene.remove(this.islandBaseMesh);
      this.islandBaseMesh.geometry.dispose();
      (this.islandBaseMesh.material as THREE.Material).dispose();
      this.islandBaseMesh = null;
    }

    const slabGeo = new THREE.BoxGeometry(islandWidth, 0.02, islandWidth);
    let slabColor =
      this.season === 0
        ? new THREE.Color(101 / 255, 89 / 255, 93 / 255) // ⑦   in Spring 3D
        : new THREE.Color(0.44, 0.44, 0.48); // Deep slate stone pedestal in 3D

    if (this.activeCustomTheme) {
      const [cr, cg, cb] = hexToRgbTuple(this.activeCustomTheme.groundColor);
      slabColor = new THREE.Color(cr * 0.70, cg * 0.70, cb * 0.70);
    }

    const slabMat = new THREE.MeshBasicMaterial({ color: slabColor });
    this.islandBaseMesh = new THREE.Mesh(slabGeo, slabMat);
    this.islandBaseMesh.position.set(0, -0.01, 0);
    this.scene.add(this.islandBaseMesh);

    // 2. Ground Terrace Stone Tiles
    const groundBlocks = this.treeData.blocks.filter((b) => b.y <= BLOCK_SIZE * 0.5 && b.type !== TreeBlockType.CherryBlossom);

    if (this.groundTilesMesh) {
      this.scene.remove(this.groundTilesMesh);
      this.groundTilesMesh.geometry.dispose();
      (this.groundTilesMesh.material as THREE.Material).dispose();
      this.groundTilesMesh = null;
    }

    // Flush full-width tile geometry to completely eliminate white grid lines/gaps in 2D scan view
    const tileGeo = new THREE.BoxGeometry(BLOCK_SIZE * 1.002, BLOCK_SIZE * 0.4, BLOCK_SIZE * 1.002);
    const tileMat = new THREE.MeshBasicMaterial();

    this.groundTilesMesh = new THREE.InstancedMesh(tileGeo, tileMat, groundBlocks.length);
    this.groundPositions = [];

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < groundBlocks.length; i++) {
      const b = groundBlocks[i];
      this.groundPositions.push(b);
      matrix.setPosition(b.x, b.y + BLOCK_SIZE * 0.2, b.z);
      this.groundTilesMesh.setMatrixAt(i, matrix);

      this.getGroundTileColorWithProgress(b, color, this.currentProgress);
      this.groundTilesMesh.setColorAt(i, color);
    }
    this.groundTilesMesh.instanceMatrix.needsUpdate = true;
    if (this.groundTilesMesh.instanceColor) this.groundTilesMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.groundTilesMesh);

    // 2b. Ground Fallen Leaves / Petals (Natural Clustered & Overlapping Organic Layout)
    if (this.groundFallenLeavesMesh) {
      this.scene.remove(this.groundFallenLeavesMesh);
      this.groundFallenLeavesMesh.geometry.dispose();
      (this.groundFallenLeavesMesh.material as THREE.Material).dispose();
      this.groundFallenLeavesMesh = null;
    }

    const groundLeafCount = envConfig.groundLeafCount ?? 0;
    if (groundLeafCount > 0) {
      const maxRadius = gridSize * 0.45 * BLOCK_SIZE;
      const minRadius = BLOCK_SIZE * 0.85; // Base of trunk

      const leafInstances: { x: number; y: number; z: number; rotY: number; scale: number; seed: number }[] = [];

      // Organic cluster centers around the trunk base (5-7 clusters)
      const numClusters = Math.max(4, Math.round(groundLeafCount * 0.35));
      let spawned = 0;

      for (let c = 0; c < numClusters && spawned < groundLeafCount; c++) {
        const cAngle = (c / numClusters) * Math.PI * 2 + Math.sin(c * 17.31 + 2.5) * 0.55;
        // Concentrated near trunk base spreading outward
        const rNorm = 0.15 + 0.70 * ((Math.sin(c * 23.47 + 5.1) * 0.5 + 0.5) ** 1.3);
        const cRadius = minRadius + (maxRadius - minRadius) * rNorm;

        const cx = Math.cos(cAngle) * cRadius;
        const cz = Math.sin(cAngle) * cRadius;

        // Cluster size: 2 to 3 overlapping petals
        const clusterSize = Math.min(
          groundLeafCount - spawned,
          c % 2 === 0 ? 3 : 2
        );

        for (let k = 0; k < clusterSize; k++) {
          const offAngle = k * 2.1 + c * 1.3;
          const offDist = k === 0 ? 0 : BLOCK_SIZE * (0.22 + 0.28 * ((Math.sin(c * 31.7 + k * 19.3) * 0.5 + 0.5)));
          const offX = Math.cos(offAngle) * offDist;
          const offZ = Math.sin(offAngle) * offDist;

          const rotSeed = Math.sin(c * 53.71 + k * 73.19 + (this.season + 1) * 19.31) * 43758.5453;
          const normRot = rotSeed - Math.floor(rotSeed);

          const scaleSeed = Math.sin(c * 91.37 + k * 29.47 + (this.season + 1) * 41.17) * 43758.5453;
          const normScale = scaleSeed - Math.floor(scaleSeed);

          leafInstances.push({
            x: cx + offX,
            y: BLOCK_SIZE * 0.52 + 0.0006 * k, // Sits cleanly on top of ground pavers (top is at BLOCK_SIZE * 0.5)
            z: cz + offZ,
            rotY: normRot * Math.PI * 2,
            scale: BLOCK_SIZE * (0.45 + normScale * 0.12), // Aligned 1:1 with tree canopy leaves and falling leaves
            seed: normRot,
          });
          spawned++;
        }
      }

      // Fill remaining with single stray petals drifting slightly further out
      while (spawned < groundLeafCount) {
        const s = spawned;
        const sAngle = (s * 2.39996) + Math.sin(s * 13.91) * 0.4;
        const sRadius = minRadius + (maxRadius - minRadius) * (0.20 + 0.75 * ((s / groundLeafCount)));

        const rotSeed = Math.sin(s * 71.39 + 13.51) * 43758.5453;
        const normRot = rotSeed - Math.floor(rotSeed);
        const scaleSeed = Math.sin(s * 83.17 + 27.91) * 43758.5453;
        const normScale = scaleSeed - Math.floor(scaleSeed);

        leafInstances.push({
          x: Math.cos(sAngle) * sRadius,
          y: BLOCK_SIZE * 0.52 + 0.0003 * (s % 4),
          z: Math.sin(sAngle) * sRadius,
          rotY: normRot * Math.PI * 2,
          scale: BLOCK_SIZE * (0.44 + normScale * 0.10), // Consistent petite scale matching tree leaves
          seed: normRot,
        });
        spawned++;
      }

      // Flat 2D ground leaves
      let leafGeo: THREE.BufferGeometry;
      const isBlossomPetal = this.activeCustomTheme
        ? (this.activeCustomTheme.foliageShape === 'blossom' || this.activeCustomTheme.particleType === 'sakura')
        : (this.season === 0 || envConfig.fallingLeafType === 'sakura');

      if (isBlossomPetal) {
        leafGeo = createFlatGroundPetalGeometry(1.0, new THREE.Color(0.88, 0.88, 0.88), new THREE.Color(1.12, 1.12, 1.12), new THREE.Color(0.80, 0.80, 0.80));
      } else {
        leafGeo = createFlatGroundLeafGeometry(1.0, new THREE.Color(0.88, 0.88, 0.88), new THREE.Color(1.12, 1.12, 1.12));
      }

      const leafMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      this.groundFallenLeavesMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafInstances.length);
      const leafMatrix = new THREE.Matrix4();
      const leafQuat = new THREE.Quaternion();
      const leafScale = new THREE.Vector3();
      const leafColor = new THREE.Color();

      for (let i = 0; i < leafInstances.length; i++) {
        const inst = leafInstances[i];
        // Flat 2D geometry already in XZ plane — subtle random tilt
        const tiltX = (inst.seed - 0.5) * 0.12;
        const tiltZ = (((inst.seed * 7.31) % 1) - 0.5) * 0.10;
        const euler = new THREE.Euler(tiltX, inst.rotY, tiltZ);
        leafQuat.setFromEuler(euler);
        leafScale.setScalar(inst.scale);
        leafMatrix.compose(new THREE.Vector3(inst.x, inst.y, inst.z), leafQuat, leafScale);
        this.groundFallenLeavesMesh.setMatrixAt(i, leafMatrix);

        const colNorm = Math.round((inst.x / (gridSize * BLOCK_SIZE) + 0.5) * gridSize);
        const rowNorm = Math.round((inst.z / (gridSize * BLOCK_SIZE) + 0.5) * gridSize);
        this.getFoliageHarmonicColor(inst.seed, colNorm, rowNorm, leafColor, 0.0);
        this.groundFallenLeavesMesh.setColorAt(i, leafColor);
      }
      this.groundFallenLeavesMesh.instanceMatrix.needsUpdate = true;
      if (this.groundFallenLeavesMesh.instanceColor) this.groundFallenLeavesMesh.instanceColor.needsUpdate = true;
      this.scene.add(this.groundFallenLeavesMesh);
    }

    // 3. 3D Voxel Cubes for Morphing (: )
    if (this.morphVoxelMesh) {
      this.scene.remove(this.morphVoxelMesh);
      this.morphVoxelMesh.geometry.dispose();
      (this.morphVoxelMesh.material as THREE.Material).dispose();
      this.morphVoxelMesh = null;
    }

    this.morphBlocks = this.treeData.blocks.filter((b) => b.y > 0);
    if (this.morphBlocks.length > 0) {
      const voxelGeo = new THREE.BoxGeometry(BLOCK_SIZE * 0.96, BLOCK_SIZE * 0.96, BLOCK_SIZE * 0.96);
      const voxelMat = new THREE.MeshBasicMaterial();
      this.morphVoxelMesh = new THREE.InstancedMesh(voxelGeo, voxelMat, this.morphBlocks.length);

      for (let i = 0; i < this.morphBlocks.length; i++) {
        const b = this.morphBlocks[i];
        matrix.setPosition(b.x, b.y, b.z);
        this.morphVoxelMesh.setMatrixAt(i, matrix);

        if (b.type === TreeBlockType.Trunk) {
          color.setRGB(0.38, 0.22, 0.12);
        } else {
          this.getFoliageQRColor(b, color);
        }
        this.morphVoxelMesh.setColorAt(i, color);
      }
      this.morphVoxelMesh.instanceMatrix.needsUpdate = true;
      if (this.morphVoxelMesh.instanceColor) this.morphVoxelMesh.instanceColor.needsUpdate = true;
      this.morphVoxelMesh.visible = false;
      this.scene.add(this.morphVoxelMesh);
    }

    // 4. 3D Bonsai Trunk & Branch Hierarchy with Multi-Tonal Textured Bark
    while (this.branchesGroup.children.length > 0) {
      const obj = this.branchesGroup.children[0] as THREE.Mesh;
      this.branchesGroup.remove(obj);
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }

    const branchMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    const isWinter = this.season === 3;
    for (const b of this.treeData.branches) {
      const start = new THREE.Vector3(b.startX, b.startY, b.startZ);
      const end = new THREE.Vector3(b.endX, b.endY, b.endZ);
      const length = start.distanceTo(end);
      if (length < 0.001) continue;

      const cylGeo = createOrganicBranchGeometry(
        b.endRadius * 1.15,
        b.startRadius * 1.15,
        length,
        b.depth,
        b.seed,
        isWinter
      );
      const cylMesh = new THREE.Mesh(cylGeo, branchMat);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      cylMesh.position.copy(mid);
      cylMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      this.branchesGroup.add(cylMesh);
    }

    // 5. Parameterized Canopy Foliage Density
    if (this.canopyFlowersMesh) {
      this.scene.remove(this.canopyFlowersMesh);
      this.canopyFlowersMesh.geometry.dispose();
      (this.canopyFlowersMesh.material as THREE.Material).dispose();
      this.canopyFlowersMesh = null;
    }
    this.flowerBaseMatrices = new Float32Array(0);

    const flowerList: { x: number; y: number; z: number; normX: number; normZ: number; angle: number; scale: number; seed: number }[] = [];
    const densityRatio = Math.max(0.08, Math.min(1.0, envConfig.canopyDensity ?? 1.0));
    // Dynamic volumetric scaling: at 100% density, blossom clusters expand and overlap to create a dense, full crown
    const foliageScaleMultiplier = 0.50 + 0.60 * densityRatio;

    for (let idx = 0; idx < this.treeData.flowers.length; idx++) {
      const fl = this.treeData.flowers[idx];
      const normSeed = Math.abs(fl.seed) % 1.0;
      // Direct proportion filter: exactly densityRatio of flowers are retained
      if (normSeed <= densityRatio) {
        flowerList.push({
          x: fl.x,
          y: fl.y,
          z: fl.z,
          normX: fl.normalX,
          normZ: fl.normalZ,
          angle: fl.petalAngle,
          scale: fl.scale * foliageScaleMultiplier,
          seed: normSeed,
        });
      }
    }

    this.flowerBaseData = flowerList;
    const isBlossom = this.activeCustomTheme
      ? (this.activeCustomTheme.foliageShape === 'blossom' || this.activeCustomTheme.particleType === 'sakura')
      : (this.season === 0 || this.season === 3);

    const flowerGeo = isBlossom
      ? (this.season === 0 || (this.activeCustomTheme && this.activeCustomTheme.foliageShape === 'blossom')
          ? createBlossomFlowerGeometry(1.0, new THREE.Color(0.92, 0.92, 0.92), new THREE.Color(1.08, 1.08, 1.08), new THREE.Color(247 / 255, 234 / 255, 94 / 255))
          : createBlossomFlowerGeometry(1.0, new THREE.Color(0.86, 0.86, 0.86), new THREE.Color(1.14, 1.14, 1.14), new THREE.Color(0.78, 0.78, 0.78)))
      : createLeafGeometry(1.0, new THREE.Color(0.85, 0.85, 0.85), new THREE.Color(1.15, 1.15, 1.15));

    const flowerMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
    });

    this.canopyFlowersMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerList.length);
    this.canopyFlowersMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const fMatrix = new THREE.Matrix4();
    const fQuat = new THREE.Quaternion();
    const fEuler = new THREE.Euler();
    const fScale = new THREE.Vector3();
    const fColor = new THREE.Color();

    for (let i = 0; i < flowerList.length; i++) {
      const fl = flowerList[i];
      fEuler.set(fl.normX, fl.angle, fl.normZ);
      fQuat.setFromEuler(fEuler);
      fScale.set(fl.scale, fl.scale, fl.scale);
      fMatrix.compose(new THREE.Vector3(fl.x, fl.y, fl.z), fQuat, fScale);
      this.canopyFlowersMesh.setMatrixAt(i, fMatrix);

      // Multi-tonal variegated per-instance color for 3D canopy leaves!
      const colNorm = Math.round((fl.x / (gridSize * BLOCK_SIZE) + 0.5) * gridSize);
      const rowNorm = Math.round((fl.z / (gridSize * BLOCK_SIZE) + 0.5) * gridSize);
      this.getFoliageHarmonicColor(fl.seed, colNorm, rowNorm, fColor, fl.y / 0.45);
      this.canopyFlowersMesh.setColorAt(i, fColor);
    }
    this.canopyFlowersMesh.instanceMatrix.needsUpdate = true;
    this.flowerBaseMatrices = new Float32Array(
      this.canopyFlowersMesh.instanceMatrix.array
    );
    if (this.canopyFlowersMesh.instanceColor) this.canopyFlowersMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.canopyFlowersMesh);

    // 6. Distinct Ground Decor (Grass, Snowdrifts , or Clean) on 4 Corners
    if (this.grassMesh) {
      this.scene.remove(this.grassMesh);
      this.grassMesh.geometry.dispose();
      (this.grassMesh.material as THREE.Material).dispose();
      this.grassMesh = null;
    }

    const isSnowGround = this.activeCustomTheme
      ? this.activeCustomTheme.groundFeature === 'snow'
      : this.season === 3;
    const isNoGround = this.activeCustomTheme?.groundFeature === 'none';

    const grassCount = this.treeData.grass.length;
    if (grassCount > 0 && !isNoGround) {
      let decorGeo: THREE.BufferGeometry;
      if (isSnowGround) {
        decorGeo = createSnowdriftsGeometry();
      } else {
        const bladeGeo = new THREE.BufferGeometry();
        const w = 0.0042;
        const h = 0.052;
        const verts = new Float32Array([
          -w, 0, 0,
           w, 0, 0,
           0, h, -w * 1.2,
        ]);
        const norms = new Float32Array([
          0, 0.4, 0.9,
          0, 0.4, 0.9,
          0, 0.8, -0.6,
        ]);
        const colors = new Float32Array([
          0.78, 0.78, 0.78,
          0.78, 0.78, 0.78,
          1.15, 1.15, 1.15,
        ]);
        bladeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        bladeGeo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
        bladeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        decorGeo = bladeGeo;
      }

      const decorMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      this.grassMesh = new THREE.InstancedMesh(decorGeo, decorMat, grassCount);
      this.grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const gMatrix = new THREE.Matrix4();
      const gQuat = new THREE.Quaternion();
      const gEuler = new THREE.Euler();
      const gScale = new THREE.Vector3();
      const gColor = new THREE.Color();

      const baseH = 0.052;

      for (let i = 0; i < grassCount; i++) {
        const g = this.treeData.grass[i];
        if (isSnowGround) {
          // Soft rounded snowdrifts pillowed over the 4 ground corners
          gEuler.set(0, g.seed * Math.PI * 2, 0);
          gQuat.setFromEuler(gEuler);
          const s = 0.85 + 0.55 * ((g.seed * 31.7) % 1);
          gScale.set(s, s * 0.85, s);
          gMatrix.compose(new THREE.Vector3(g.x, 0.005, g.z), gQuat, gScale);
        } else {
          // Upright natural grass blade
          gEuler.set(g.tilt, g.seed * Math.PI * 2, 0);
          gQuat.setFromEuler(gEuler);
          const s = g.height / baseH;
          gScale.set(1, s, 1);
          gMatrix.compose(new THREE.Vector3(g.x, g.y, g.z), gQuat, gScale);
        }
        this.grassMesh.setMatrixAt(i, gMatrix);

        this.getGrassBladeColor(g.seed, i, gColor);
        this.grassMesh.setColorAt(i, gColor);
      }
      this.grassMesh.instanceMatrix.needsUpdate = true;
      if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
      this.scene.add(this.grassMesh);
    }

    // 7. Parameterized Airborne Falling Particles (Dynamic pool supporting up to 500+ particles)
    if (this.petalsInstancedMesh) {
      this.scene.remove(this.petalsInstancedMesh);
      this.petalsInstancedMesh.geometry.dispose();
      (this.petalsInstancedMesh.material as THREE.Material).dispose();
      this.petalsInstancedMesh = null;
    }

    const pCount = envConfig.fallingLeavesCount;
    this.fallingLeavesData = [];

    if (pCount > 0) {
      let petalGeo: THREE.BufferGeometry;
      const isBlossomPetal = this.activeCustomTheme
        ? (this.activeCustomTheme.foliageShape === 'blossom' || this.activeCustomTheme.particleType === 'sakura')
        : (this.season === 0 || envConfig.fallingLeafType === 'sakura');

      if (isBlossomPetal) {
        petalGeo = createBlossomFlowerGeometry(1.0, new THREE.Color(0.86, 0.86, 0.86), new THREE.Color(1.14, 1.14, 1.14), new THREE.Color(0.78, 0.78, 0.78));
      } else {
        petalGeo = createLeafGeometry(1.0, new THREE.Color(0.85, 0.85, 0.85), new THREE.Color(1.15, 1.15, 1.15));
      }

      const petalMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      this.petalsInstancedMesh = new THREE.InstancedMesh(petalGeo, petalMat, pCount);
      this.petalsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const pColor = new THREE.Color();

      const canopyMaxR = gridSize * 0.40 * BLOCK_SIZE;
      for (let i = 0; i < pCount; i++) {
        const angle = (i * 2.39996) + Math.sin(i * 91.1) * 0.45;
        const rad = Math.sqrt((i + 0.5) / pCount) * canopyMaxR + (Math.sin(i * 33.7) * 0.025);
        const x = Math.cos(angle) * rad;
        const z = Math.sin(angle) * rad;
        const normScale = Math.sin(i * 19.9) * 0.5 + 0.5;
        const speed = 0.045 + 0.035 * (Math.sin(i * 71.3) * 0.5 + 0.5);
        const phaseOffset = ((i * 137.5) % 1000) / 1000;

        this.fallingLeavesData.push({
          x,
          y: 0,
          z,
          speed,
          swayFreq: 1.8 + 0.8 * (Math.sin(i * 43.1) * 0.5 + 0.5),
          driftFreq: 1.4 + 0.6 * (Math.cos(i * 57.7) * 0.5 + 0.5),
          rotSpeed: 1.5 + 2.0 * (Math.sin(i * 29.3) * 0.5 + 0.5),
          seed: i * 0.137,
          scale: BLOCK_SIZE * (0.42 + 0.18 * normScale), // Petite & delicate, exactly matching the leaves and petals on the tree
          phaseOffset,
        });

        this.getFoliageHarmonicColor(i * 0.137, Math.round(i * 1.7), Math.round(i * 2.3), pColor, 0.5);
        this.petalsInstancedMesh.setColorAt(i, pColor);
      }
      if (this.petalsInstancedMesh.instanceColor) this.petalsInstancedMesh.instanceColor.needsUpdate = true;
      this.scene.add(this.petalsInstancedMesh);
    }

    // 8. Summer Rain Drizzle Mesh
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.geometry.dispose();
      (this.rainMesh.material as THREE.Material).dispose();
      this.rainMesh = null;
    }

    if (!this.activeCustomTheme && this.season === 1) {
      const rainGeo = createRainStreakGeometry();
      const rainMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, this.rainData.length);
      this.rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.rainMesh);
    }

    // 9. Winter Snowflakes Mesh (300 floating 3D Snow Crystals - !)
    if (this.snowMesh) {
      this.scene.remove(this.snowMesh);
      this.snowMesh.geometry.dispose();
      (this.snowMesh.material as THREE.Material).dispose();
      this.snowMesh = null;
    }

    if (envConfig.snowflakesCount > 0) {
      const snowGeo = createSnowflakeGeometry(1.0);
      const snowMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        depthTest: true,
      });
      this.snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, envConfig.snowflakesCount);
      this.snowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.snowMesh);
    }

    // 10. Enhanced Parameterized Multi-Species Butterflies with Cursor Attraction
    while (this.butterfliesGroup.children.length > 0) {
      const b = this.butterfliesGroup.children[0] as THREE.Object3D;
      this.butterfliesGroup.remove(b);
      disposeObjectResources(b);
    }
    this.butterflies = [];

    const butterflyCount = envConfig.butterflyCount;
    if (butterflyCount > 0) {
      for (let i = 0; i < butterflyCount; i++) {
        const species = i % 4; // 0: Morpho Blue, 1: Monarch Orange, 2: Emerald Swallowtail, 3: Pink Pearl
        const wingGeo = createButterflyWingGeometry(species);
        const wingMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          depthTest: true,
        });

        const bGroup = new THREE.Group();
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.scale.set(-1, 1, 1);

        // Subtle tiny dark body segment
        const bodyGeo = new THREE.CylinderGeometry(0.0016, 0.0012, 0.014, 4);
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1e1b18 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.rotation.x = Math.PI / 2;
        bGroup.add(bodyMesh);

        bGroup.add(leftWing);
        bGroup.add(rightWing);

        const phase = (i / butterflyCount) * Math.PI * 2;
        const orbitRadius = 0.26 + (i % 4) * 0.08 + (Math.sin(i * 3.7) * 0.04);
        const height = 0.22 + (i % 5) * 0.06;
        const currentPos = new THREE.Vector3(
          Math.sin(phase) * orbitRadius,
          height,
          Math.cos(phase) * orbitRadius
        );

        bGroup.position.copy(currentPos);
        const bScale = 0.85 + (i % 3) * 0.15;
        bGroup.scale.set(bScale, bScale, bScale);
        this.butterfliesGroup.add(bGroup);

        this.butterflies.push({
          mesh: bGroup,
          leftWing,
          rightWing,
          currentPos,
          velocity: new THREE.Vector3(),
          orbitRadius,
          orbitSpeed: 0.25 + (i % 4) * 0.08,
          phase,
          height,
          species,
          seed: (i * 1.37) % 1.0,
          flapSpeed: 14.0 + (i % 3) * 4.0,
          scale: bScale,
        });
      }
    }
  }

  // Multi-octave spatial clustering noise for organic watercolor mosaic shading
  private getModuleClusterNoise(col: number, row: number, seed: number = 0): number {
    const s1 = Math.sin(col * 0.78 + row * 0.52 + seed * 1.37) * 43758.5453;
    const n1 = s1 - Math.floor(s1);
    const s2 = Math.sin(col * 1.45 - row * 1.15 + seed * 3.19) * 23421.6312;
    const n2 = s2 - Math.floor(s2);
    const s3 = Math.sin(col * 0.33 + row * 0.41 + seed * 7.81) * 12345.6789;
    const n3 = s3 - Math.floor(s3);
    return n1 * 0.50 + n2 * 0.30 + n3 * 0.20;
  }

  // Unified Multi-Tone Variegated Foliage Color Architecture
  // App-wide unified generator for 3D canopy leaves, fallen leaves, falling particles, morphing cubes, and 2D QR tiles!
  private getFoliageHarmonicColor(
    seed: number,
    col: number,
    row: number,
    target: THREE.Color,
    yRatio: number = 0.5
  ) {
    const s1 = Math.sin(col * 1.78 + row * 2.52 + seed * 3.37) * 43758.5453;
    const n1 = s1 - Math.floor(s1);
    const s2 = Math.sin(col * 0.45 - row * 0.85 + seed * 7.19) * 23421.6312;
    const n2 = s2 - Math.floor(s2);
    // Combine spatial cluster + seed for natural clustering and leaf-to-leaf variance
    const r = (n1 * 0.65 + n2 * 0.35 + seed * 0.20) % 1.0;
    const micro = (Math.sin(col * 19.3 + row * 37.1 + seed * 41.7) * 43758.5453 % 1 - 0.5) * 0.035;

    // 🎨 Custom Theme: Support full 4-color harmonic custom palette if provided
    if (this.activeCustomTheme?.foliageHighlightColor || this.activeCustomTheme?.foliageShadowColor) {
      const cShadow = hexToRgbTuple(this.activeCustomTheme.foliageShadowColor || this.activeCustomTheme.foliageColor);
      const cMain = hexToRgbTuple(this.activeCustomTheme.foliageColor);
      const cMid = hexToRgbTuple(this.activeCustomTheme.foliageMidtoneColor || this.activeCustomTheme.foliageColor);
      const cHigh = hexToRgbTuple(this.activeCustomTheme.foliageHighlightColor || this.activeCustomTheme.foliageColor);

      if (r < 0.22) {
        target.setRGB(cShadow[0] + micro * 0.15, cShadow[1] + micro * 0.15, cShadow[2] + micro * 0.15);
      } else if (r < 0.55) {
        target.setRGB(cMain[0] + micro * 0.15, cMain[1] + micro * 0.15, cMain[2] + micro * 0.15);
      } else if (r < 0.82) {
        target.setRGB(cMid[0] + micro * 0.15, cMid[1] + micro * 0.15, cMid[2] + micro * 0.15);
      } else {
        target.setRGB(cHigh[0] + micro * 0.15, cHigh[1] + micro * 0.15, cHigh[2] + micro * 0.15);
      }
      return;
    }

    const customHex = this.activeCustomTheme?.foliageColor?.toLowerCase();

    if (customHex === '#f4b4cf' || (this.season === 0 && this.customStrength <= 0.01)) {
      // 🌸 Spring Swatch Palette: Hanagoromo + Yae-Beni-Shidare + Somei-Yoshino + Hanaakari
      if (r < 0.35) {
        target.setRGB(217 / 255 + micro * 0.15, 142 / 255 + micro * 0.15, 176 / 255 + micro * 0.15);
      } else if (r < 0.70) {
        target.setRGB(244 / 255 + micro * 0.15, 180 / 255 + micro * 0.15, 208 / 255 + micro * 0.15);
      } else if (r < 0.92) {
        target.setRGB(249 / 255 + micro * 0.15, 211 / 255 + micro * 0.15, 227 / 255 + micro * 0.15);
      } else {
        target.setRGB(253 / 255, 239 / 255, 245 / 255);
      }
      return;
    } else if (customHex === '#02983b' || customHex === '#00ac7a' || customHex === '#40ad5a' || (this.season === 1 && this.customStrength <= 0.01)) {
      // ☀️ Summer Traditional Japanese Palette (033 立夏 萬葉集綠意配色)
      // ④ 翠玉 (#02983B) + ⑤ 若苗色 (#99CC81) + ③ 深綠 (#00785E) + ① 青竹色 (#00AC7A)
      if (r < 0.28) {
        // ③ 深綠 Deep Forest Canopy Shadow (grounding depth)
        target.setRGB(micro * 0.08, 121 / 255 + micro * 0.08, 95 / 255 + micro * 0.08);
      } else if (r < 0.65) {
        // ④ 翠玉 Soothing Rich Emerald Body
        target.setRGB(2 / 255 + micro * 0.08, 153 / 255 + micro * 0.08, 59 / 255 + micro * 0.08);
      } else if (r < 0.86) {
        // ① 青竹色 Fresh Bamboo Accent
        target.setRGB(micro * 0.08, 173 / 255 + micro * 0.08, 122 / 255 + micro * 0.08);
      } else {
        // ⑤ 若苗色 Tender Warm Sprout Tip (gentle natural warm green highlight)
        target.setRGB(154 / 255 + micro * 0.08, 204 / 255 + micro * 0.08, 130 / 255 + micro * 0.08);
      }
      return;
    } else if (customHex === '#e2451e' || customHex === '#d32f2f' || (this.season === 2 && this.customStrength <= 0.01)) {
      // 🍂 Autumn Traditional Japanese Palette (京都清水寺 楓葉配色)
      // ① 紅葉 (#E2451E: 226, 69, 31) + ② 楓 (#E77433: 231, 117, 52) + ③ 紅絹 (#BD3528: 189, 53, 41) + ④ 小春日和 (#F4A358: 244, 164, 88)
      if (r < 0.22) {
        // ③ 紅絹 Deep Crimson Shadow
        target.setRGB(189 / 255 + micro * 0.15, 53 / 255 + micro * 0.15, 41 / 255 + micro * 0.15);
      } else if (r < 0.55) {
        // ① 紅葉 Hero Flaming Red
        target.setRGB(226 / 255 + micro * 0.15, 69 / 255 + micro * 0.15, 31 / 255 + micro * 0.15);
      } else if (r < 0.82) {
        // ② 楓 Warm Maple Orange
        target.setRGB(231 / 255 + micro * 0.15, 117 / 255 + micro * 0.15, 52 / 255 + micro * 0.15);
      } else {
        // ④ 小春日和 Sunlit Golden Amber
        target.setRGB(244 / 255 + micro * 0.15, 164 / 255 + micro * 0.15, 88 / 255 + micro * 0.15);
      }
      return;
    } else if (customHex === '#d8e5f0' || (this.season === 3 && this.customStrength <= 0.01)) {
      // ❄️ Winter Frosted Crystal Palette
      if (r < 0.18) target.setRGB(0.38 + micro * 0.5, 0.52 + micro * 0.5, 0.65 + micro * 0.5);
      else if (r < 0.44) target.setRGB(0.55 + micro * 0.5, 0.68 + micro * 0.5, 0.82 + micro * 0.5);
      else if (r < 0.72) target.setRGB(0.74 + micro * 0.5, 0.84 + micro * 0.5, 0.94 + micro * 0.5);
      else if (r < 0.90) target.setRGB(0.96, 0.98 + micro * 0.5, 1.0);
      else target.setRGB(0.65 + micro * 0.5, 0.84 + micro * 0.5, 0.90 + micro * 0.5);
      return;
    }

    if (this.customStrength > 0.01) {
      const hsl = { h: 0, s: 0, l: 0 };
      this.customColor.getHSL(hsl);

      let hShift = 0;
      let sShift = 0;
      let lShift = 0;

      if (r < 0.16) {
        // Soft Gentle Shadow
        hShift = -0.008; sShift = 0.04; lShift = -0.09;
      } else if (r < 0.38) {
        // Rich Body
        hShift = -0.004; sShift = 0.02; lShift = -0.04;
      } else if (r < 0.62) {
        // Pure Midtone
        hShift = 0.0; sShift = 0.0; lShift = 0.01;
      } else if (r < 0.82) {
        // Soft Sunlit
        hShift = 0.008; sShift = -0.02; lShift = 0.06;
      } else if (r < 0.94) {
        // Luminous Highlight
        hShift = 0.014; sShift = -0.03; lShift = 0.10;
      } else {
        // Warm Accent
        hShift = 0.020; sShift = 0.03; lShift = 0.04;
      }

      const finalH = (hsl.h + hShift + 1.0) % 1.0;
      const finalS = Math.max(0.15, Math.min(1.0, hsl.s + sShift));
      const finalL = Math.max(0.12, Math.min(0.94, hsl.l + lShift + micro * 0.5 + (yRatio - 0.5) * 0.05));
      target.setHSL(finalH, finalS, finalL);
      return;
    }

    if (this.season === 0) {
      if (r < 0.35) {
        target.setRGB(217 / 255 + micro * 0.15, 142 / 255 + micro * 0.15, 176 / 255 + micro * 0.15);
      } else if (r < 0.70) {
        target.setRGB(244 / 255 + micro * 0.15, 180 / 255 + micro * 0.15, 208 / 255 + micro * 0.15);
      } else if (r < 0.92) {
        target.setRGB(249 / 255 + micro * 0.15, 211 / 255 + micro * 0.15, 227 / 255 + micro * 0.15);
      } else {
        target.setRGB(253 / 255, 239 / 255, 245 / 255);
      }
    } else if (this.season === 1) {
      if (r < 0.16) target.setRGB(0.18 + micro * 0.5, 0.48 + micro * 0.5, 0.20 + micro * 0.5);
      else if (r < 0.38) target.setRGB(0.28 + micro * 0.5, 0.62 + micro * 0.5, 0.22 + micro * 0.5);
      else if (r < 0.64) target.setRGB(0.42 + micro * 0.5, 0.74 + micro * 0.5, 0.20 + micro * 0.5);
      else if (r < 0.82) target.setRGB(0.58 + micro * 0.5, 0.82 + micro * 0.5, 0.18 + micro * 0.5);
      else if (r < 0.92) target.setRGB(0.74 + micro * 0.5, 0.86 + micro * 0.5, 0.20 + micro * 0.5);
      else target.setRGB(0.90 + micro * 0.5, 0.84 + micro * 0.5, 0.24);
    } else if (this.season === 2) {
      if (r < 0.22) {
        target.setRGB(189 / 255 + micro * 0.15, 53 / 255 + micro * 0.15, 41 / 255 + micro * 0.15);
      } else if (r < 0.55) {
        target.setRGB(226 / 255 + micro * 0.15, 69 / 255 + micro * 0.15, 31 / 255 + micro * 0.15);
      } else if (r < 0.82) {
        target.setRGB(231 / 255 + micro * 0.15, 117 / 255 + micro * 0.15, 52 / 255 + micro * 0.15);
      } else {
        target.setRGB(244 / 255 + micro * 0.15, 164 / 255 + micro * 0.15, 88 / 255 + micro * 0.15);
      }
    } else {
      if (r < 0.18) target.setRGB(0.38 + micro * 0.5, 0.52 + micro * 0.5, 0.65 + micro * 0.5);
      else if (r < 0.44) target.setRGB(0.55 + micro * 0.5, 0.68 + micro * 0.5, 0.82 + micro * 0.5);
      else if (r < 0.72) target.setRGB(0.74 + micro * 0.5, 0.84 + micro * 0.5, 0.94 + micro * 0.5);
      else if (r < 0.90) target.setRGB(0.96, 0.98 + micro * 0.5, 1.0);
      else target.setRGB(0.65 + micro * 0.5, 0.84 + micro * 0.5, 0.90 + micro * 0.5);
    }
  }

  // 1. Rich Multi-Tonal Foliage & Blossom Color Generator (Center Tree Canopy Dark Modules)
  private getFoliageQRColor(b: VoxelBlock, target: THREE.Color) {
    const customHex = this.activeCustomTheme?.foliageColor?.toLowerCase();
    const noise = this.getModuleClusterNoise(b.col, b.row, 4.2);
    const micro = (Math.sin(b.col * 17.3 + b.row * 31.7) * 43758.5453 % 1 - 0.5) * 0.03;

    // 🎨 Custom Theme: Support full 4-color harmonic custom palette if provided
    if (this.activeCustomTheme?.foliageHighlightColor || this.activeCustomTheme?.foliageShadowColor) {
      const cShadow = hexToRgbTuple(this.activeCustomTheme.foliageShadowColor || this.activeCustomTheme.foliageColor);
      const cMain = hexToRgbTuple(this.activeCustomTheme.foliageColor);
      const cMid = hexToRgbTuple(this.activeCustomTheme.foliageMidtoneColor || this.activeCustomTheme.foliageColor);
      const cHigh = hexToRgbTuple(this.activeCustomTheme.foliageHighlightColor || this.activeCustomTheme.foliageColor);

      if (noise < 0.22) target.setRGB(cShadow[0] + micro, cShadow[1] + micro, cShadow[2]);
      else if (noise < 0.52) target.setRGB(cMain[0] + micro, cMain[1] + micro, cMain[2]);
      else if (noise < 0.80) target.setRGB(cMid[0] + micro, cMid[1] + micro, cMid[2]);
      else target.setRGB(cHigh[0] + micro, cHigh[1] + micro, cHigh[2]);
      return;
    }

    if (customHex === '#f4b4cf' || (this.season === 0 && this.customStrength <= 0.01)) {
      if (noise < 0.22) {
        target.setRGB(0.55 + micro, 0.24 + micro, 0.35 + micro);
      } else if (noise < 0.48) {
        target.setRGB(0.66 + micro, 0.30 + micro, 0.40 + micro);
      } else if (noise < 0.78) {
        target.setRGB(0.74 + micro, 0.34 + micro, 0.48 + micro);
      } else {
        target.setRGB(0.82 + micro, 0.40 + micro, 0.54 + micro);
      }
      return;
    } else if (customHex === '#00ac7a' || customHex === '#40ad5a' || (this.season === 1 && this.customStrength <= 0.01)) {
      // ☀️ Summer (033 立夏): ③ 深綠 + ④ 翠玉 + ① 青竹色 + ② 薄綠
      if (noise < 0.22) target.setRGB(micro, 90 / 255 + micro, 70 / 255);
      else if (noise < 0.52) target.setRGB(micro, 121 / 255 + micro, 95 / 255);
      else if (noise < 0.80) target.setRGB(2 / 255 + micro, 153 / 255 + micro, 59 / 255);
      else target.setRGB(micro, 173 / 255 + micro, 122 / 255);
      return;
    } else if (customHex === '#e2451e' || customHex === '#d32f2f' || (this.season === 2 && this.customStrength <= 0.01)) {
      if (noise < 0.22) target.setRGB(140 / 255 + micro, 32 / 255 + micro, 22 / 255);
      else if (noise < 0.52) target.setRGB(189 / 255 + micro, 53 / 255 + micro, 41 / 255);
      else if (noise < 0.80) target.setRGB(226 / 255 + micro, 69 / 255 + micro, 31 / 255);
      else target.setRGB(231 / 255 + micro, 117 / 255 + micro, 52 / 255);
      return;
    } else if (customHex === '#d8e5f0' || (this.season === 3 && this.customStrength <= 0.01)) {
      if (noise < 0.22) target.setRGB(0.24 + micro, 0.40 + micro, 0.56 + micro);
      else if (noise < 0.56) target.setRGB(0.36 + micro, 0.52 + micro, 0.68 + micro);
      else if (noise < 0.82) target.setRGB(0.48 + micro, 0.64 + micro, 0.78 + micro);
      else target.setRGB(0.60 + micro, 0.74 + micro, 0.86 + micro);
      return;
    }

    if (this.customStrength > 0.01) {
      const hsl = { h: 0, s: 0, l: 0 };
      this.customColor.getHSL(hsl);
      const finalL = Math.max(0.18, Math.min(0.48, hsl.l * 0.70 + (noise - 0.5) * 0.12));
      target.setHSL(hsl.h, Math.min(1.0, hsl.s * 1.1), finalL);
      return;
    }

    if (this.season === 0) {
      if (noise < 0.22) {
        target.setRGB(0.55 + micro, 0.24 + micro, 0.35 + micro);
      } else if (noise < 0.48) {
        target.setRGB(0.66 + micro, 0.30 + micro, 0.40 + micro);
      } else if (noise < 0.78) {
        target.setRGB(0.74 + micro, 0.34 + micro, 0.48 + micro);
      } else {
        target.setRGB(0.82 + micro, 0.40 + micro, 0.54 + micro);
      }
    } else if (this.season === 1) {
      if (noise < 0.22) target.setRGB(micro, 90 / 255 + micro, 70 / 255);
      else if (noise < 0.52) target.setRGB(micro, 121 / 255 + micro, 95 / 255);
      else if (noise < 0.80) target.setRGB(2 / 255 + micro, 153 / 255 + micro, 59 / 255);
      else target.setRGB(micro, 173 / 255 + micro, 122 / 255);
    } else if (this.season === 2) {
      if (noise < 0.22) target.setRGB(140 / 255 + micro, 32 / 255 + micro, 22 / 255);
      else if (noise < 0.52) target.setRGB(189 / 255 + micro, 53 / 255 + micro, 41 / 255);
      else if (noise < 0.80) target.setRGB(226 / 255 + micro, 69 / 255 + micro, 31 / 255);
      else target.setRGB(231 / 255 + micro, 117 / 255 + micro, 52 / 255);
    } else {
      if (noise < 0.22) target.setRGB(0.24 + micro, 0.40 + micro, 0.56 + micro);
      else if (noise < 0.56) target.setRGB(0.36 + micro, 0.52 + micro, 0.68 + micro);
      else if (noise < 0.82) target.setRGB(0.48 + micro, 0.64 + micro, 0.78 + micro);
      else target.setRGB(0.60 + micro, 0.74 + micro, 0.86 + micro);
    }
  }

  // 2. Rich Multi-Tonal Lawn & Grass Finder Pattern Generator (4 Corners QR Eyes & Turf)
  private getGrassFinderColor(b: VoxelBlock, target: THREE.Color) {
    const gNoise = this.getModuleClusterNoise(b.col, b.row, 8.7);
    const micro = (Math.sin(b.col * 29.1 + b.row * 13.9) * 43758.5453 % 1 - 0.5) * 0.035;

    // Check if this module is in the center 3x3 eye of any finder pattern
    const gridSize = this.treeData ? this.treeData.gridSize : 29;
    const isTopLeftEye = b.row >= 2 && b.row <= 4 && b.col >= 2 && b.col <= 4;
    const isTopRightEye = b.row >= 2 && b.row <= 4 && b.col >= gridSize - 5 && b.col <= gridSize - 3;
    const isBottomLeftEye = b.row >= gridSize - 5 && b.row <= gridSize - 3 && b.col >= 2 && b.col <= 4;
    const isCenterEye = isTopLeftEye || isTopRightEye || isBottomLeftEye;

    if (this.activeCustomTheme?.groundFeatureColor) {
      const [cr, cg, cb] = hexToRgbTuple(this.activeCustomTheme.groundFeatureColor);
      if (isCenterEye) {
        target.setRGB(
          Math.max(0, cr * 0.70 + micro * 0.1),
          Math.max(0, cg * 0.70 + micro * 0.1),
          Math.max(0, cb * 0.70 + micro * 0.1)
        );
      } else if (gNoise < 0.35) {
        target.setRGB(
          Math.max(0, cr * 0.85 + micro * 0.1),
          Math.max(0, cg * 0.85 + micro * 0.1),
          Math.max(0, cb * 0.85 + micro * 0.1)
        );
      } else if (gNoise < 0.75) {
        target.setRGB(
          Math.min(1, Math.max(0, cr + micro * 0.1)),
          Math.min(1, Math.max(0, cg + micro * 0.1)),
          Math.min(1, Math.max(0, cb + micro * 0.1))
        );
      } else {
        target.setRGB(
          Math.min(1, cr * 1.15 + micro * 0.1),
          Math.min(1, cg * 1.15 + micro * 0.1),
          Math.min(1, cb * 1.15 + micro * 0.1)
        );
      }
      return;
    }

    if (this.season === 0) {
      // 🌸 Spring Swatch Finder Patterns: ③  + ④  + ⑤
      // Deep contrast for guaranteed camera scanner detection
      if (isCenterEye) {
        // ③  center eye deep anchor
        target.setRGB(0.20 + micro * 0.1, 0.48 + micro * 0.1, 0.14 + micro * 0.1);
      } else if (gNoise < 0.35) {
        // ③  outer border dark green
        target.setRGB(0.26 + micro * 0.1, 0.54 + micro * 0.1, 0.18 + micro * 0.1);
      } else if (gNoise < 0.75) {
        // ④  fresh spring yellow-green
        target.setRGB(0.38 + micro * 0.1, 0.62 + micro * 0.1, 0.22 + micro * 0.1);
      } else if (gNoise < 0.90) {
        // ③
        target.setRGB(0.28 + micro * 0.1, 0.56 + micro * 0.1, 0.18 + micro * 0.1);
      } else {
        // ⑤  warm golden sprout accent
        target.setRGB(0.58 + micro * 0.1, 0.64 + micro * 0.1, 0.18 + micro * 0.1);
      }
    } else if (this.season === 1) {
      // ☀️ Summer (033 立夏): ④ 翠玉 (#02983B) + ⑤ 若苗色 (#99CC81) + ⑨ 利休鼠 (#6B9277) + ⑦ 嬰兒 (#D7DE8A)
      if (isCenterEye) {
        // ④ 翠玉 Center Eye Emerald Anchor
        target.setRGB(2 / 255 + micro * 0.1, 153 / 255 + micro * 0.1, 59 / 255 + micro * 0.1);
      } else if (gNoise < 0.35) {
        // ⑨ 利休鼠 Outer Border Tea-Gray Green
        target.setRGB(108 / 255 + micro * 0.1, 147 / 255 + micro * 0.1, 119 / 255 + micro * 0.1);
      } else if (gNoise < 0.75) {
        // ⑤ 若苗色 Tender Sprout Lawn Green
        target.setRGB(154 / 255 + micro * 0.1, 204 / 255 + micro * 0.1, 130 / 255 + micro * 0.1);
      } else {
        // ⑦ 嬰兒 Warm Sprout Golden Highlight
        target.setRGB(216 / 255 + micro * 0.1, 222 / 255 + micro * 0.1, 138 / 255 + micro * 0.1);
      }
    } else if (this.season === 2) {
      // 🍂 Autumn: ⑨ 山眠 (#5D4C35) + ⑧ 冬草 (#9D8C73) + ⑤ 酒林 (#BD956E) + ④ 小春日和 (#F4A358)
      if (isCenterEye) {
        // ⑨ 山眠 Deep Antique Wood Dark Core
        target.setRGB(94 / 255 + micro * 0.1, 77 / 255 + micro * 0.1, 54 / 255 + micro * 0.1);
      } else if (gNoise < 0.35) {
        // ⑧ 冬草 Withered Autumn Grass
        target.setRGB(158 / 255 + micro * 0.1, 140 / 255 + micro * 0.1, 115 / 255 + micro * 0.1);
      } else if (gNoise < 0.75) {
        // ⑤ 酒林 Cedar Brown
        target.setRGB(190 / 255 + micro * 0.1, 150 / 255 + micro * 0.1, 110 / 255 + micro * 0.1);
      } else {
        // ④ 小春日和 Warm Golden Accent
        target.setRGB(244 / 255 + micro * 0.1, 164 / 255 + micro * 0.1, 88 / 255 + micro * 0.1);
      }
    } else {
      // ❄️ Winter:  (Frosted Slate + Deep Ice Shadow)
      if (isCenterEye) {
        target.setRGB(0.20 + micro, 0.32 + micro, 0.44 + micro);
      } else if (gNoise < 0.35) {
        target.setRGB(0.28 + micro, 0.42 + micro, 0.56 + micro);
      } else if (gNoise < 0.75) {
        target.setRGB(0.38 + micro, 0.52 + micro, 0.66 + micro);
      } else {
        target.setRGB(0.48 + micro, 0.62 + micro, 0.74 + micro);
      }
    }
  }

  // 3. Main Ground Tile Shader with Continuous Real-time 3D-to-2D Color Blending
  private getGroundTileColorWithProgress(
    b: VoxelBlock,
    target: THREE.Color,
    progress: number
  ) {
    const bgNoise = this.getModuleClusterNoise(b.col, b.row, 1.9);
    const tileJitter = (bgNoise - 0.5) * 0.04 * Math.max(0, 1.0 - progress);
    // Continuous responsive color masking curve (mask emerges right from the start of rotation)
    const ease = Math.min(1.0, Math.max(0.0, Math.pow(progress, 0.85)));

    // Light QR Module (TreeBlockType.Dirt):
    // In 3D (progress = 0): Custom ground stone paver or seasonal stone
    // In 2D Scan (progress = 1): Seamlessly blends into website atmosphere background
    if (b.type === TreeBlockType.Dirt) {
      let stone3D_R = 0.66 + tileJitter;
      let stone3D_G = 0.66 + tileJitter;
      let stone3D_B = 0.64 + tileJitter;

      if (this.activeCustomTheme) {
        const [cr, cg, cb] = hexToRgbTuple(this.activeCustomTheme.groundColor);
        const [sr, sg, sb] = this.activeCustomTheme.groundShadowColor
          ? hexToRgbTuple(this.activeCustomTheme.groundShadowColor)
          : [cr * 0.88, cg * 0.88, cb * 0.88];
        stone3D_R = sr * 0.95 + tileJitter * 0.3;
        stone3D_G = sg * 0.95 + tileJitter * 0.3;
        stone3D_B = sb * 0.95 + tileJitter * 0.3;
      } else if (this.season === 0) {
        // ①  (#F0CCBD: R241 G205 B189) warm peach-sand stone paver
        stone3D_R = (241 / 255) * 0.88 + tileJitter * 0.4;
        stone3D_G = (205 / 255) * 0.88 + tileJitter * 0.4;
        stone3D_B = (189 / 255) * 0.88 + tileJitter * 0.4;
      } else if (this.season === 1) {
        // ⑧ 素鼠 (#8A987C: R139 G153 B124) Neutral Slate Stone Paver
        stone3D_R = (139 / 255) * 0.95 + tileJitter * 0.4;
        stone3D_G = (153 / 255) * 0.95 + tileJitter * 0.4;
        stone3D_B = (124 / 255) * 0.95 + tileJitter * 0.4;
      } else if (this.season === 2) {
        // ⑦ 檜舞台 (#C6AE8D: R198 G175 B142) Cypress Stage Warm Paver
        stone3D_R = (198 / 255) * 0.90 + tileJitter * 0.4;
        stone3D_G = (175 / 255) * 0.90 + tileJitter * 0.4;
        stone3D_B = (142 / 255) * 0.90 + tileJitter * 0.4;
      }

      let target2D_R = 0.98;
      let target2D_G = 0.95;
      let target2D_B = 0.965;

      if (this.activeCustomTheme) {
        const [cr, cg, cb] = hexToRgbTuple(this.activeCustomTheme.groundColor);
        target2D_R = cr;
        target2D_G = cg;
        target2D_B = cb;
      } else if (this.season === 3) {
        target2D_R = 0.96; target2D_G = 0.97; target2D_B = 0.985;
      } else if (this.season === 2) {
        // ⑥ 初雪 (#F8F0EC: R248 G240 B236) First Snow Warm Off-White Canvas
        target2D_R = 248 / 255; target2D_G = 240 / 255; target2D_B = 236 / 255;
      } else if (this.season === 1) {
        // ⑥ 花水木 (#F6F4D7: R246 G244 B216) Soft Sunlight Canvas
        target2D_R = 246 / 255; target2D_G = 244 / 255; target2D_B = 216 / 255;
      } else {
        // ①  (Irone #F0CCBD: R241 G205 B189)
        target2D_R = 241 / 255; target2D_G = 205 / 255; target2D_B = 189 / 255;
      }

      target.setRGB(
        stone3D_R + (target2D_R - stone3D_R) * ease,
        stone3D_G + (target2D_G - stone3D_G) * ease,
        stone3D_B + (target2D_B - stone3D_B) * ease
      );
      return;
    }

    // Corner Dark QR Modules (TreeBlockType.Grass / Finder Patterns 4)
    if (b.type === TreeBlockType.Grass) {
      // In 3D (progress = 0): Deep stone gray paver matching the courtyard stone floor
      // In 2D Scan (progress = 1): Rich multi-tonal lawn & grass finder color
      const stoneNoise = this.getModuleClusterNoise(b.col, b.row, 6.1);
      let grayR = 0.52 + (stoneNoise - 0.5) * 0.05;
      let grayG = 0.52 + (stoneNoise - 0.5) * 0.05;
      let grayB = 0.50 + (stoneNoise - 0.5) * 0.05;

      if (this.activeCustomTheme) {
        const [cr, cg, cb] = this.activeCustomTheme.groundShadowColor
          ? hexToRgbTuple(this.activeCustomTheme.groundShadowColor)
          : hexToRgbTuple(this.activeCustomTheme.groundColor).map(v => v * 0.68) as [number, number, number];
        grayR = cr * 0.85 + (stoneNoise - 0.5) * 0.04;
        grayG = cg * 0.85 + (stoneNoise - 0.5) * 0.04;
        grayB = cb * 0.85 + (stoneNoise - 0.5) * 0.04;
      } else if (this.season === 0) {
        // ②  (#C38F95: R195 G144 B150) & ③   warm rose-plum shadow paver
        grayR = (195 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
        grayG = (144 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
        grayB = (150 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      } else if (this.season === 1) {
        // ⑨ 利休鼠 (#6B9277) & ⑧ 素鼠 (#8A987C)
        grayR = (108 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
        grayG = (147 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
        grayB = (119 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
      } else if (this.season === 2) {
        // ⑨ 山眠 (#5D4C35) & ⑧ 冬草 (#9D8C73)
        grayR = (158 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
        grayG = (140 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
        grayB = (115 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      }

      const grassColor = new THREE.Color();
      this.getGrassFinderColor(b, grassColor);

      target.setRGB(
        grayR + (grassColor.r - grayR) * ease,
        grayG + (grassColor.g - grayG) * ease,
        grayB + (grassColor.b - grayB) * ease
      );
      return;
    }

    // Dark QR modules under tree canopy (TreeBlockType.FallenPetals):
    // In 3D (progress = 0): Deep slate stone gray paver with natural texture
    // In 2D Scan (progress = 1): Rich multi-tonal watercolor blossom/foliage color
    const stoneNoise = this.getModuleClusterNoise(b.col, b.row, 6.1);
    let grayR = 0.52 + (stoneNoise - 0.5) * 0.05;
    let grayG = 0.52 + (stoneNoise - 0.5) * 0.05;
    let grayB = 0.50 + (stoneNoise - 0.5) * 0.05;

    if (this.activeCustomTheme) {
      const [cr, cg, cb] = this.activeCustomTheme.groundShadowColor
        ? hexToRgbTuple(this.activeCustomTheme.groundShadowColor)
        : hexToRgbTuple(this.activeCustomTheme.groundColor).map(v => v * 0.68) as [number, number, number];
      grayR = cr * 0.85 + (stoneNoise - 0.5) * 0.04;
      grayG = cg * 0.85 + (stoneNoise - 0.5) * 0.04;
      grayB = cb * 0.85 + (stoneNoise - 0.5) * 0.04;
    } else if (this.season === 0) {
      // ②  (#C38F95: R195 G144 B150) & ③   warm rose-plum shadow paver
      grayR = (195 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      grayG = (144 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      grayB = (150 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
    } else if (this.season === 1) {
      // ⑨ 利休鼠 (#6B9277) & ⑧ 素鼠 (#8A987C)
      grayR = (108 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
      grayG = (147 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
      grayB = (119 / 255) * 0.85 + (stoneNoise - 0.5) * 0.04;
    } else if (this.season === 2) {
      // ⑨ 山眠 (#5D4C35) & ⑧ 冬草 (#9D8C73)
      grayR = (158 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      grayG = (140 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
      grayB = (115 / 255) * 0.82 + (stoneNoise - 0.5) * 0.04;
    }

    const qrColor = new THREE.Color();
    this.getFoliageQRColor(b, qrColor);

    // Seamlessly interpolate color from natural stone gray into rich watercolor QR mosaic
    target.setRGB(
      grayR + (qrColor.r - grayR) * ease,
      grayG + (qrColor.g - grayR) * ease,
      grayB + (qrColor.b - grayB) * ease
    );
  }

  private getGrassBladeColor(seed: number, index: number, target: THREE.Color) {
    const hash = Math.sin(seed * 43.17 + index * 19.31) * 43758.5453;
    const r = hash - Math.floor(hash);
    const micro = (Math.sin(seed * 11.7 + index * 3.3) * 43758.5453 % 1 - 0.5) * 0.04;

    if (this.activeCustomTheme?.groundFeatureColor) {
      const cLawn = hexToRgbTuple(this.activeCustomTheme.groundFeatureColor);
      const cTip = hexToRgbTuple(this.activeCustomTheme.groundFeatureHighlightColor || this.activeCustomTheme.groundFeatureColor);
      const cShadow = hexToRgbTuple(this.activeCustomTheme.groundFeatureShadowColor || this.activeCustomTheme.groundFeatureColor);

      if (r < 0.35) {
        target.setRGB(
          Math.max(0, Math.min(1, cShadow[0] + micro)),
          Math.max(0, Math.min(1, cShadow[1] + micro)),
          Math.max(0, Math.min(1, cShadow[2] + micro))
        );
      } else if (r < 0.75) {
        target.setRGB(
          Math.max(0, Math.min(1, cLawn[0] + micro)),
          Math.max(0, Math.min(1, cLawn[1] + micro)),
          Math.max(0, Math.min(1, cLawn[2] + micro))
        );
      } else {
        target.setRGB(
          Math.max(0, Math.min(1, cTip[0] + micro)),
          Math.max(0, Math.min(1, cTip[1] + micro)),
          Math.max(0, Math.min(1, cTip[2] + micro))
        );
      }
      return;
    }

    if (this.season === 0) {
      // 🌸 Spring 3D Grass: ③  + ④  + ⑤  + ①
      if (r < 0.42) {
        // ③  Fresh Meadow Green
        target.setRGB(134 / 255 + micro, 182 / 255 + micro, 104 / 255 + micro);
      } else if (r < 0.72) {
        // ④  Tender Sprout Yellow-Green
        target.setRGB(192 / 255 + micro, 213 / 255 + micro, 123 / 255 + micro);
      } else if (r < 0.88) {
        // ⑤  Golden Pistil Wildflower Accent
        target.setRGB(247 / 255, 234 / 255, 94 / 255);
      } else {
        // ①  Hanagumori Ambient Tone
        target.setRGB(208 / 255, 212 / 255, 227 / 255);
      }
    } else if (this.season === 1) {
      // ☀️ Summer:  +  +  +
      if (r < 0.40) {
        // Rich Emerald Meadow Green
        target.setRGB(0.12 + (r / 0.40) * 0.08, 0.62 + (r / 0.40) * 0.14, 0.14);
      } else if (r < 0.70) {
        // Bright Vibrant Chartreuse / Lime Green
        const t = (r - 0.40) / 0.30;
        target.setRGB(0.42 + t * 0.18, 0.88 + t * 0.08, 0.12);
      } else if (r < 0.88) {
        // Sunlit Yellow / Summer Golden Wildflower Blade
        const t = (r - 0.70) / 0.18;
        target.setRGB(0.94, 0.82 + t * 0.10, 0.20 + t * 0.15);
      } else {
        // Deep Forest Shadow Green
        target.setRGB(0.06, 0.38, 0.08);
      }
    } else if (this.season === 2) {
      // 🍂 Autumn 3D Grass: ⑧ 冬草 (#9D8C73) + ⑤ 酒林 (#BD956E) + ④ 小春日和 (#F4A358) + ⑨ 山眠 (#5D4C35)
      if (r < 0.40) {
        // ⑧ 冬草 Withered Autumn Grass
        target.setRGB(158 / 255 + micro * 0.1, 140 / 255 + micro * 0.1, 115 / 255 + micro * 0.1);
      } else if (r < 0.70) {
        // ⑤ 酒林 Cedar Brown
        target.setRGB(190 / 255 + micro * 0.1, 150 / 255 + micro * 0.1, 110 / 255 + micro * 0.1);
      } else if (r < 0.88) {
        // ④ 小春日和 Warm Amber Golden Wildflower Blade
        target.setRGB(244 / 255 + micro * 0.1, 164 / 255 + micro * 0.1, 88 / 255 + micro * 0.1);
      } else {
        // ⑨ 山眠 Deep Soil Bronze Base
        target.setRGB(94 / 255, 77 / 255, 54 / 255);
      }
    } else {
      // ❄️ Winter:
      target.setRGB(0.96, 0.98, 1.0);
    }
  }

  public setSeason(season: number) {
    this.season = season;
    this.activeCustomTheme = null;
    this.customStrength = 0;
    this.scene.background = null;
    this.rebuildMeshes();
  }

  public setCustomTheme(theme: TreeTheme | null) {
    this.activeCustomTheme = theme;
    if (theme) {
      const [r, g, b] = hexToRgbTuple(theme.foliageColor);
      this.customColor.setRGB(r, g, b);
      this.customStrength = 1.0;
    } else {
      this.customStrength = 0.0;
    }
    this.lastGroundProgress = -1;
    this.rebuildMeshes();
  }

  public setCustomColor(rgb: [number, number, number], strength: number = 1.0) {
    this.customColor.setRGB(rgb[0], rgb[1], rgb[2]);
    this.customStrength = strength;
    this.rebuildMeshes();
  }

  public resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    if (this.camera.aspect < 1.0) {
      const hFovRad = (QR_SCAN_MOBILE_HORIZONTAL_FOV * Math.PI) / 180;
      const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / this.camera.aspect);
      this.camera.fov = (vFovRad * 180) / Math.PI;
    } else {
      this.camera.fov = QR_SCAN_DESKTOP_VERTICAL_FOV;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.resolvePixelRatio());
    this.renderer.setSize(width, height);
  }

  public setQuality(quality: DesignQRQuality) {
    this.quality = quality;
    this.renderer.setPixelRatio(this.resolvePixelRatio());
    const canvas = this.renderer.domElement;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  private resolvePixelRatio(): number {
    const devicePixelRatio = window.devicePixelRatio || 1;
    if (this.quality === 'low') return 1;
    return Math.min(devicePixelRatio, 2);
  }

  private startLoop() {
    this.resume();
  }

  public pause() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resume() {
    if (this.isDestroyed || this.isRunning) return;
    this.isRunning = true;

    const render = () => {
      if (!this.isRunning || this.isDestroyed) return;
      this.renderFrame();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  public renderOnce() {
    if (this.isDestroyed) return;
    this.renderFrame();
  }

  private renderFrame() {
    this.update();
    this.renderer.render(this.scene, this.camera);
    this.onAfterRender?.();
  }

  private update() {
    const now = performance.now();
    const elapsed = (now - this.startTime) * 0.001;
    const spawnElapsed = (now - this.spawnStartTime) * 0.001;
    const envConfig = this.getEnvConfig();
    // Smooth, graceful transition between 3D angle and top-down scan mode.
    if (this.isTransitioning) {
      const elapsedSec = (now - this.transitionStartTime) * 0.001;
      const u = Math.min(1.0, elapsedSec / this.transitionDuration);
      // Symmetric smoothstep keeps both ends at zero velocity. The previous
      // strongly front-loaded curve made the first frames read as a jump.
      const easedProgress = u * u * (3.0 - 2.0 * u);
      this.currentProgress = this.transitionStartVal +
        (this._targetProgress - this.transitionStartVal) * easedProgress;
      if (u >= 1.0) {
        this.currentProgress = this._targetProgress;
        this.isTransitioning = false;
      }
    } else {
      // Fallback spring damper if manually dragged or adjusted
      this.currentProgress += (this._targetProgress - this.currentProgress) * 0.085;
      if (Math.abs(this._targetProgress - this.currentProgress) < 0.0005) {
        this.currentProgress = this._targetProgress;
      }
    }

    const progress = this.currentProgress;
    // `progress` already carries the symmetric transition easing. Keep the
    // organic artwork alive across that whole interval so its collapse does
    // not finish in the first few frames of a fast transition.
    const canopyCollapse = THREE.MathUtils.clamp(1.0 - progress, 0.0, 1.0);

    if (this.isResettingRotation) {
      const resetProgress = Math.min(
        1,
        (now - this.rotationResetStartTime) / ROTATION_RESET_DURATION_MS
      );
      const resetEase = 1 - Math.pow(1 - resetProgress, 4);
      const shortestYawDelta = Math.atan2(
        Math.sin(DEFAULT_TREE_YAW - this.rotationResetStartYaw),
        Math.cos(DEFAULT_TREE_YAW - this.rotationResetStartYaw)
      );
      this.yaw = this.rotationResetStartYaw + shortestYawDelta * resetEase;
      this.pitch = THREE.MathUtils.lerp(
        this.rotationResetStartPitch,
        DEFAULT_TREE_PITCH,
        resetEase
      );
      if (resetProgress >= 1) {
        this.yaw = DEFAULT_TREE_YAW;
        this.pitch = DEFAULT_TREE_PITCH;
        this.isResettingRotation = false;
      }
    } else if (this.isTurntable && this.targetProgress === 0) {
      this.yaw = (this.yaw + 0.005) % (Math.PI * 2);
    } else {
      this.yaw = ((this.yaw % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
    }

    const nearestYaw = this.yaw > Math.PI ? Math.PI * 2 : 0;
    const targetYaw = THREE.MathUtils.lerp(this.yaw, nearestYaw, progress);
    const targetPitch = THREE.MathUtils.lerp(this.pitch, -Math.PI / 2 + 0.0001, progress);
    const isPortrait = this.camera.aspect < 1.0;
    const baseScanDist = isPortrait
      ? QR_SCAN_MOBILE_DISTANCE
      : QR_SCAN_DESKTOP_DISTANCE;
    const baseTreeDist = isPortrait
      ? TREE_MOBILE_DISTANCE
      : TREE_DESKTOP_DISTANCE;
    // QR versions add modules as content grows. Move the camera by the same
    // ratio so denser QR matrices keep one stable on-screen footprint.
    const contentScale =
      (this.treeData?.gridSize ?? QR_VISUAL_REFERENCE_GRID_SIZE) /
      QR_VISUAL_REFERENCE_GRID_SIZE;
    const targetDist =
      THREE.MathUtils.lerp(baseTreeDist, baseScanDist, progress) * contentScale;

    const cx = targetDist * Math.cos(targetPitch) * Math.sin(targetYaw);
    const cy = -targetDist * Math.sin(targetPitch);
    const cz = targetDist * Math.cos(targetPitch) * Math.cos(targetYaw);

    // Keep the tree's vertical composition normalized with the camera distance.
    // Without this, larger QR versions make the scaled tree drift upward.
    const lookTargetY = THREE.MathUtils.lerp(0.2 * contentScale, 0.0, progress);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, lookTargetY, 0);

    // Dynamic camera up-vector for square QR alignment
    if (progress > 0.01) {
      this.camera.up.set(0, Math.max(0.001, 1.0 - progress), -progress).normalize();
    } else {
      this.camera.up.set(0, 1, 0);
    }

    // Dynamic real-time ground color blending
    if (Math.abs(progress - this.lastGroundProgress) > 0.001) {
      this.lastGroundProgress = progress;

      // Island base slab color blending (slate stone in 3D -> seamless website background in 2D)
      if (this.islandBaseMesh) {
        const base3D =
          this.season === 0
            ? new THREE.Color(101 / 255, 89 / 255, 93 / 255) // ⑦
            : new THREE.Color(0.44, 0.44, 0.48);
        const base2D =
          this.season === 3
            ? new THREE.Color(0.96, 0.97, 0.985)
            : this.season === 2
            ? new THREE.Color(0.97, 0.95, 0.92)
            : this.season === 1
            ? new THREE.Color(0.965, 0.975, 0.955)
            : new THREE.Color(241 / 255, 205 / 255, 189 / 255); // ①
        const ease = Math.min(1.0, Math.max(0.0, Math.pow(progress, 0.85)));
        (this.islandBaseMesh.material as THREE.MeshBasicMaterial).color.copy(base3D).lerp(base2D, ease);
        this.islandBaseMesh.visible = progress < 0.999;
      }

      // Ground tiles color blending for all ground tiles (dirt, fallen petals, grass)
      if (this.groundTilesMesh) {
        const tColor = new THREE.Color();
        for (let i = 0; i < this.groundPositions.length; i++) {
          const b = this.groundPositions[i];
          this.getGroundTileColorWithProgress(b, tColor, progress);
          this.groundTilesMesh.setColorAt(i, tColor);
        }
        if (this.groundTilesMesh.instanceColor) {
          this.groundTilesMesh.instanceColor.needsUpdate = true;
        }
      }
    }

    // Branches retract continuously with the canopy. The vertical exponent
    // keeps them hidden inside the flowers without an early visibility cut.
    if (this.branchesGroup) {
      const branchScaleY = Math.max(0.001, Math.pow(canopyCollapse, 1.35));
      const branchScaleXZ = Math.max(0.001, 0.2 + canopyCollapse * 0.8);
      this.branchesGroup.scale.set(branchScaleXZ, branchScaleY, branchScaleXZ);
      this.branchesGroup.visible = canopyCollapse > 0.001;
    }
    // Ground fallen leaves & falling petals visibility (graceful progressive collapse):
    const isReturningTo3D = this._targetProgress === 0;
    const isGroundLeavesActive = progress < 0.999;
    const isParticlesActive = progress < 0.98;

    if (this.groundFallenLeavesMesh) {
      this.groundFallenLeavesMesh.scale.set(1.0, Math.max(0.001, canopyCollapse), 1.0);
      this.groundFallenLeavesMesh.visible = isGroundLeavesActive;
    }
    if (this.petalsInstancedMesh) this.petalsInstancedMesh.visible = isParticlesActive;
    if (this.grassMesh) {
      this.grassMesh.scale.set(1.0, Math.max(0.001, canopyCollapse), 1.0);
      this.grassMesh.visible = progress < 0.999;
    }
    if (this.rainMesh) this.rainMesh.visible = isReturningTo3D ? (progress < 0.85) : (progress < 0.20);
    if (this.snowMesh) this.snowMesh.visible = isReturningTo3D ? (progress < 0.85) : (progress < 0.20);
    if (this.butterfliesGroup) this.butterfliesGroup.visible = isReturningTo3D ? (progress < 0.85) : (progress < 0.20);
    if (this.groundTilesMesh) this.groundTilesMesh.visible = true;

    // 1. Canopy Wind Swaying & Organic-to-Voxel  Transition
    const flowerMorphScale = canopyCollapse;
    const isFlowerVisible = flowerMorphScale > 0.001;

    if (this.canopyFlowersMesh && this.flowerBaseData.length > 0) {
      this.canopyFlowersMesh.visible = isFlowerVisible;

      if (isFlowerVisible) {
        const instanceMatrices = this.canopyFlowersMesh.instanceMatrix.array;
        const canUseCachedMorph = progress > 0.001
          && instanceMatrices instanceof Float32Array
          && instanceMatrices.length === this.flowerBaseMatrices.length;

        if (canUseCachedMorph) {
          // A tree can contain more than 12,000 blossom instances. During the
          // turn, reuse their settled matrices and update only scale plus Y
          // position. This preserves the same morph while avoiding thousands
          // of per-frame quaternion/trigonometry calculations.
          instanceMatrices.set(this.flowerBaseMatrices);
          for (let offset = 0; offset < instanceMatrices.length; offset += 16) {
            instanceMatrices[offset] *= flowerMorphScale;
            instanceMatrices[offset + 1] *= flowerMorphScale;
            instanceMatrices[offset + 2] *= flowerMorphScale;
            instanceMatrices[offset + 4] *= flowerMorphScale;
            instanceMatrices[offset + 5] *= flowerMorphScale;
            instanceMatrices[offset + 6] *= flowerMorphScale;
            instanceMatrices[offset + 8] *= flowerMorphScale;
            instanceMatrices[offset + 9] *= flowerMorphScale;
            instanceMatrices[offset + 10] *= flowerMorphScale;
            instanceMatrices[offset + 13] *= canopyCollapse;
          }
        } else {
          const fMatrix = new THREE.Matrix4();
          const fPos = new THREE.Vector3();
          const fQuat = new THREE.Quaternion();
          const fEuler = new THREE.Euler();
          const fScale = new THREE.Vector3();
          const isSpawning = spawnElapsed < 1.4;

          for (let i = 0; i < this.flowerBaseData.length; i++) {
            const fl = this.flowerBaseData[i];
            let scale = fl.scale;
            if (isSpawning) {
              const delay = (fl.y / 0.45) * 0.35;
              const p = Math.max(0, Math.min(1, (spawnElapsed - delay) / 0.28));
              scale = p < 1.0 ? scale * Math.sin(p * Math.PI * 0.5) : scale;
            }

            const swayMag = 0.0035 * (fl.y / 0.4);
            const swayX = Math.sin(elapsed * 2.2 + fl.y * 6.0) * swayMag;
            const swayZ = Math.cos(elapsed * 1.8 + fl.y * 5.0) * swayMag * 0.5;
            fEuler.set(fl.normX, fl.angle + swayX * 10, fl.normZ);
            fQuat.setFromEuler(fEuler);
            fPos.set(fl.x + swayX, fl.y, fl.z + swayZ);
            fScale.set(scale, scale, scale);
            fMatrix.compose(fPos, fQuat, fScale);
            this.canopyFlowersMesh.setMatrixAt(i, fMatrix);
          }
        }
        this.canopyFlowersMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 1b. 3D Voxel Cubes ( & ): Tree dissolves into cubes and cascades down to 2D ground
    const isVoxelActive = progress > 0.01 && progress < 0.999;
    if (this.morphVoxelMesh && this.morphBlocks.length > 0) {
      this.morphVoxelMesh.visible = isVoxelActive;

      if (isVoxelActive) {
        const vMatrix = new THREE.Matrix4();
        // Reveal the falling QR voxels throughout the complete turn. The
        // quarter-sine profile overlaps naturally with the inverse canopy
        // scale and avoids the former first-quarter scale pop.
        const voxelScaleIn = Math.sin(
          THREE.MathUtils.clamp(progress, 0.0, 1.0) * Math.PI * 0.5
        );

        for (let i = 0; i < this.morphBlocks.length; i++) {
          const b = this.morphBlocks[i];
          const heightNorm = b.y / 0.45;
          const noiseOffset = (this.getModuleClusterNoise(b.col, b.row, 3.7) - 0.5) * 0.16;
          // Staggered cascade delay: upper canopy blocks drop with a natural ripple
          const blockDelay = (1.0 - heightNorm) * 0.22 + noiseOffset;
          const p = Math.max(0, Math.min(1.0, (progress - blockDelay) / 0.78));

          // Physical gravity drop with micro bounce-settle:
          const dropEase = Math.pow(p, 1.85);
          const bounceSettle = Math.sin(p * Math.PI) * (1.0 - p) * 0.015 * Math.min(1.0, heightNorm);
          const targetY = (BLOCK_SIZE * 0.5) * Math.max(0.04, 1.0 - p * 0.96);
          const currentY = b.y * (1.0 - dropEase) + targetY * dropEase + bounceSettle;

          // As cubes descend and touch down, they smoothly lock into flush 2D mosaic tiles:
          const scaleY = voxelScaleIn * Math.max(0.02, (1.0 - dropEase * 0.95) * (1.0 - p * 0.92));
          const scaleXZ = voxelScaleIn * (0.97 + p * 0.03);

          vMatrix.makeScale(scaleXZ, scaleY, scaleXZ);
          vMatrix.setPosition(b.x, currentY, b.z);
          this.morphVoxelMesh.setMatrixAt(i, vMatrix);
        }
        this.morphVoxelMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. 3D Grass Blades Wind Sway
    if (
      this.grassMesh
      && this.treeData
      && this.currentProgress < 0.001
      && !this.isTransitioning
    ) {
      const gMatrix = new THREE.Matrix4();
      const gQuat = new THREE.Quaternion();
      const gEuler = new THREE.Euler();
      const gScale = new THREE.Vector3();
      const h = 0.052;

      for (let i = 0; i < this.treeData.grass.length; i++) {
        const g = this.treeData.grass[i];
        const sway = Math.sin(elapsed * 3.2 + g.x * 22.0 + g.z * 16.0) * 0.12 * (1.0 - this.currentProgress);
        gEuler.set(g.tilt + sway, g.seed * Math.PI * 2 + sway * 0.4, 0);
        gQuat.setFromEuler(gEuler);
        const s = g.height / h;
        gScale.set(1, s, 1);
        gMatrix.compose(new THREE.Vector3(g.x, g.y, g.z), gQuat, gScale);
        this.grassMesh.setMatrixAt(i, gMatrix);
      }
      this.grassMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Parameterized Falling Petals / Leaves Animation (Falling strictly from tree crown down to ground)
    if (this.petalsInstancedMesh && envConfig.fallingLeavesCount > 0 && this.fallingLeavesData.length > 0) {
      const pMatrix = new THREE.Matrix4();
      const pPos = new THREE.Vector3();
      const pQuat = new THREE.Quaternion();
      const pEuler = new THREE.Euler();
      const pScale = new THREE.Vector3();
      const count = Math.min(envConfig.fallingLeavesCount, this.fallingLeavesData.length);

      const groundY = BLOCK_SIZE * 0.52; // Top surface of ground pavers
      const topY = 0.46; // Top apex of tree canopy
      const heightSpan = topY - groundY;

      for (let i = 0; i < count; i++) {
        const p = this.fallingLeavesData[i];
        // Downward trajectory strictly from tree canopy down to ground level
        const dropDist = (elapsed * p.speed + p.phaseOffset * heightSpan) % heightSpan;
        const py = topY - dropDist;

        // Subtle organic sway & breeze drift that intensifies towards ground
        const progressNorm = (topY - py) / heightSpan;
        const swayAmp = 0.012 + 0.020 * progressNorm;
        const swayX = Math.sin(elapsed * p.swayFreq + p.seed * 12.0) * swayAmp;
        const driftZ = Math.cos(elapsed * p.driftFreq + p.seed * 9.0) * (swayAmp * 0.85);

        pEuler.set(
          elapsed * p.rotSpeed + p.seed * 6,
          elapsed * (p.rotSpeed * 0.8) + p.seed * 4,
          Math.sin(elapsed * 2.4 + p.seed * 5) * 0.6
        );
        pQuat.setFromEuler(pEuler);
        pPos.set(p.x + swayX, py, p.z + driftZ);

        const s = (1.0 - this.currentProgress) * p.scale;
        pScale.set(s, s, s);

        pMatrix.compose(pPos, pQuat, pScale);
        this.petalsInstancedMesh.setMatrixAt(i, pMatrix);
      }
      this.petalsInstancedMesh.instanceMatrix.needsUpdate = true;
      this.petalsInstancedMesh.visible = this.currentProgress < 0.999;
    }

    // 4. Summer Rain Animation (180 falling vertical rain streaks)
    if (this.rainMesh && !this.activeCustomTheme && this.season === 1) {
      const rMatrix = new THREE.Matrix4();
      const rPos = new THREE.Vector3();

      for (let i = 0; i < this.rainData.length; i++) {
        const r = this.rainData[i];
        let ry = (r.y - elapsed * r.speed) % 1.8;
        if (ry < 0) ry += 1.8;
        rPos.set(r.x, ry, r.z);
        rMatrix.setPosition(rPos);
        this.rainMesh.setMatrixAt(i, rMatrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
      this.rainMesh.visible = this.currentProgress < 0.8;
    }

    // 5. Winter Falling Snow Crystals Animation (! 300 3D Snowflakes)
    if (this.snowMesh && envConfig.snowflakesCount > 0) {
      const sMatrix = new THREE.Matrix4();
      const sPos = new THREE.Vector3();
      const sQuat = new THREE.Quaternion();
      const sEuler = new THREE.Euler();
      const sScale = new THREE.Vector3();

      for (let i = 0; i < this.snowData.length; i++) {
        const sn = this.snowData[i];
        let sy = (sn.y - elapsed * sn.speed) % 1.9;
        if (sy < 0) sy += 1.9;

        const sx = sn.x + Math.sin(elapsed * 1.5 + sn.swaySeed) * 0.06;
        const sz = sn.z + Math.cos(elapsed * 1.2 + sn.swaySeed * 0.7) * 0.05;

        sEuler.set(
          elapsed * sn.rotSpeed + sn.swaySeed,
          elapsed * (sn.rotSpeed * 1.2),
          Math.sin(elapsed * 1.8 + sn.swaySeed) * 0.4
        );
        sQuat.setFromEuler(sEuler);
        sPos.set(sx, sy, sz);

        const s = (1.0 - this.currentProgress) * sn.scale;
        sScale.set(s, s, s);

        sMatrix.compose(sPos, sQuat, sScale);
        this.snowMesh.setMatrixAt(i, sMatrix);
      }
      this.snowMesh.instanceMatrix.needsUpdate = true;
      this.snowMesh.visible = this.currentProgress < 0.8;
    }

    // 6. Enhanced 3D Butterflies with Species Shading, Rapid Wing Beats & Dynamic Cursor Attraction
    if (this.butterflies.length > 0) {
      const butterflyVis = Math.max(0, Math.min(1.0, (1.0 - this.currentProgress) * 2.2));
      this.butterfliesGroup.visible = butterflyVis > 0.001;

      if (butterflyVis > 0.001) {
        for (let i = 0; i < this.butterflies.length; i++) {
          const b = this.butterflies[i];

          // Natural erratic flight orbit with organic micro-turbulence (Refined from target shader mechanics)
          const angle = elapsed * b.orbitSpeed + b.phase;
          const wobble = Math.sin(elapsed * 2.6 + b.seed * 8.0) * 0.28;
          const bobY = Math.sin(elapsed * 1.9 + b.seed * 5.0) * 0.035;

          const naturalX = Math.sin(angle + wobble) * b.orbitRadius;
          const naturalZ = Math.cos(angle + wobble) * b.orbitRadius;
          const naturalY = b.height + bobY;
          const naturalTarget = new THREE.Vector3(naturalX, naturalY, naturalZ);

          // Dynamic Cursor Attraction (smoothly converges when hovering over tree)
          let finalTarget = naturalTarget;
          if (this.mouseActive) {
            const distToMouse = b.currentPos.distanceTo(this.mouse3D);
            if (distToMouse < 1.4) {
              const offset = new THREE.Vector3(
                Math.sin(elapsed * 3.5 + i * 1.5) * 0.10,
                Math.cos(elapsed * 2.8 + i) * 0.05,
                Math.cos(elapsed * 3.5 + i * 1.5) * 0.10
              );
              const cursorTarget = this.mouse3D.clone().add(offset);
              const attractWeight = Math.max(0, 1.0 - distToMouse / 1.4) * 0.75;
              finalTarget = naturalTarget.clone().lerp(cursorTarget, attractWeight);
            }
          }

          // Smooth velocity integration & steering
          const toTarget = finalTarget.clone().sub(b.currentPos);
          b.velocity.add(toTarget.multiplyScalar(0.045));
          b.velocity.multiplyScalar(0.90);
          b.currentPos.add(b.velocity);

          b.mesh.position.copy(b.currentPos);

          // Scale fades out smoothly into 2D Scan mode
          const currentScale = b.scale * butterflyVis;
          b.mesh.scale.set(currentScale, currentScale, currentScale);

          // Dynamic bank angle & 3D heading
          if (b.velocity.lengthSq() > 0.00001) {
            const heading = Math.atan2(b.velocity.x, b.velocity.z);
            b.mesh.rotation.y = heading;
            b.mesh.rotation.x = -b.velocity.y * 2.2;
            b.mesh.rotation.z = Math.sin(elapsed * 4.0 + b.seed) * 0.15; // subtle bank roll
          }

          // Fast, realistic multi-axis wing flutter (rapid flapping + subtle wing flexion)
          const flap = Math.sin(elapsed * b.flapSpeed + b.phase * 5) * 0.85;
          const flex = Math.sin(elapsed * b.flapSpeed * 0.5) * 0.12;

          b.leftWing.rotation.y = flap;
          b.rightWing.rotation.y = -flap;
          b.leftWing.rotation.z = flex;
          b.rightWing.rotation.z = -flex;
        }
      }
    }

    const blurIntensity = Math.sin(this.currentProgress * Math.PI);
    this.onProgressUpdate?.(this.currentProgress, blurIntensity);
  }

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.pause();

    disposeObjectResources(this.scene);
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.onProgressUpdate = undefined;
    this.onAfterRender = undefined;
  }
}
