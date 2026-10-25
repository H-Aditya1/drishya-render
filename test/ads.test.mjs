import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createAds, verifiesPayment } from "../ads.mjs";
import { spawn } from "node:child_process";

const payer = (await Keypair.generate()).publicKey.toBase58();
const recipient = (await Keypair.generate()).publicKey.toBase58();
const time = Date.now();
test("invalid advertising configuration leaves the game server available", async () => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import { server } from './server.mjs'; server.listen(0, '127.0.0.1', () => console.log(server.address().port));",
    ],
    {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, ADS_SOLANA_RECIPIENT: "invalid-wallet" },
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Game server did not start")),
        10000,
      );
      child.stdout.once("data", (data) => {
        clearTimeout(timeout);
        resolve(Number(data.toString().trim()));
      });
      child.once("error", reject);
    });
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base + "/metrics")).status, 200);
    assert.equal((await fetch(base + "/")).status, 200);
    assert.equal((await fetch(base + "/api/ads")).status, 503);
  } finally {
    child.kill();
  }
});
function payment(order) {
  return {
    meta: { err: null },
    blockTime: Math.floor(time / 1000),
    transaction: {
      message: {
        accountKeys: [{ pubkey: payer, signer: true }],
        instructions: [
          {
            programId: SystemProgram.programId.toBase58(),
            parsed: {
              type: "transfer",
              info: { source: payer, destination: recipient, lamports: 10000 },
            },
          },
          {
            programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            parsed: `drishya-ad:${order.id}`,
          },
        ],
      },
    },
  };
}
test("payment verification rejects failed, stale, unsigned, incorrect-recipient/price/memo payments", () => {
  const order = {
    id: "demo",
    payer,
    recipient,
    lamports: 10000,
    created: time,
  };
  assert.equal(verifiesPayment(payment(order), order), true);
  for (const mutate of [
    (t) => {
      t.meta.err = {};
    },
    (t) => {
      t.blockTime -= 60;
    },
    (t) => {
      t.transaction.message.accountKeys[0].signer = false;
    },
    (t) => {
      t.transaction.message.instructions[0].parsed.info.destination = payer;
    },
    (t) => {
      t.transaction.message.instructions[0].parsed.info.lamports = 1;
    },
    (t) => {
      t.transaction.message.instructions[1].parsed = "other-order";
    },
  ]) {
    const tx = payment(order);
    mutate(tx);
    assert.equal(verifiesPayment(tx, order), false);
  }
});

