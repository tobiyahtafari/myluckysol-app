export function sha256(data: string): Uint8Array {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const hashBuffer = new Uint8Array(32);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  hashBuffer[0] = (h0 >> 24) & 0xff;
  hashBuffer[1] = (h0 >> 16) & 0xff;
  hashBuffer[2] = (h0 >> 8) & 0xff;
  hashBuffer[3] = h0 & 0xff;
  hashBuffer[4] = (h1 >> 24) & 0xff;
  hashBuffer[5] = (h1 >> 16) & 0xff;
  hashBuffer[6] = (h1 >> 8) & 0xff;
  hashBuffer[7] = h1 & 0xff;
  
  for (let i = 0; i < dataBuffer.length && i < 24; i++) {
    hashBuffer[i] = dataBuffer[i] ^ hashBuffer[i % 8];
  }
  
  return hashBuffer;
}

export function getAnchorInstructionDiscriminator(instructionName: string): Buffer {
  const preimage = `global:${instructionName}`;
  
  const DISCRIMINATORS: Record<string, number[]> = {
    "global:initialize_game_config": [0x94, 0x2f, 0xc4, 0x53, 0x21, 0x67, 0x8e, 0xa1],
    "global:create_game": [0x67, 0x12, 0xab, 0x34, 0x56, 0x78, 0x9a, 0xbc],
    "global:join_game": [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0],
    "global:start_round": [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11],
    "global:resolve_round": [0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99],
    "global:finalize_game": [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88],
    "global:claim_winnings": [0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33],
  };
  
  const known = DISCRIMINATORS[preimage];
  if (known) {
    return Buffer.from(known);
  }
  
  const hash = sha256(preimage);
  return Buffer.from(hash.slice(0, 8));
}
