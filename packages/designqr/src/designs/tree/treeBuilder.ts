import {
  BLOCK_SIZE,
  TREE_RADIUS_RATIO,
  TreeBlockType,
  type TreeShapeStyle,
} from './constants.ts';
import { isFinderPattern } from './qr.ts';

export interface VoxelBlock {
  col: number; // grid x
  row: number; // grid z
  x: number;   // 3D world x
  y: number;   // 3D world y
  z: number;   // 3D world z
  type: TreeBlockType;
  layer: number;
}

export interface BranchSegment {
  startX: number;
  startY: number;
  startZ: number;
  startRadius: number;
  endX: number;
  endY: number;
  endZ: number;
  endRadius: number;
  depth: number;
  seed: number;
}

export interface BlossomFlower {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  scale: number;
  seed: number;
  petalAngle: number;
}

export interface GrassBlade {
  x: number;
  y: number;
  z: number;
  height: number;
  tilt: number;
  seed: number;
}

export interface TreeData {
  gridSize: number;
  blocks: VoxelBlock[];
  branches: BranchSegment[];
  flowers: BlossomFlower[];
  grass: GrassBlade[];
  trunkHeight: number;
}

// Deterministic pseudo-random noise generator
function hashNoise(a: number, b: number = 0, c: number = 0, seed: number = 0): number {
  const v = 43758.5453123 * Math.sin(127.1 * a + 311.7 * b + 43.7 * c + 7919.0 * seed);
  return v - Math.floor(v);
}

