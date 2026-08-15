#!/usr/bin/env node

import crypto from "node:crypto";

const password = process.argv[2];
const iterations = Number(process.argv[3] || 210000);

if (!password) {
  console.error(
    "Usage: node scripts/generate-password.js <password> [iterations]"
  );
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");

const hash = crypto
  .pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    iterations,
    32,
    "sha256"
  )
  .toString("hex");

console.log(`pbkdf2_sha256$${iterations}$${salt}$${hash}`);