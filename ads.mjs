import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import sharp from "sharp";

const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
// Public recipient supplied by the owner for the Solana Devnet demo.
export const DEFAULT_AD_RECIPIENT =
  "G5HvwjNTUJQTZa4yEUXPZxUf1a6kAEzpdovGHv5pJqqE";
export const slots = [
  {
    id: "bathroom",
    name: "Bathroom portrait",
    fallback: "/assets/bathroom-portrait.png",
  },
  {
    id: "corridor",
    name: "Grand corridor portrait",
    fallback: "/assets/corridor-portrait.png",
  },
];

export function verifiesPayment(tx, order) {
  if (
    !tx ||
    tx.meta?.err !== null ||
    !tx.blockTime ||
    tx.blockTime * 1000 < order.created - 30000
  )
    return false;
  const keys = tx.transaction.message.accountKeys;
  if (!keys.some((k) => k.signer && k.pubkey.toString() === order.payer))
    return false;
  const instructions = tx.transaction.message.instructions;
  const transfer = instructions.some(
    (i) =>
      i.programId?.toString() === SystemProgram.programId.toString() &&
      i.parsed?.type === "transfer" &&
      i.parsed.info.source === order.payer &&
      i.parsed.info.destination === order.recipient &&
      i.parsed.info.lamports === order.lamports,
  );
  const memo = instructions.some(
    (i) =>
      i.programId?.toString() === MEMO && i.parsed === `drishya-ad:${order.id}`,
  );
  return transfer && memo;
}