async function serve(handler) {
  const server = http.createServer((req, res) =>
    handler(req, res, new URL(req.url, "http://local")),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/ads`;
  return {
    server,
    base,
    request: async (route = "", body) => {
      const response = await fetch(
        base + route,
        body ? { method: "POST", body: JSON.stringify(body) } : {},
      );
      return { status: response.status, data: await response.json() };
    },
  };
}
test("default recipient is visible but checkout still requires storage", async () => {
  const app = await serve(createAds({ env: {} }));
  try {
    const config = (await app.request()).data;
    assert.equal(config.enabled, false);
    assert.equal(
      config.recipient,
      "G5HvwjNTUJQTZa4yEUXPZxUf1a6kAEzpdovGHv5pJqqE",
    );
    assert.equal((await app.request("/orders", {})).status, 503);
  } finally {
    await new Promise((r) => app.server.close(r));
  }
});
test("default checkout transaction pays the owner-supplied address on Devnet", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "drishya-recipient-"));
  const connection = {
    getGenesisHash: async () => "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    getLatestBlockhash: async () => ({
      blockhash: (await Keypair.generate()).publicKey.toBase58(),
      lastValidBlockHeight: 123,
    }),
  };
  const app = await serve(
    createAds({
      env: { ADS_DATA_FILE: path.join(folder, "orders.json") },
      connection,
    }),
  );
  try {
    const config = (await app.request()).data;
    assert.equal(config.enabled, true);
    assert.equal(config.network, "Solana Devnet");
    const result = await app.request("/orders", { payer });
    assert.equal(result.status, 201);
    const transaction = Transaction.from(
      Buffer.from(result.data.transaction, "base64"),
    );
    assert.equal(
      transaction.instructions[0].keys[1].pubkey.toBase58(),
      "G5HvwjNTUJQTZa4yEUXPZxUf1a6kAEzpdovGHv5pJqqE",
    );
    assert.equal(
      Buffer.from(transaction.instructions[0].data).readBigUInt64LE(4),
      10000n,
    );
  } finally {
    await new Promise((r) => app.server.close(r));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
test("orders sanitize images, verify finalized payment, resist replay, queue slots and survive restart", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "drishya-ads-"));
  const filename = path.join(folder, "orders.json");
  const env = { ADS_SOLANA_RECIPIENT: recipient, ADS_DATA_FILE: filename };
  const signatures = new Map();
  const connection = {
    getGenesisHash: async () => "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    getLatestBlockhash: async () => ({
      blockhash: (await Keypair.generate()).publicKey.toBase58(),
      lastValidBlockHeight: 123,
    }),
    getParsedTransaction: async (sig) => signatures.get(sig) || null,
  };
  let clock = time;
  const app = await serve(createAds({ env, connection, now: () => clock }));
  let reopened;
  try {
    const image =
      "data:image/png;base64," +
      (
        await sharp({
          create: { width: 10, height: 20, channels: 3, background: "red" },
        })
          .png()
          .toBuffer()
      ).toString("base64");
    const input = { payer };
    const first = await app.request("/orders", input);
    assert.equal(first.status, 201);
    const artwork = {
      id: first.data.id,
      uploadToken: first.data.uploadToken,
      images: { bathroom: image, corridor: image },
    };
    assert.equal((await app.request("/artwork", artwork)).status, 400);
    const tx = Transaction.from(Buffer.from(first.data.transaction, "base64"));
    assert.equal(tx.feePayer.toBase58(), payer);
    assert.equal(tx.instructions.length, 2);
    const signature = "2".repeat(88);
    assert.equal(
      (await app.request("/confirm", { id: first.data.id, signature })).status,
      202,
    );
    signatures.set(signature, payment(first.data));
    const paid = await app.request("/confirm", {
      id: first.data.id,
      signature,
    });
    assert.equal(paid.data.paid, true);
    assert.deepEqual(
      (await app.request("/confirm", { id: first.data.id, signature })).data,
      paid.data,
    );
    assert.equal(
      (await app.request("/artwork", { ...artwork, uploadToken: "wrong" }))
        .status,
      400,
    );
    assert.equal(
      (
        await app.request("/artwork", {
          ...artwork,
          images: { bathroom: image },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await app.request("/artwork", {
          ...artwork,
          images: { bathroom: image, corridor: "data:image/png;base64,YmFk" },
        })
      ).status,
      400,
    );
    const booking = (await app.request("/artwork", artwork)).data;
    assert.equal(booking.starts, time);
    assert.deepEqual((await app.request("/artwork", artwork)).data, booking);
    const active = (await app.request()).data.slots[0];
    assert.equal(active.image, `/api/ads/image/${first.data.id}/bathroom`);
    assert.match((await app.request()).data.slots[1].image, /corridor$/);
    const png = await fetch(app.base + `/image/${first.data.id}/bathroom`);
    assert.equal(png.headers.get("content-type"), "image/png");
    assert.equal(
      (await sharp(Buffer.from(await png.arrayBuffer())).metadata()).width,
      10,
    );
    const second = (await app.request("/orders", input)).data;
    assert.equal(
      (await app.request("/confirm", { id: second.id, signature })).status,
      400,
    );
    const signature2 = "3".repeat(88);
    signatures.set(signature2, payment(second));
    await app.request("/confirm", { id: second.id, signature: signature2 });
    const queued = (
      await app.request("/artwork", {
        id: second.id,
        uploadToken: second.uploadToken,
        images: artwork.images,
      })
    ).data;
    assert.equal(queued.starts, booking.ends);
    reopened = await serve(createAds({ env, connection, now: () => clock }));
    assert.equal((await reopened.request()).data.slots[0].image, active.image);
    clock = queued.ends + 1;
    assert.equal(
      (await reopened.request()).data.slots[0].image,
      "/assets/bathroom-portrait.png",
    );
    connection.getGenesisHash = async () => "mainnet";
    assert.match((await app.request("/orders", input)).data.error, /Devnet/);
  } finally {
    await new Promise((r) => app.server.close(r));
    if (reopened) await new Promise((r) => reopened.server.close(r));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
