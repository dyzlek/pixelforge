// Encodeur WAV PCM 16-bit stereo/mono en pur JavaScript (sans dependance externe)

export function encodeWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Helper pour ecrire des chaines ASCII
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 1. En-tete RIFF
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // 2. Sous-morceau "fmt "
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);             // Longueur du sous-morceau fmt (16 pour PCM)
  view.setUint16(20, 1, true);              // Format audio : 1 = PCM lineaire
  view.setUint16(22, numChannels, true);    // Nombre de canaux
  view.setUint32(24, sampleRate, true);     // Frequence d'echantillonnage
  view.setUint32(28, byteRate, true);       // Debit octets/seconde
  view.setUint16(32, blockAlign, true);     // Alignement de bloc
  view.setUint16(34, 16, true);             // Bits par echantillon (16-bit)

  // 3. Sous-morceau "data"
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // 4. Entrelacement des echantillons PCM 16-bit signes (-32768 a 32767)
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      // Conversion float32 [-1, 1] en int16 signe
      const int16 = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, int16 | 0, true);
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

export function audioBufferToWavBlob(audioBuffer) {
  const bytes = encodeWav(audioBuffer);
  return new Blob([bytes], { type: 'audio/wav' });
}

export function audioBufferToDataUrl(audioBuffer) {
  const bytes = encodeWav(audioBuffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = (typeof btoa !== 'undefined')
    ? btoa(binary)
    : (typeof Buffer !== 'undefined' ? Buffer.from(binary, 'binary').toString('base64') : '');
  return `data:audio/wav;base64,${base64}`;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

