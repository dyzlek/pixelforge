/**
 * PixelForge Studio — Algorithme de Greedy Meshing pour modeles Voxel 3D
 * Reduit massivement le nombre de polygones en fusionnant les faces adjacentes
 * coplanaires partageant la meme couleur.
 *
 * Fonctionne sans dependance DOM (executable sous Node et dans le navigateur).
 */

/**
 * Genere les sommets, normales et couleurs optimises a partir d'une grille 3D de voxels.
 *
 * @param {object} options
 * @param {number} options.dimX - Largeur en voxels
 * @param {number} options.dimY - Hauteur en voxels
 * @param {number} options.dimZ - Profondeur en voxels
 * @param {Function} options.getVoxel - Fonction (x, y, z) -> couleur (index de palette, 0 compris, ou '#rrggbb'), null/undefined = vide
 * @param {string[]} options.palette - Tableau des couleurs hexadécimales
 * @param {number} [options.scale=1] - Echelle d'un voxel en unites du monde
 * @returns {{ positions: Float32Array, normals: Float32Array, colors: Float32Array, count: number }}
 */
export function greedyMeshVoxels({
  dimX = 16,
  dimY = 16,
  dimZ = 16,
  getVoxel = () => null,
  palette = [],
  scale = 1,
} = {}) {
  const positions = [];
  const normals = [];
  const colors = [];

  // Parseur de couleur hexadécimale vers [r, g, b] normalises 0..1
  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return [0.5, 0.5, 0.5];
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  // 6 directions : 0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z
  // Les axes u et v correspondent aux deux coordonnees du plan de tranche
  for (let d = 0; d < 6; d++) {
    const isBackFace = d % 2 === 1;
    const axis = Math.floor(d / 2); // 0 = X, 1 = Y, 2 = Z
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const dims = [dimX, dimY, dimZ];
    const maxD = dims[axis];
    const maxU = dims[u];
    const maxV = dims[v];

    const normal = [0, 0, 0];
    normal[axis] = isBackFace ? -1 : 1;

    // Balayage tranche par tranche selon l'axe principal
    for (let slice = 0; slice < maxD; slice++) {
      // Construction du masque 2D de faces visibles
      const mask = new Array(maxU * maxV).fill(null);

      for (let j = 0; j < maxV; j++) {
        for (let i = 0; i < maxU; i++) {
          const coord = [0, 0, 0];
          coord[axis] = slice;
          coord[u] = i;
          coord[v] = j;

          const currentVoxel = getVoxel(coord[0], coord[1], coord[2]);
          if (currentVoxel == null) continue;

          // Voxel voisin dans la direction de la face
          const neighborCoord = [...coord];
          neighborCoord[axis] += normal[axis];

          const hasNeighbor =
            neighborCoord[axis] >= 0 &&
            neighborCoord[axis] < maxD &&
            getVoxel(neighborCoord[0], neighborCoord[1], neighborCoord[2]) != null;

          // Si le voisin est plein, la face est masquee
          if (!hasNeighbor) {
            mask[i + j * maxU] = currentVoxel;
          }
        }
      }

      // Fusion gloutonne (Greedy Meshing) sur le masque 2D
      for (let j = 0; j < maxV; j++) {
        for (let i = 0; i < maxU; ) {
          const colorVal = mask[i + j * maxU];
          if (colorVal == null) {
            i++;
            continue;
          }

          // 1. Etendre la largeur W autant que possible avec la meme couleur
          let width = 1;
          while (i + width < maxU && mask[i + width + j * maxU] === colorVal) {
            width++;
          }

          // 2. Etendre la hauteur H sur toute cette largeur
          let height = 1;
          let canExtend = true;
          while (j + height < maxV && canExtend) {
            for (let k = 0; k < width; k++) {
              if (mask[i + k + (j + height) * maxU] !== colorVal) {
                canExtend = false;
                break;
              }
            }
            if (canExtend) height++;
          }

          // Marquer les cases traitees comme nulles
          for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
              mask[i + w + (j + h) * maxU] = null;
            }
          }

          // Construction du quad 3D correspondant
          const du = [0, 0, 0];
          du[u] = width;
          const dv = [0, 0, 0];
          dv[v] = height;

          const origin = [0, 0, 0];
          origin[axis] = slice + (isBackFace ? 0 : 1);
          origin[u] = i;
          origin[v] = j;

          // 4 sommets du quad
          const v0 = [...origin];
          const v1 = [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]];
          const v2 = [origin[0] + du[0] + dv[0], origin[1] + du[1] + dv[1], origin[2] + du[2] + dv[2]];
          const v3 = [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]];

          // Couleur RGB
          const hex = typeof colorVal === 'string' && colorVal.startsWith('#')
            ? colorVal
            : palette[colorVal] || palette[0] || '#ffffff';
          const [r, g, b] = hexToRgb(hex);

          // Ordre des triangles selon l'orientation de la normale (sens direct)
          const quadVerts = isBackFace ? [v0, v3, v2, v0, v2, v1] : [v0, v1, v2, v0, v2, v3];

          for (const vert of quadVerts) {
            positions.push(
              (vert[0] - dimX / 2) * scale,
              (vert[1]) * scale,
              (vert[2] - dimZ / 2) * scale
            );
            normals.push(normal[0], normal[1], normal[2]);
            colors.push(r, g, b);
          }

          i += width;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    count: positions.length / 3,
  };
}
