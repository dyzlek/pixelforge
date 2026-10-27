// Encodeur / décodeur PNG minimal (RGBA 8 bits) pur JavaScript, sans dépendance externe.
// Compatible navigateur (Chromium, Firefox, Safari) et Node.js.

const SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL_PREFIX = 'data:image/png;base64,';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf, offset = 0, length = buf.length - offset) {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(buf, offset, val) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function readUint32BE(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function makeChunk(type, data) {
  const out = new Uint8Array(4 + 4 + data.length + 4);
  writeUint32BE(out, 0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crc = crc32(out, 4, 4 + data.length);
  writeUint32BE(out, 8 + data.length, crc);
  return out;
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Compression zlib avec blocs stockés non compressés (RFC 1950 + 1951)
// 100% conforme à la norme PNG, rapide et sans dépendance
function deflateStore(raw) {
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const totalLen = 2 + numBlocks * 5 + raw.length + 4;
  const out = new Uint8Array(totalLen);
  out[0] = 0x78; // CMF: deflate, window 32K
  out[1] = 0x01; // FLG: (0x78*256 + 1) % 31 == 0
  let inPos = 0, outPos = 2;
  while (inPos < raw.length || inPos === 0) {
    const end = Math.min(inPos + maxBlock, raw.length);
    const len = end - inPos;
    const isLast = end >= raw.length;
    out[outPos++] = isLast ? 0x01 : 0x00;
    out[outPos++] = len & 0xff;
    out[outPos++] = (len >>> 8) & 0xff;
    const nlen = (~len) & 0xffff;
    out[outPos++] = nlen & 0xff;
    out[outPos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(inPos, end), outPos);
    outPos += len;
    inPos = end;
  }
  const adler = adler32(raw);
  out[outPos++] = (adler >>> 24) & 0xff;
  out[outPos++] = (adler >>> 16) & 0xff;
  out[outPos++] = (adler >>> 8) & 0xff;
  out[outPos++] = adler & 0xff;
  return out;
}

// Décompression zlib de secours (blocs stockés)
function inflateStored(input) {
  let pos = 2; // saute CMF et FLG
  let bitBuf = 0, bitCount = 0;

  function getBits(n) {
    while (bitCount < n) {
      if (pos >= input.length) return 0;
      bitBuf |= input[pos++] << bitCount;
      bitCount += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCount -= n;
    return val;
  }

  function alignBits() {
    bitBuf = 0;
    bitCount = 0;
  }

  const chunks = [];
  let totalLen = 0;
  let isLast = 0;

  while (!isLast && pos < input.length) {
    isLast = getBits(1);
    const btype = getBits(2);
    if (btype === 0) {
      alignBits();
      if (pos + 4 > input.length) break;
      const len = input[pos] | (input[pos + 1] << 8);
      pos += 4; // len + nlen
      if (pos + len > input.length) break;
      const slice = input.subarray(pos, pos + len);
      chunks.push(slice);
      totalLen += len;
      pos += len;
    } else {
      throw new Error(`unsupported compressed deflate block type ${btype} without zlib`);
    }
  }

  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// Decompression zlib avec bloc personnalise ou secours sur blocs stockes
let customInflate = null;
export function setInflator(fn) {
  customInflate = fn;
}

function inflateSync(input) {
  if (customInflate) {
    try {
      const res = customInflate(input);
      return res instanceof Uint8Array ? res : new Uint8Array(res.buffer, res.byteOffset, res.length);
    } catch (e) {
      // repli sur inflateStored
    }
  }
  return inflateStored(input);
}

// rgba : Uint8Array de width*height*4 octets → Uint8Array (PNG binaire)
export function encodePNG(width, height, rgba) {
  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, width);
  writeUint32BE(ihdr, 4, height);
  ihdr[8] = 8; // profondeur 8 bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression deflate
  ihdr[11] = 0; // filtre par défaut
  ihdr[12] = 0; // pas d'entrelacement

  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtre 0 (none)
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const idatData = deflateStore(raw);
  const cIHDR = makeChunk('IHDR', ihdr);
  const cIDAT = makeChunk('IDAT', idatData);
  const cIEND = makeChunk('IEND', new Uint8Array(0));

  const total = SIG.length + cIHDR.length + cIDAT.length + cIEND.length;
  const png = new Uint8Array(total);
  let off = 0;
  png.set(SIG, off); off += SIG.length;
  png.set(cIHDR, off); off += cIHDR.length;
  png.set(cIDAT, off); off += cIDAT.length;
  png.set(cIEND, off);
  return png;
}

export const pngToDataURL = (bytes) => DATA_URL_PREFIX + bytesToBase64(bytes);

export function dataURLToBuffer(url) {
  const bytes = dataURLToBytes(url);
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length) : bytes;
}

export function dataURLToBytes(url) {
  const m = /^data:image\/png;base64,(.*)$/s.exec(url || '');
  if (!m) throw new Error('not a PNG data URL');
  return base64ToBytes(m[1]);
}

// Lit seulement l'en-tête : { width, height } (rapide, pour la validation)
export function pngSize(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 24) throw new Error('invalid PNG signature');
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== SIG[i]) throw new Error('invalid PNG signature');
  }
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

// Décode un PNG 8 bits (gris, gris+alpha, RGB, palette, RGBA ; non entrelacé) → { width, height, data: Uint8Array RGBA }
export function decodePNG(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const { width, height } = pngSize(bytes);
  let pos = 8, colorType = 6, depth = 8, interlace = 0, palette = null, trns = null;
  const idatChunks = [];
  let idatTotal = 0;

  while (pos + 8 <= bytes.length) {
    const len = readUint32BE(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
      idatTotal += data.length;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (depth !== 8 || interlace) throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unsupported PNG colour type ' + colorType);

  const fullIdat = new Uint8Array(idatTotal);
  let idatOff = 0;
  for (const c of idatChunks) {
    fullIdat.set(c, idatOff);
    idatOff += c.length;
  }

  const raw = inflateSync(fullIdat);
  const bpp = channels;
  const stride = width * channels;
  const px = new Uint8Array(stride * height);

  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0;
      const b = y > 0 ? px[dst - stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[dst - stride + i - bpp] : 0;
      let v = raw[src + i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + i] = v & 0xff;
    }
  }

  // Normalisation en RGBA
  const rgba = new Uint8Array(width * height * 4);
  if (colorType === 6) {
    rgba.set(px);
  } else if (colorType === 2) {
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = px[i * 3];
      rgba[i * 4 + 1] = px[i * 3 + 1];
      rgba[i * 4 + 2] = px[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else if (colorType === 3) {
    if (!palette) throw new Error('indexed PNG missing PLTE chunk');
    for (let i = 0; i < width * height; i++) {
      const idx = px[i];
      rgba[i * 4] = palette[idx * 3] || 0;
      rgba[i * 4 + 1] = palette[idx * 3 + 1] || 0;
      rgba[i * 4 + 2] = palette[idx * 3 + 2] || 0;
      rgba[i * 4 + 3] = trns && trns[idx] !== undefined ? trns[idx] : 255;
    }
  } else if (colorType === 0) {
    for (let i = 0; i < width * height; i++) {
      const g = px[i];
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = 255;
    }
  } else if (colorType === 4) {
    for (let i = 0; i < width * height; i++) {
      const g = px[i * 2];
      const a = px[i * 2 + 1];
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = a;
    }
  }

  return { width, height, data: rgba };
}
