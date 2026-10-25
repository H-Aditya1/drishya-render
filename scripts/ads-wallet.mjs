import { getWallets } from "@wallet-standard/app";
import bs58 from "bs58";
import { createSolanaClient } from "@metamask/connect-solana";
const $ = (id) => document.getElementById(id);
const wallets = getWallets();
function status(message) {
  $("status").textContent = message;
  $("status").hidden = !message;
}
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
    throw Error(data.error || "Could not reach ad checkout. Please try again.");
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
  link.textContent = "View payment";
  link.target = "_blank";
  link.rel = "noopener";
  $("receipt").replaceChildren(link);
}
async function confirm(payment) {
  const result = await api("/confirm", payment);
  if (result.pending) {
    $("confirmation").hidden = true;
    status("Payment sent. Waiting for confirmation. Check again below.");
    return;
  }
  receipt(payment);
  $("confirmation").hidden = true;
  $("retry").hidden = true;
  if (result.uploaded) {
    localStorage.removeItem("drishya-ad-payment-v2");
    status("Your pictures are saved.");
    return;
  }
  payment.paid = true;
  remember(payment);
  $("artwork").hidden = false;
  status("");
}
async function load() {
  config = await api("");
  const bookedUntil = Math.max(...config.slots.map((s) => s.bookedUntil));
  $("terms").textContent =
    `Confirm paying ${config.lamports / 1e9} test SOL on Solana Devnet through your MetaMask wallet for ${config.durationHours} hours of ad-space?`;
  $("queue").hidden = bookedUntil <= Date.now() + 1000;
  $("queue").textContent =
    `Next available from ${new Date(bookedUntil).toLocaleString()}.`;
  status(
    config.enabled
      ? ""
      : config.disabledReason || "Ad payments are disabled by the owner.",
  );
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
    status(e.message);
  } finally {
    busy = false;
    $("pay").disabled = !config?.enabled || !!pending();
  }
});
$("pay").addEventListener("click", async () => {
  if (busy || pending()) return;
  busy = true;
  $("pay").disabled = true;
  status("Connecting to MetaMask…");
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
    status("Confirm the payment in MetaMask.");
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
    status(e.message || "Payment cancelled. Try again when ready.");
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
    status(
      `Both pictures saved! ${result.starts > Date.now() + 1000 ? `They appear from ${new Date(result.starts).toLocaleString()}.` : "They will appear in the game within 30 seconds."}`,
    );
  } catch (e) {
    status(
      e.message || "Upload failed. Your payment is saved; try uploading again.",
    );
  } finally {
    busy = false;
    $("upload").disabled = false;
  }
});
load().catch(() => {
  $("confirmation").hidden = true;
  status("Could not load ad checkout. Please reopen this window to try again.");
});
