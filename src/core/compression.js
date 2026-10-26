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

// Limite de securite par run : un fichier corrompu (count enorme) ne doit pas figer l'onglet
const MAX_RUN = 4096;

export function decodeRLEVoxels(runs) {
  if (!Array.isArray(runs)) return {};
  const voxels = {};
  for (const item of runs) {
    if (!Array.isArray(item)) continue;
    const [startX, y, z, count, color] = item;
    if (![startX, y, z].every(Number.isInteger) || !Number.isInteger(count) || count < 1 || count > MAX_RUN) continue;
    if (color == null) continue;
    for (let i = 0; i < count; i++) {
      voxels[`${startX + i},${y},${z}`] = color;
    }
  }
  return voxels;
}

// Pour l'ecriture : remplace voxels / blocks par leur forme RLE (toujours recalculee)
export function packProjectVoxels(project) {
  for (const m of project.models || []) {
    if ((m.type || 'voxel') === 'voxel' && m.voxels) {
      m.voxelsRLE = encodeRLEVoxels(m.voxels);
      delete m.voxels;
    }
  }
  for (const sc of project.scenes3d || []) {
    if (sc.gridmap?.blocks) {
      sc.gridmap.blocksRLE = encodeRLEVoxels(sc.gridmap.blocks);
      delete sc.gridmap.blocks;
    }
  }
}

// A la lecture : la forme developpee (voxels / blocks) fait foi ; la forme RLE est decodee puis retiree
// pour ne jamais ressusciter un ancien contenu apres une edition.
export function unpackProjectVoxels(project) {
  for (const m of project.models || []) {
    if (m.voxelsRLE) {
      if (!m.voxels || !Object.keys(m.voxels).length) m.voxels = decodeRLEVoxels(m.voxelsRLE);
      delete m.voxelsRLE;
    }
  }
  for (const sc of project.scenes3d || []) {
    if (sc.gridmap?.blocksRLE) {
      if (!sc.gridmap.blocks || !Object.keys(sc.gridmap.blocks).length) sc.gridmap.blocks = decodeRLEVoxels(sc.gridmap.blocksRLE);
      delete sc.gridmap.blocksRLE;
    }
  }
}
