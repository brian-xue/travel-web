const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string, saltHex: string, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt: fromHex(saltHex),
    },
    keyMaterial,
    256,
  );

  return toHex(new Uint8Array(bits));
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, saltHex, digest] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltHex || !digest) {
    return false;
  }
  const derived = await hashPassword(password, saltHex, Number(iterationsText));
  return derived === digest;
}