export function build3DTree(
  modules: boolean[][],
  sessionSeed: number = 0.5,
  treeShape: TreeShapeStyle = 'dome'
): TreeData {
  const gridSize = modules.length;
  const halfGrid = gridSize / 2;
  const scale = gridSize / 29;

  // 1. Measure the QR density used to size procedural foliage clusters.
  let darkCount = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (modules[r][c]) darkCount++;
    }
  }

  const density = darkCount / (gridSize * gridSize);

  // Tree silhouette modifiers based on treeShape
  let heightMult = 1.0;
  let radiusMult = 1.0;
  let leanMult = 1.0;
  let spreadMult = 1.0;

  if (treeShape === 'wide') {
    // 2. Truly round / spherical lush crown (更加圓、圓潤飽滿、高度相同)
    heightMult = 1.0;
    radiusMult = 1.08;
    leanMult = 0.70;
    spreadMult = 1.25;
  } else if (treeShape === 'pine') {
    // 3. Natural Conical Pine (tall upright central trunk, tapered conical silhouette)
    heightMult = 1.15;
    radiusMult = 0.95;
    leanMult = 0.18;
    spreadMult = 0.90;
  }

  // 2. Procedural tree parameters (Rock-solid trunk & main scaffolding that never shifts when typing text)
  const trunkHeight = 0.32 * scale * heightMult;
  const trunkRadius = 0.030 * scale * radiusMult;
  const trunkLean = (0.05 + 0.02 * hashNoise(1, 2, 1, sessionSeed)) * scale * leanMult;
  const mainBranchCount = treeShape === 'wide' ? 6 : (treeShape === 'pine' ? 6 : 6);
  const branchLengthScale = 0.65 * spreadMult;
  const canopyBoundRadius = gridSize * TREE_RADIUS_RATIO * BLOCK_SIZE * spreadMult;
  const maxTreeRadius = gridSize * TREE_RADIUS_RATIO * spreadMult;
  const maxTreeRadiusSq = maxTreeRadius * maxTreeRadius;

  const trunkBlockLayers = Math.round(12 * scale * heightMult);
  const trunkBaseY = trunkBlockLayers * BLOCK_SIZE;
  const maxFoliageThickness = Math.round(16 * scale * heightMult);

  const blocks: VoxelBlock[] = [];
  const flowers: BlossomFlower[] = [];
  const grass: GrassBlade[] = [];

  function addBlock(
    c: number,
    r: number,
    baseY: number,
    type: TreeBlockType,
    layer: number = 0
  ) {
    const x = (c - halfGrid + 0.5) * BLOCK_SIZE;
    const z = (r - halfGrid + 0.5) * BLOCK_SIZE;
    blocks.push({
      col: c,
      row: r,
      x,
      y: baseY,
      z,
      type,
      layer,
    });
  }

  // 3. Generate Ground Floor Blocks & Corner Grass
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const isDark = modules[r][c];
      const dx = c - halfGrid + 0.5;
      const dz = r - halfGrid + 0.5;
      const distSq = dx * dx + dz * dz;

      let baseType: TreeBlockType = TreeBlockType.Dirt;
      if (isDark) {
        if (distSq < maxTreeRadiusSq) {
          baseType = TreeBlockType.FallenPetals; // Inside circular tree crown projection
        } else {
          baseType = TreeBlockType.Grass; // Outside circular tree crown projection (4 corners lawn)
        }
      }

      addBlock(c, r, 0, baseType, 0);

      // 3D grass tufts ONLY on DARK QR modules in the outer 4 corners (forming the QR code Finder patterns)
      if (baseType === TreeBlockType.Grass) {
        const isFinder = isFinderPattern(r, c, gridSize);
        const bladesPerBlock = isFinder ? 26 : 20;

        for (let b = 0; b < bladesPerBlock; b++) {
          const angle = (b / bladesPerBlock) * Math.PI * 2 + hashNoise(c, r, b, sessionSeed) * 1.2;
          const rad = BLOCK_SIZE * (0.10 + 0.35 * hashNoise(c, r, b + 10, sessionSeed));
          const gx = (c - halfGrid + 0.5) * BLOCK_SIZE + Math.cos(angle) * rad;
          const gz = (r - halfGrid + 0.5) * BLOCK_SIZE + Math.sin(angle) * rad;
          const gHeight = BLOCK_SIZE * (1.6 + 1.2 * hashNoise(c, r, b + 20, sessionSeed));
          const tilt = (hashNoise(c, r, b + 30, sessionSeed) - 0.5) * 0.38;

          grass.push({
            x: gx,
            y: BLOCK_SIZE * 0.2,
            z: gz,
            height: gHeight,
            tilt,
            seed: hashNoise(c, r, b + 40, sessionSeed),
          });
        }
      }

      if (isDark) {
        // Vertical trunk stack at center
        if (distSq < 6.25) {
          for (let k = 1; k < trunkBlockLayers; k++) {
            addBlock(c, r, k * BLOCK_SIZE, TreeBlockType.Trunk, k);
          }
        }

        // Top-down scan mode canopy blocks (Parabolic dome tiers + strict 1:1 QR alignment)
        if (distSq < maxTreeRadiusSq) {
          const dist = Math.sqrt(distSq);
          const t = Math.max(0, 1.0 - dist / maxTreeRadius);
          const domeT = t * t;
          const thickness = Math.max(
            3,
            Math.round(maxFoliageThickness * (0.28 + 0.72 * domeT))
          );
          const domeOffset = Math.floor(t * 3.0) * BLOCK_SIZE;

          for (let layer = 0; layer < thickness; layer++) {
            const y = trunkBaseY + layer * BLOCK_SIZE + domeOffset;
            addBlock(c, r, y, TreeBlockType.CherryBlossom, layer);
          }
        }
      }
    }
  }

  // 4. Procedural Branch Network
  const branches: BranchSegment[] = [];
  const branchTips: { x: number; y: number; z: number; radius: number }[] = [];
  const maxBranches = 85;
  let branchCount = 0;

  function addBranchSegment(
    startX: number,
    startY: number,
    startZ: number,
    startRadius: number,
    endX: number,
    endY: number,
    endZ: number,
    endRadius: number,
    depth: number,
    seed: number
  ) {
    if (branchCount >= maxBranches) return;
    branches.push({
      startX,
      startY,
      startZ,
      startRadius,
      endX,
      endY,
      endZ,
      endRadius,
      depth,
      seed,
    });
    branchCount++;
  }

  function getTrunkPos(t: number) {
    if (treeShape === 'pine') {
      return {
        x: trunkLean * 0.20 * t * t,
        y: trunkHeight * t,
        z: trunkLean * 0.15 * Math.sin(t * Math.PI * 0.8),
      };
    }
    return {
      x: trunkLean * t * t + 0.3 * trunkLean * Math.sin(t * Math.PI * 1.5),
      y: trunkHeight * t,
      z: 0.5 * trunkLean * Math.sin(t * Math.PI * 0.8),
    };
  }

  // Trunk curve (10 cylindrical segments)
  const trunkSegments = 10;
  for (let i = 0; i < trunkSegments; i++) {
    const t0 = i / trunkSegments;
    const t1 = (i + 1) / trunkSegments;

    const r0 = trunkRadius * (1 - 0.55 * t0) * (1 + 0.08 * Math.sin(t0 * Math.PI * 0.8));
    const r1 = trunkRadius * (1 - 0.55 * t1) * (1 + 0.08 * Math.sin(t1 * Math.PI * 0.8));

    const p0 = getTrunkPos(t0);
    const p1 = getTrunkPos(t1);

    addBranchSegment(p0.x, p0.y, p0.z, r0, p1.x, p1.y, p1.z, r1, 0, 0.5 * t0);
  }

  const maxBranchY = trunkHeight + (treeShape === 'wide' ? 1.05 : (treeShape === 'pine' ? 1.35 : 1.25)) * canopyBoundRadius;
  const minBranchY = 0.58 * trunkHeight;

  function branchRecursion(
    startX: number,
    startY: number,
    startZ: number,
    startR: number,
    endX: number,
    endY: number,
    endZ: number,
    endR: number,
    baseAngle: number,
    depth: number
  ) {
    if (branchCount >= maxBranches) return;
    addBranchSegment(startX, startY, startZ, startR, endX, endY, endZ, endR, depth, hashNoise(branchCount, 0, 0x190));

    const subCount = 1 + Math.floor(2 * hashNoise(branchCount, 0, 0x1f4));
    for (let sb = 0; sb < subCount && branchCount < maxBranches; sb++) {
      const subAngle = baseAngle + 2.2 * (hashNoise(branchCount, sb, 0x258) - 0.5);
      const subLen = canopyBoundRadius * (treeShape === 'wide' ? 0.20 : (treeShape === 'pine' ? 0.14 : 0.16) + 0.2 * hashNoise(branchCount, sb, 0x2bc)) * branchLengthScale;

      let subPitch = 0.1 + 0.45 * hashNoise(branchCount, sb, 0x2ee);
      if (treeShape === 'wide') {
        subPitch = 0.05 + 0.25 * hashNoise(branchCount, sb, 0x2ee); // Smooth spherical curvature
      } else if (treeShape === 'pine') {
        subPitch = 0.02 + 0.25 * hashNoise(branchCount, sb, 0x2ee);
      }

      const subStartR = endR * (0.5 + 0.2 * hashNoise(branchCount, sb, 0x320));

      let nextX = endX + Math.cos(subAngle) * Math.cos(subPitch) * subLen;
      let nextY = Math.max(Math.min(endY + Math.sin(subPitch) * subLen, maxBranchY), minBranchY);
      let nextZ = endZ + Math.sin(subAngle) * Math.cos(subPitch) * subLen;
      const subEndR = 0.4 * subStartR;

      const lenSq = nextX * nextX + nextZ * nextZ;
      const maxR = 0.92 * canopyBoundRadius;
      if (lenSq > maxR * maxR) {
        const len = Math.sqrt(lenSq);
        nextX = (nextX / len) * maxR;
        nextZ = (nextZ / len) * maxR;
      }

      addBranchSegment(endX, endY, endZ, subStartR, nextX, nextY, nextZ, subEndR, depth + 1, hashNoise(branchCount, sb, 0x352));
      branchTips.push({ x: nextX, y: nextY, z: nextZ, radius: 25 * subEndR });

      // Tertiary sub-twigs
      if (branchCount < maxBranches) {
        const twigAngle = subAngle + 2.2 * (hashNoise(branchCount, sb, 0x35c) - 0.5);
        const twigLen = (treeShape === 'wide' ? 0.50 : 0.45) * subLen;
        const twigPitch = subPitch * 0.8 + 0.2 * hashNoise(branchCount, sb, 0x366);
        const twigStartR = 0.5 * subEndR;

        let twigEndX = nextX + Math.cos(twigAngle) * Math.cos(twigPitch) * twigLen;
        let twigEndY = Math.max(Math.min(nextY + Math.sin(twigPitch) * twigLen, maxBranchY), minBranchY);
        let twigEndZ = nextZ + Math.sin(twigAngle) * Math.cos(twigPitch) * twigLen;

        const tLenSq = twigEndX * twigEndX + twigEndZ * twigEndZ;
        if (tLenSq > maxR * maxR) {
          const tLen = Math.sqrt(tLenSq);
          twigEndX = (twigEndX / tLen) * maxR;
          twigEndZ = (twigEndZ / tLen) * maxR;
        }

        const twigEndR = 0.3 * twigStartR;
        addBranchSegment(nextX, nextY, nextZ, twigStartR, twigEndX, twigEndY, twigEndZ, twigEndR, depth + 2, hashNoise(branchCount, sb, 0x370));
        branchTips.push({ x: twigEndX, y: twigEndY, z: twigEndZ, radius: 15 * twigEndR });
      }
    }
  }

  // Top Apex Crown Branch Clusters
  const topBranchCount = 3 + Math.floor(2 * hashNoise(0, 0, 0x7d0));
  const topTrunkPos = getTrunkPos(0.92);
  for (let b = 0; b < topBranchCount && branchCount < maxBranches; b++) {
    const angle = (b / topBranchCount) * Math.PI * 2 + 0.5 * hashNoise(b, 0, 0x834);
    const len = canopyBoundRadius * (treeShape === 'wide' ? 0.16 : (treeShape === 'pine' ? 0.12 : 0.18));
    const startR = trunkRadius * (0.3 + 0.12 * hashNoise(b, 0, 0x8fc));
    const steps = 2 + Math.floor(hashNoise(b, 0, 0x960));

    let curX = topTrunkPos.x;
    let curY = topTrunkPos.y;
    let curZ = topTrunkPos.z;
    let curR = startR;

    for (let s = 0; s < steps && branchCount < maxBranches; s++) {
      const t = (s + 1) / steps;
      const nextX = topTrunkPos.x + Math.cos(angle) * len * t + 0.01 * (hashNoise(b, s, 0x9c4) - 0.5);
      const nextY = topTrunkPos.y + (maxBranchY - topTrunkPos.y) * t * (treeShape === 'wide' ? 0.65 : (treeShape === 'pine' ? 0.85 : 0.75));
      const nextZ = topTrunkPos.z + Math.sin(angle) * len * t + 0.01 * (hashNoise(b, s, 0xa28) - 0.5);
      const nextR = curR * (0.5 + 0.1 * hashNoise(b, s, 0xaf0));

      addBranchSegment(curX, curY, curZ, curR, nextX, nextY, nextZ, nextR, 1, hashNoise(b, s, 0xb54));
      curX = nextX;
      curY = nextY;
      curZ = nextZ;
      curR = nextR;
    }

    branchTips.push({ x: curX, y: curY, z: curZ, radius: 35 * curR });
    branchRecursion(
      curX,
      curY,
      curZ,
      0.7 * curR,
      curX + (hashNoise(b, 0, 0xbb8) - 0.5) * canopyBoundRadius * 0.35,
      Math.max(Math.min(curY + 0.06 * canopyBoundRadius, maxBranchY), minBranchY),
      curZ + (hashNoise(b, 0, 0xc1c) - 0.5) * canopyBoundRadius * 0.35,
      0.3 * curR,
      angle,
      2
    );
  }

  // Main Side Spreading Limb Shelves (Smooth spherical skeleton support)
  for (let mb = 0; mb < mainBranchCount && branchCount < maxBranches; mb++) {
    const trunkT = 0.72 + 0.18 * hashNoise(mb, 0, 0x4b0);
    const startPos = getTrunkPos(trunkT);
    const angle = (mb / mainBranchCount) * Math.PI * 2 + 0.4 * (hashNoise(mb, 0, 0x384) - 0.5);
    const limbLen = canopyBoundRadius * (treeShape === 'wide' ? 0.72 : (treeShape === 'pine' ? (0.75 - trunkT * 0.35) : 0.68));
    const limbTargetY = trunkHeight * (treeShape === 'wide' ? 0.85 : 0.90);
    const targetX = Math.cos(angle) * limbLen;
    const targetZ = Math.sin(angle) * limbLen;

    let curX = startPos.x;
    let curY = startPos.y;
    let curZ = startPos.z;
    let curR = trunkRadius * (0.4 + 0.15 * hashNoise(mb, 0, 0x44c));

    for (let s = 0; s < 3 && branchCount < maxBranches; s++) {
      const t = (s + 1) / 3;
      const arcLift = Math.sin(t * Math.PI) * canopyBoundRadius * (treeShape === 'wide' ? 0.20 : 0.25);
      const nextX = startPos.x + (targetX - startPos.x) * t + 0.015 * (hashNoise(mb, s, 0x96) - 0.5);
      const nextY = startPos.y + (limbTargetY - startPos.y) * t + arcLift * (1 - t);
      const nextZ = startPos.z + (targetZ - startPos.z) * t + 0.015 * (hashNoise(mb, s, 0xfa) - 0.5);
      const nextR = curR * (0.55 + 0.1 * hashNoise(mb, s, 0x15e));

      addBranchSegment(curX, curY, curZ, curR, nextX, nextY, nextZ, nextR, 1, hashNoise(mb, s, 0x190));

      if (s >= 1 && branchCount < maxBranches) {
        branchRecursion(
          nextX,
          nextY,
          nextZ,
          0.6 * nextR,
          nextX + (hashNoise(mb, s, 0x262) - 0.5) * canopyBoundRadius * 0.35,
          Math.max(Math.min(nextY + canopyBoundRadius * (0.05 + 0.1 * hashNoise(mb, s, 0x26c)), maxBranchY), minBranchY),
          nextZ + (hashNoise(mb, s, 0x276) - 0.5) * canopyBoundRadius * 0.35,
          0.25 * nextR,
          angle,
          2
        );
      }

      curX = nextX;
      curY = nextY;
      curZ = nextZ;
      curR = nextR;
    }

    branchTips.push({ x: curX, y: curY, z: curZ, radius: 30 * curR });
  }

  // 5. Tiered Blossom Cloud Pads (Layered rounded flower clusters)
  for (let tIdx = 0; tIdx < branchTips.length; tIdx++) {
    const tip = branchTips[tIdx];
    const tipDist = Math.sqrt(tip.x * tip.x + tip.z * tip.z);
    const distBoost = 1 + 0.75 * (1 - Math.min(1, tipDist / canopyBoundRadius));
    const padDensity = (1 + 0.35 * hashNoise(tIdx, 3, 0x316)) * distBoost;

    const flowerCount = Math.max(120, Math.floor(220 * tip.radius * (0.6 + 0.4 * density) * padDensity));
    const cloudRadius = tip.radius * BLOCK_SIZE * (treeShape === 'wide' ? 13.0 : 11.5) * padDensity;

    // Smooth rounded pads
    const horizStretch = treeShape === 'wide' ? 1.45 : 1.55;
    const vertStretch = treeShape === 'wide' ? 1.20 : 1.10;

    for (let f = 0; f < flowerCount; f++) {
      const angle = hashNoise(tIdx, f, 0x32a) * Math.PI * 2;
      const u = 2 * hashNoise(tIdx, f, 0x334) - 1;
      const radial = cloudRadius * Math.cbrt(hashNoise(tIdx, f, 0x33e));
      const planarR = radial * Math.sqrt(Math.max(0, 1 - u * u));

      const flX = tip.x + planarR * Math.cos(angle) * horizStretch;
      const flY = tip.y + radial * u * vertStretch + 0.05 * cloudRadius;
      const flZ = tip.z + planarR * Math.sin(angle) * horizStretch;

      flowers.push({
        x: flX,
        y: flY,
        z: flZ,
        normalX: Math.cos(angle) * 0.4,
        normalY: 1.0,
        normalZ: Math.sin(angle) * 0.4,
        scale: BLOCK_SIZE * (0.58 + 0.24 * hashNoise(tIdx, f, 0x320)),
        seed: hashNoise(tIdx, f, 0x340),
        petalAngle: angle + hashNoise(tIdx, f, 0x348) * Math.PI,
      });
    }

    // Drooping hanging blossoms beneath the cloud pad
    const dropCount = 18 + Math.floor(18 * hashNoise(tIdx, 0, 0x5dc));
    for (let d = 0; d < dropCount; d++) {
      const dropAngle = hashNoise(tIdx, d, 0x6a4) * Math.PI * 2;
      const dropR = (0.25 + 0.55 * hashNoise(tIdx, d, 0x6b0)) * cloudRadius;
      const flX = tip.x + Math.cos(dropAngle) * dropR * 1.35;
      const flZ = tip.z + Math.sin(dropAngle) * dropR * 1.35;
      const flY = tip.y - BLOCK_SIZE * (0.3 + 2.2 * hashNoise(tIdx, d, 0x76c));

      flowers.push({
        x: flX,
        y: flY,
        z: flZ,
        normalX: Math.cos(dropAngle) * 0.6,
        normalY: 0.4,
        normalZ: Math.sin(dropAngle) * 0.6,
        scale: BLOCK_SIZE * (0.48 + 0.20 * hashNoise(tIdx, d, 0x640)),
        seed: hashNoise(tIdx, d, 0x780),
        petalAngle: dropAngle,
      });
    }
  }

  // Dense flower clusters wrapping 360 degrees around all branch limbs (excluding main trunk)
  for (const br of branches) {
    // Only place on actual branches (depth >= 1) that are within the canopy envelope
    if (br.depth >= 1 && br.startY >= trunkBaseY * 0.85) {
      const count = 10 + Math.floor(br.depth * 6);
      for (let k = 0; k < count; k++) {
        const t = 0.15 + 0.85 * (k / count);
        const bx = br.startX + (br.endX - br.startX) * t;
        const by = br.startY + (br.endY - br.startY) * t;
        const bz = br.startZ + (br.endZ - br.startZ) * t;
        const angle = (k / count) * Math.PI * 2 + hashNoise(br.depth, k, 0x918) * Math.PI;
        const offsetR = br.startRadius * 1.2 + 0.008 + 0.014 * hashNoise(k, br.depth, 0x12a);

        flowers.push({
          x: bx + Math.cos(angle) * offsetR,
          y: by + (hashNoise(br.depth, k, 0x333) - 0.5) * 0.012,
          z: bz + Math.sin(angle) * offsetR,
          normalX: Math.cos(angle) * 0.7,
          normalY: 0.7,
          normalZ: Math.sin(angle) * 0.7,
          scale: BLOCK_SIZE * (0.55 + 0.22 * hashNoise(br.depth, k, 0x444)),
          seed: hashNoise(br.depth, k, 0x555),
          petalAngle: angle,
        });
      }
    }
  }

  // Top Apex Crown Blossom Cloud (Rounded spherical cap)
  if (branchTips.length > 0) {
    let topTipY = -Infinity;
    for (const tip of branchTips) {
      if (tip.y > topTipY) topTipY = tip.y;
    }

    const apexCount = Math.floor(280 * Math.max(0.75, 0.5 + 0.5 * density));
    const apexRadius = canopyBoundRadius * (treeShape === 'wide' ? 0.40 : (treeShape === 'pine' ? 0.25 : 0.38));
    const apexBaseY = topTipY - 0.045;

    for (let a = 0; a < apexCount; a++) {
      const aAngle = hashNoise(a, 0, 0x13ec) * Math.PI * 2;
      const aRad = apexRadius * Math.sqrt(hashNoise(a, 0, 0x1450));
      const horizApex = treeShape === 'wide' ? 1.40 : (treeShape === 'pine' ? 1.15 : 1.45);
      const flX = Math.cos(aAngle) * aRad * horizApex;
      const flZ = Math.sin(aAngle) * aRad * horizApex;
      const flY = apexBaseY + (hashNoise(a, 0, 0x14b4) - 0.3) * BLOCK_SIZE * 6;

      flowers.push({
        x: flX,
        y: flY,
        z: flZ,
        normalX: Math.cos(aAngle) * 0.4,
        normalY: 1.0,
        normalZ: Math.sin(aAngle) * 0.4,
        scale: BLOCK_SIZE * (0.58 + 0.25 * hashNoise(a, 0, 0x1518)),
        seed: hashNoise(a, 0, 0x1530),
        petalAngle: aAngle,
      });
    }
  }

  // QR Topological Canopy Flowers (Fills the entire crown volume continuously with zero gaps)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const isDark = modules[r][c];
      const dx = c - halfGrid + 0.5;
      const dz = r - halfGrid + 0.5;
      const distSq = dx * dx + dz * dz;

      if (isDark && distSq < maxTreeRadiusSq && distSq >= 1.0) {
        const dist = Math.sqrt(distSq);
        const rNorm = dist / maxTreeRadius;

        let yTop: number;
        let yBottom: number;

        if (treeShape === 'wide') {
          // True full spherical globe volume (渾圓飽滿、中間層無空白、高度相同)
          const sphereCurve = Math.sqrt(Math.max(0, 1.0 - rNorm * rNorm));
          const sphereCenter = trunkBaseY + 0.45 * maxFoliageThickness * BLOCK_SIZE;
          const sphereRadius = 0.55 * maxFoliageThickness * BLOCK_SIZE;

          yTop = sphereCenter + sphereRadius * sphereCurve;
          yBottom = sphereCenter - sphereRadius * sphereCurve * 0.75;
        } else if (treeShape === 'pine') {
          // Pine: continuous conical slope with clean, stately trunk below
          const domeShape = Math.max(0, 1.0 - rNorm) * 1.30;
          yTop = trunkBaseY + (0.30 + 0.70 * domeShape) * maxFoliageThickness * BLOCK_SIZE;
          yBottom = trunkBaseY + (0.12 + 0.15 * domeShape) * maxFoliageThickness * BLOCK_SIZE;
        } else {
          // Classic Dome
          const domeShape = Math.sqrt(Math.max(0, 1.0 - rNorm * rNorm));
          yTop = trunkBaseY + (0.25 + 0.75 * domeShape) * maxFoliageThickness * BLOCK_SIZE;
          yBottom = trunkBaseY + (0.08 + 0.20 * domeShape) * maxFoliageThickness * BLOCK_SIZE;
        }

        const count = 9 + Math.floor(6 * hashNoise(c, r, 0x1f4));
        for (let k = 0; k < count; k++) {
          const angle = hashNoise(c, r, k * 10) * Math.PI * 2;
          const rad = BLOCK_SIZE * (0.20 + 0.55 * hashNoise(c, r, k * 20));
          const fx = (c - halfGrid + 0.5) * BLOCK_SIZE * spreadMult + Math.cos(angle) * rad;
          const fz = (r - halfGrid + 0.5) * BLOCK_SIZE * spreadMult + Math.sin(angle) * rad;

          // Uniform volumetric vertical fill spanning full thickness from yBottom to yTop
          const t = count > 1 ? k / (count - 1) : 0.5;
          const tJitter = Math.min(1.0, Math.max(0.0, t + 0.16 * (hashNoise(c, r, k * 30) - 0.5)));
          const fy = yBottom + (yTop - yBottom) * tJitter;

          flowers.push({
            x: fx,
            y: fy,
            z: fz,
            normalX: Math.cos(angle) * 0.3,
            normalY: 1.0,
            normalZ: Math.sin(angle) * 0.3,
            scale: BLOCK_SIZE * (0.54 + 0.24 * hashNoise(c, r, k * 40)),
            seed: hashNoise(c, r, k * 50),
            petalAngle: angle,
          });
        }
      }
    }
  }

  return {
    gridSize,
    blocks,
    branches,
    flowers,
    grass,
    trunkHeight,
  };
}
