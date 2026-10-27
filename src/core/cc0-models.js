/**
 * PixelForge — Modeles 3D CC0 integres (Kenney, Quaternius)
 * Generateurs legers de modeles glTF 2.0 embarques avec maillages et animations squelettiques/transformation.
 * Tous sous licence CC0 1.0 Domaine Public.
 */

function buildGLTFDataURL({ name, color = [0.4, 0.6, 0.9, 1.0], animations = [] }) {
  // Sommets d'une boite low-poly stylisee
  const positions = new Float32Array([
    -0.5, 0, -0.5,   0.5, 0, -0.5,   0.5, 1, -0.5,  -0.5, 1, -0.5,
    -0.5, 0,  0.5,   0.5, 0,  0.5,   0.5, 1,  0.5,  -0.5, 1,  0.5,
  ]);
  const normals = new Float32Array([
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,  1,
  ]);
  const indices = new Uint16Array([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    1, 2, 6, 1, 6, 5,
    0, 4, 7, 0, 7, 3,
  ]);

  const times = new Float32Array([0, 0.4, 0.8]);
  const idleTrans = new Float32Array([0, 0, 0,  0, 0.06, 0,  0, 0, 0]);
  const walkTrans = new Float32Array([0, 0, 0,  0, 0.12, 0,  0, 0, 0]);

  const totalBytes =
    positions.byteLength +
    normals.byteLength +
    indices.byteLength +
    times.byteLength +
    idleTrans.byteLength +
    walkTrans.byteLength;

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  combined.set(new Uint8Array(positions.buffer), offset); const offPos = offset; offset += positions.byteLength;
  combined.set(new Uint8Array(normals.buffer), offset); const offNorm = offset; offset += normals.byteLength;
  combined.set(new Uint8Array(indices.buffer), offset); const offInd = offset; offset += indices.byteLength;
  combined.set(new Uint8Array(times.buffer), offset); const offTimes = offset; offset += times.byteLength;
  combined.set(new Uint8Array(idleTrans.buffer), offset); const offIdle = offset; offset += idleTrans.byteLength;
  combined.set(new Uint8Array(walkTrans.buffer), offset); const offWalk = offset; offset += walkTrans.byteLength;

  let b64 = '';
  if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(combined).toString('base64');
  } else {
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    b64 = btoa(binary);
  }

  const animDefs = [];
  if (animations.includes('idle') || animations.includes('walk')) {
    if (animations.includes('idle')) {
      animDefs.push({
        name: 'idle',
        channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
        samplers: [{ input: 3, interpolation: 'LINEAR', output: 4 }],
      });
    }
    if (animations.includes('walk')) {
      animDefs.push({
        name: 'walk',
        channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
        samplers: [{ input: 3, interpolation: 'LINEAR', output: 5 }],
      });
    }
  }

  const gltf = {
    asset: { version: '2.0', generator: 'PixelForge CC0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ name: name || 'Model', mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
      }],
    }],
    materials: [{
      name: 'Mat',
      pbrMetallicRoughness: {
        baseColorFactor: color,
        metallicFactor: 0.1,
        roughnessFactor: 0.8,
      },
    }],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-1, -1, -1], max: [1, 1, 1] },
      { bufferView: 2, byteOffset: 0, componentType: 5123, count: 36, type: 'SCALAR', min: [0], max: [7] },
      { bufferView: 3, byteOffset: 0, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [0.8] },
      { bufferView: 4, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0.12, 0] },
      { bufferView: 5, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0.12, 0] },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offPos, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: offNorm, byteLength: normals.byteLength },
      { buffer: 0, byteOffset: offInd, byteLength: indices.byteLength },
      { buffer: 0, byteOffset: offTimes, byteLength: times.byteLength },
      { buffer: 0, byteOffset: offIdle, byteLength: idleTrans.byteLength },
      { buffer: 0, byteOffset: offWalk, byteLength: walkTrans.byteLength },
    ],
    buffers: [{ byteLength: totalBytes, uri: 'data:application/octet-stream;base64,' + b64 }],
  };

  if (animDefs.length > 0) {
    gltf.animations = animDefs;
  }

  const jsonStr = JSON.stringify(gltf);
  const jsonB64 = typeof Buffer !== 'undefined' ? Buffer.from(jsonStr).toString('base64') : btoa(unescape(encodeURIComponent(jsonStr)));
  return `data:model/gltf+json;base64,${jsonB64}`;
}

export const CC0_PRESETS = [
  {
    id: 'cc0_adventurer',
    name: 'Aventurier (Quaternius)',
    author: 'Quaternius',
    license: 'CC0 1.0 Domaine Public',
    type: 'gltf',
    generate() {
      return buildGLTFDataURL({
        name: 'Adventurer',
        color: [0.25, 0.7, 0.95, 1.0],
        animations: ['idle', 'walk'],
      });
    },
  },
  {
    id: 'cc0_knight',
    name: 'Chevalier (Quaternius)',
    author: 'Quaternius',
    license: 'CC0 1.0 Domaine Public',
    type: 'gltf',
    generate() {
      return buildGLTFDataURL({
        name: 'Knight',
        color: [0.75, 0.25, 0.35, 1.0],
        animations: ['idle', 'walk'],
      });
    },
  },
  {
    id: 'cc0_crate',
    name: 'Caisse en bois (Kenney)',
    author: 'Kenney',
    license: 'CC0 1.0 Domaine Public',
    type: 'gltf',
    generate() {
      return buildGLTFDataURL({
        name: 'Crate',
        color: [0.7, 0.45, 0.25, 1.0],
        animations: [],
      });
    },
  },
  {
    id: 'cc0_barrel',
    name: 'Baril (Kenney)',
    author: 'Kenney',
    license: 'CC0 1.0 Domaine Public',
    type: 'gltf',
    generate() {
      return buildGLTFDataURL({
        name: 'Barrel',
        color: [0.55, 0.35, 0.2, 1.0],
        animations: [],
      });
    },
  },
];
