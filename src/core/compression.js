// Compression RLE pour voxels et GridMaps 3D
// Permet de stocker de gros volumes de voxels de façon compacte dans le projet JSON.

export function encodeRLEVoxels(voxels) {
  if (!voxels || typeof voxels !== 'object') return [];
  const entries = [];
  for (const [key, color] of Object.entries(voxels)) {
    const [x, y, z] = key.split(',').map(Number);
    entries.push({ x, y, z, color });
  }

  // Trier par Y, puis Z, puis X pour des tranches continues
  entries.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);

  const runs = [];
  let currentRun = null;

  for (const v of entries) {
    if (!currentRun) {
      currentRun = { x: v.x, y: v.y, z: v.z, count: 1, color: v.color };
    } else if (
      v.y === currentRun.y &&
      v.z === currentRun.z &&
      v.x === currentRun.x + currentRun.count &&
      v.color === currentRun.color
    ) {
      currentRun.count++;
    } else {
      runs.push([currentRun.x, currentRun.y, currentRun.z, currentRun.count, currentRun.color]);
      currentRun = { x: v.x, y: v.y, z: v.z, count: 1, color: v.color };
    }
  }

  if (currentRun) {
    runs.push([currentRun.x, currentRun.y, currentRun.z, currentRun.count, currentRun.color]);
  }

  return runs;
}

export function decodeRLEVoxels(runs) {
  if (!Array.isArray(runs)) return {};
  const voxels = {};
  for (const item of runs) {
    const [startX, y, z, count, color] = item;
    for (let i = 0; i < count; i++) {
      voxels[`${startX + i},${y},${z}`] = color;
    }
  }
  return voxels;
}

export function packProjectVoxels(project) {
  for (const m of project.models || []) {
    if (m.type === 'voxel' && m.voxels && !m.voxelsRLE) {
      m.voxelsRLE = encodeRLEVoxels(m.voxels);
    }
  }
  for (const sc of project.scenes3d || []) {
    if (sc.gridmap?.blocks && !sc.gridmap.blocksRLE) {
      sc.gridmap.blocksRLE = encodeRLEVoxels(sc.gridmap.blocks);
    }
  }
}

export function unpackProjectVoxels(project) {
  for (const m of project.models || []) {
    if (m.type === 'voxel') {
      if (m.voxelsRLE && (!m.voxels || !Object.keys(m.voxels).length)) {
        m.voxels = decodeRLEVoxels(m.voxelsRLE);
      }
    }
  }
  for (const sc of project.scenes3d || []) {
    if (sc.gridmap?.blocksRLE && (!sc.gridmap.blocks || !Object.keys(sc.gridmap.blocks).length)) {
      sc.gridmap.blocks = decodeRLEVoxels(sc.gridmap.blocksRLE);
    }
  }
}
