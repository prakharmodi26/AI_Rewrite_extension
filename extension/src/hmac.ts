function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < u8.length; i++) {
    const h = u8[i].toString(16).padStart(2, '0');
    hex += h;
  }
  return hex;
}

export async function hmacSha256Hex(secretUtf8: string, data: string): Promise<string> {
  const secretBytes = utf8ToBytes(secretUtf8);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataBytes = utf8ToBytes(data);
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes as unknown as BufferSource);
  return bytesToHex(sig);
}

export const encoding = { utf8ToBytes, bytesToHex };
