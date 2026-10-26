// Encodeur / décodeur PNG minimal (RGBA 8 bits) basé sur node:zlib. Aucune dépendance.
import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// rgba : Uint8Array de width*height*4 octets → Buffer PNG
export function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtre « none »
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export const pngToDataURL = (buf) => DATA_URL_PREFIX + Buffer.from(buf).toString('base64');

export function dataURLToBuffer(url) {
  const m = /^data:image\/png;base64,(.*)$/s.exec(url || '');
  if (!m) throw new Error('not a PNG data URL');
  return Buffer.from(m[1], 'base64');
}

// Lit seulement l'en-tête : { width, height } (rapide, pour la validation)
export function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIG)) throw new Error('invalid PNG signature');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Décode un PNG 8 bits (gris, gris+alpha, RGB, palette, RGBA ; non entrelacé) → { width, height, data: Uint8Array RGBA }
export function decodePNG(buf) {
  const { width, height } = pngSize(buf);
  let pos = 8, colorType = 6, depth = 8, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { depth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unsupported PNG colour type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels, stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0;
      const b = y > 0 ? px[dst - stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[dst - stride + i - bpp] : 0;
      let v = raw[src + i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + i] = v & 0xff;
    }
  }
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (colorType === 6) { out[o] = px[i * 4]; out[o + 1] = px[i * 4 + 1]; out[o + 2] = px[i * 4 + 2]; out[o + 3] = px[i * 4 + 3]; }
    else if (colorType === 2) { out[o] = px[i * 3]; out[o + 1] = px[i * 3 + 1]; out[o + 2] = px[i * 3 + 2]; out[o + 3] = 255; }
    else if (colorType === 0) { out[o] = out[o + 1] = out[o + 2] = px[i]; out[o + 3] = 255; }
    else if (colorType === 4) { out[o] = out[o + 1] = out[o + 2] = px[i * 2]; out[o + 3] = px[i * 2 + 1]; }
    else {
      const k = px[i];
      out[o] = palette[k * 3]; out[o + 1] = palette[k * 3 + 1]; out[o + 2] = palette[k * 3 + 2];
      out[o + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { width, height, data: out };
}
