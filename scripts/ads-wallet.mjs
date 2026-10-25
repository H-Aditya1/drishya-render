import { getWallets } from "@wallet-standard/app";
import bs58 from "bs58";
import { createSolanaClient } from "@metamask/connect-solana";
const $ = (id) => document.getElementById(id);
const wallets = getWallets();
let config,
  busy = false;
async function api(path, body) {
  const response = await fetch(
    `/api/ads${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(
      data.error || "Checkout unavailable. Close this window to play normally.",
    );
  return data;
}
function pending() {
  try {
    return JSON.parse(localStorage.getItem("drishya-ad-payment-v2"));
  } catch {
    return null;
  }
}
function remember(value) {
  localStorage.setItem("drishya-ad-payment-v2", JSON.stringify(value));
}
function receipt(payment) {
  const link = document.createElement("a");
  link.href = `https://explorer.solana.com/tx/${payment.signature}?cluster=devnet`;
  link.textContent = "View Devnet payment receipt";
  link.target = "_blank";
  link.rel = "noopener";
  $("receipt").replaceChildren(link);
}
async function confirm(payment) {
  const result = await api("/confirm", payment);
  if (result.pending) {
    $("status").textContent =
      "Payment sent. Waiting for finalization. Check again below; you do not need to pay again.";
    return;
  }
  receipt(payment);
  $("retry").hidden = true;
  if (result.uploaded) {
    localStorage.removeItem("drishya-ad-payment-v2");
    $("status").textContent =
      "Your pictures are already saved. Close this window to play.";
    return;
  }
  payment.paid = true;
  remember(payment);
  $("artwork").hidden = false;
  $("status").textContent =
    "Payment verified. Upload both pictures below. If you close this window, reopen it in this browser to finish without paying again.";
}
async function load() {
  config = await api("");
  $("recipient").value =
    config.recipient || "Awaiting owner’s public Solana address";
  const bookedUntil = Math.max(...config.slots.map((s) => s.bookedUntil));
  $("terms").textContent =
    `${config.lamports / 1e9} test SOL covers BOTH pictures for ${config.durationHours} hours. ${bookedUntil > Date.now() + 1000 ? `Currently booked until ${new Date(bookedUntil).toLocaleString()}. Your pictures will queue next.` : "Your pictures appear after upload."} Purchases uploaded first run first.`;
  $("pay").textContent =
    `PAY ${config.lamports / 1e9} TEST SOL WITH METAMASK ↗`;
  $("status").textContent = config.enabled
    ? "Enable Solana Devnet in your MetaMask browser extension to begin."
    : "Demo payments need the owner’s public Solana address and persistent storage configured. Close this window to play normally.";
  $("pay").disabled = !config.enabled || !!pending();
  const saved = pending();
  if (saved?.signature) {
    $("retry").hidden = false;
    await confirm(saved);
  }
}
$("retry").addEventListener("click", async () => {
  if (busy || !pending()) return;
  busy = true;
  try {
    await confirm(pending());
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    busy = false;
    $("pay").disabled = !config?.enabled || !!pending();
  }
});
$("pay").addEventListener("click", async () => {
  if (busy || pending()) return;
  busy = true;
  $("pay").disabled = true;
  try {
    let wallet = wallets
      .get()
      .find(
        (w) =>
          w.name === "MetaMask" && w.features["solana:signAndSendTransaction"],
      );
    if (!wallet) {
      const client = await createSolanaClient({
        dapp: { name: "Drishya picture demo", url: window.location.href },
        api: { supportedNetworks: { devnet: "https://api.devnet.solana.com" } },
      });
      wallet = client.getWallet();
    }
    const { accounts } = await wallet.features["standard:connect"].connect();
    const supported = [
      "solana:devnet",
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    ];
    const account = accounts.find((a) =>
      a.chains.some((c) => supported.includes(c)),
    );
    const chain = account?.chains.find((c) => supported.includes(c));
    if (!account || !wallet.chains.includes(chain))
      throw Error(
        "Enable Solana Devnet in your MetaMask extension. Only test SOL is accepted.",
      );
    $("status").textContent =
      "Review the tiny Devnet payment and recipient in MetaMask.";
    const order = await api("/orders", { payer: account.address });
    localStorage.setItem("drishya-ad-storage-test", "ok");
    localStorage.removeItem("drishya-ad-storage-test");
    const [{ signature }] = await wallet.features[
      "solana:signAndSendTransaction"
    ].signAndSendTransaction({
      account,
      chain,
      transaction: Uint8Array.from(atob(order.transaction), (c) =>
        c.charCodeAt(0),
      ),
    });
    const payment = {
      id: order.id,
      uploadToken: order.uploadToken,
      signature: bs58.encode(signature),
    };
    remember(payment);
    $("retry").hidden = false;
    await confirm(payment);
  } catch (e) {
    $("status").textContent =
      e.message || "Wallet request cancelled. Try again when ready.";
  } finally {
    busy = false;
    $("pay").disabled = !config?.enabled || !!pending();
  }
});
const read = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
for (const id of ["bathroom", "corridor"]) {
  let previewUrl;
  $(id).addEventListener("change", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = $(id).files[0];
    $(id + "Preview").hidden = !file;
    if (file) $(id + "Preview").src = previewUrl = URL.createObjectURL(file);
  });
}
$("artwork").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $("upload").disabled = true;
  try {
    const images = {};
    for (const id of ["bathroom", "corridor"]) {
      const file = $(id).files[0];
      if (!file || file.size > 1000000)
        throw Error("Choose two pictures, each up to 1 MB.");
      images[id] = await read(file);
    }
    const result = await api("/artwork", { ...pending(), images });
    localStorage.removeItem("drishya-ad-payment-v2");
    $("artwork").hidden = true;
    $("status").textContent =
      `Both pictures saved! They run from ${new Date(result.starts).toLocaleString()} to ${new Date(result.ends).toLocaleString()}. Close this window and play. Active pictures refresh in the game within 30 seconds.`;
  } catch (e) {
    $("status").textContent =
      e.message || "Upload failed. Your payment is saved; try uploading again.";
  } finally {
    busy = false;
    $("upload").disabled = false;
  }
});
load().catch((e) => {
  $("status").textContent =
    `${e.message} You can close this window and play normally.`;
});