export function createAds({
  env = process.env,
  connection,
  now = Date.now,
} = {}) {
  const recipient = env.ADS_SOLANA_RECIPIENT ?? DEFAULT_AD_RECIPIENT;
  const lamports = Number(env.ADS_PRICE_LAMPORTS || 10000);
  const duration = Number(env.ADS_DURATION_HOURS || 24) * 3600000;
  const filename = env.ADS_DATA_FILE ? path.resolve(env.ADS_DATA_FILE) : null;
  const enabled = !!recipient && !!filename;
  if (recipient) new PublicKey(recipient);
  if (
    !Number.isSafeInteger(lamports) ||
    lamports <= 0 ||
    !Number.isSafeInteger(duration) ||
    duration <= 0
  )
    throw Error("Invalid ad price or duration");
  const rpc =
    connection ||
    new Connection(
      env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
      "finalized",
    );
  let orders =
    filename && fs.existsSync(filename)
      ? JSON.parse(fs.readFileSync(filename, "utf8"))
      : [];
  const save = () => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(orders), {
      mode: 0o600,
    });
    fs.renameSync(`${filename}.tmp`, filename);
  };
  const json = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  async function body(req) {
    let length = 0;
    const chunks = [];
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 3000000)
        throw Error("Image upload is too large (maximum 2 MB)");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  }
  async function devnet() {
    if ((await rpc.getGenesisHash()) !== GENESIS)
      throw Error("Payment RPC must be Solana Devnet");
  }
  const active = () => orders.find((o) => o.starts <= now() && o.ends > now());
  // Serializes activation and persistence after asynchronous RPC checks.
  let committing = Promise.resolve();
  return async function handleAds(req, res, url) {
    if (!url.pathname.startsWith("/api/ads")) return false;
    try {
      if (req.method === "GET" && url.pathname === "/api/ads") {
        json(res, 200, {
          enabled,
          network: "Solana Devnet",
          chain: "solana:devnet",
          recipient,
          lamports,
          durationHours: duration / 3600000,
          slots: slots.map((s) => ({
            ...s,
            image: active()
              ? `/api/ads/image/${active().id}/${s.id}`
              : s.fallback,
            bookedUntil: Math.max(
              now(),
              ...orders.filter((o) => o.ends).map((o) => o.ends),
            ),
          })),
        });
      } else if (
        req.method === "GET" &&
        url.pathname.startsWith("/api/ads/image/")
      ) {
        const parts = url.pathname.split("/");
        const order = orders.find(
          (o) => o.id === parts[4] && o.starts <= now() && o.ends > now(),
        );
        if (!order || !slots.some((s) => s.id === parts[5]))
          json(res, 404, { error: "Ad not active" });
        else {
          res.writeHead(200, {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          });
          res.end(Buffer.from(order.images[parts[5]], "base64"));
        }
      } else if (!enabled)
        json(res, 503, {
          error:
            "Ad checkout awaits the owner’s receiving wallet and persistent storage configuration.",
        });
      else if (req.method === "POST" && url.pathname === "/api/ads/orders") {
        const input = await body(req);
        const payer = new PublicKey(input.payer).toBase58();
        await devnet();
        const created = now();
        orders = orders.filter(
          (o) => o.signature || o.created > created - 86400000,
        );
        if (orders.filter((o) => !o.signature).length >= 100)
          throw Error("Checkout is busy. Try again later.");
        const order = {
          id: randomUUID(),
          uploadToken: randomUUID(),
          payer,
          recipient,
          lamports,
          duration,
          created,
        };
        const { blockhash, lastValidBlockHeight } =
          await rpc.getLatestBlockhash("finalized");
        const tx = new Transaction({
          feePayer: new PublicKey(payer),
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(payer),
            toPubkey: new PublicKey(recipient),
            lamports,
          }),
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey(MEMO),
            data: Buffer.from(`drishya-ad:${order.id}`),
          }),
        );
        orders.push(order);
        save();
        json(res, 201, {
          id: order.id,
          uploadToken: order.uploadToken,
          transaction: Buffer.from(
            await tx.serialize({ requireAllSignatures: false }),
          ).toString("base64"),
          lastValidBlockHeight,
        });
      } else if (req.method === "POST" && url.pathname === "/api/ads/confirm") {
        const { id, signature } = await body(req);
        const order = orders.find((o) => o.id === id);
        if (
          !order ||
          typeof signature !== "string" ||
          !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)
        )
          throw Error("Invalid order or transaction signature");
        if (order.signature && order.signature !== signature)
          throw Error("Order already paid");
        await devnet();
        const tx = await rpc.getParsedTransaction(signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        });
        if (!tx) {
          json(res, 202, { pending: true });
          return true;
        }
        if (!verifiesPayment(tx, order))
          throw Error("Transaction does not match this ad order");
        const commit = committing.then(() => {
          if (!order.signature) {
            if (orders.some((o) => o.signature === signature))
              throw Error("Payment already used");
            order.signature = signature;
            try {
              save();
            } catch (e) {
              delete order.signature;
              throw e;
            }
          }
          json(res, 200, {
            paid: true,
            uploaded: !!order.ends,
            starts: order.starts,
            ends: order.ends,
          });
        });
        committing = commit.catch(() => {});
        await commit;
      } else if (req.method === "POST" && url.pathname === "/api/ads/artwork") {
        const input = await body(req);
        const order = orders.find(
          (o) => o.id === input.id && o.uploadToken === input.uploadToken,
        );
        if (!order?.signature)
          throw Error("Confirm payment before uploading artwork");
        if (order.ends) {
          json(res, 200, { starts: order.starts, ends: order.ends });
          return true;
        }
        const images = {};
        for (const slot of slots) {
          const image = input.images?.[slot.id];
          if (
            typeof image !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
          )
            throw Error("Upload both images as PNG, JPEG or WebP");
          const bytes = Buffer.from(image.split(",")[1], "base64");
          if (bytes.length > 1000000)
            throw Error("Maximum image size is 1 MB per picture");
          images[slot.id] = (
            await sharp(bytes, { limitInputPixels: 16000000 })
              .rotate()
              .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
              .png()
              .toBuffer()
          ).toString("base64");
        }
        const commit = committing.then(() => {
          if (!order.ends) {
            order.starts = Math.max(
              now(),
              ...orders.filter((o) => o.ends).map((o) => o.ends),
            );
            order.ends = order.starts + order.duration;
            order.images = images;
            try {
              save();
            } catch (e) {
              delete order.starts;
              delete order.ends;
              delete order.images;
              throw e;
            }
          }
          json(res, 200, { starts: order.starts, ends: order.ends });
        });
        committing = commit.catch(() => {});
        await commit;
      } else json(res, 404, { error: "Unknown ad endpoint" });
    } catch (error) {
      json(res, 400, { error: error.message || "Ad checkout failed" });
    }
    return true;
  };
}
