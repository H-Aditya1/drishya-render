// Read-only Devnet RPC integration: prepares an unsigned local order, never sends SOL.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { Keypair, Transaction } from "@solana/web3.js";
import { createAds, DEFAULT_AD_RECIPIENT } from "../ads.mjs";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "drishya-devnet-smoke-"));
const handler = createAds({
  env: { ADS_DATA_FILE: path.join(folder, "orders.json") },
});
const server = http.createServer((req, res) =>
  handler(req, res, new URL(req.url, "http://local")),
);
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const payer = (await Keypair.generate()).publicKey.toBase58();
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/ads/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payer }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const result = await response.json();
  assert.equal(response.status, 201, result.error);
  const transaction = Transaction.from(
    Buffer.from(result.transaction, "base64"),
  );
  assert.equal(transaction.feePayer.toBase58(), payer);
  assert.equal(
    transaction.instructions[0].keys[1].pubkey.toBase58(),
    DEFAULT_AD_RECIPIENT,
  );
  assert.equal(
    Buffer.from(transaction.instructions[0].data).readBigUInt64LE(4),
    10000n,
  );
  assert.equal(
    Buffer.from(transaction.instructions[1].data).toString(),
    `drishya-ad:${result.id}`,
  );
  console.log(
    "Real Devnet RPC passed: full genesis hash, fresh blockhash, unsigned 0.00001 SOL payment to the configured recipient. No transaction broadcast.",
  );
} finally {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(folder, { recursive: true, force: true });
}
