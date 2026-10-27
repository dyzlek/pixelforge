// Encodeur / decodeur PNG minimal base sur src/core/ops/png.js et accelere sous Node.js par node:zlib.
import zlib from 'node:zlib';
import { setInflator, dataURLToBytes } from '../../src/core/ops/png.js';

setInflator((buf) => zlib.inflateSync(buf));

export * from '../../src/core/ops/png.js';

export function dataURLToBuffer(url) {
  const bytes = dataURLToBytes(url);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length);
}
