import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { server, wss } from "../server.mjs";
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("test-results/ads", { recursive: true });
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(
    (await page.locator("#advertiseOption").textContent()).trim(),
    "Buy ad-space",
  );
  await page.locator("#advertiseOption").click();
  const frame = page.frameLocator("#advertiseDialog iframe");
  await frame
    .locator("#status")
    .filter({ hasText: "unavailable right now" })
    .waitFor();
  assert.equal(await frame.locator("#pay").isDisabled(), true);
  assert.equal(await frame.locator("#artwork").isHidden(), true);
  await page.screenshot({ path: "test-results/ads/popup-disabled.png" });
  await page.getByRole("button", { name: "CLOSE ×" }).click();
  await page.locator("#enter").click();
  await page.locator("#entryForm:not(.hidden)").waitFor();

  await context.addInitScript(() => {
    window.adWalletConnections = 0;
    window.adWalletPayments = 0;
    const account = {
      address: "11111111111111111111111111111112",
      chains: ["solana:devnet"],
      features: ["solana:signAndSendTransaction"],
      publicKey: new Uint8Array(32),
    };
    const wallet = {
      name: "MetaMask",
      chains: ["solana:devnet"],
      accounts: [account],
      version: "1.0.0",
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => {
            window.adWalletConnections++;
            return { accounts: [account] };
          },
        },
        "solana:signAndSendTransaction": {
          version: "1.0.0",
          signAndSendTransaction: async () => {
            window.adWalletPayments++;
            return [{ signature: new Uint8Array(64).fill(2) }];
          },
        },
      },
    };
    window.addEventListener("wallet-standard:app-ready", (e) =>
      e.detail.register(wallet),
    );
  });
  let paid = false,
    uploadCount = 0;
  await page.route("**/api/ads**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let status = 200,
      data;
    if (pathname === "/api/ads")
      data = {
        enabled: true,
        recipient: "11111111111111111111111111111112",
        lamports: 10000,
        durationHours: 24,
        slots: [{ bookedUntil: Date.now() }],
      };
    else if (pathname.endsWith("/orders")) {
      status = 201;
      data = {
        id: "test-order",
        uploadToken: "private-token",
        transaction: "AA==",
      };
    } else if (pathname.endsWith("/confirm"))
      data = paid ? { paid: true, uploaded: false } : { pending: true };
    else if (pathname.endsWith("/artwork")) {
      assert.equal(paid, true);
      const body = route.request().postDataJSON();
      assert.equal(body.uploadToken, "private-token");
      assert.match(body.images.bathroom, /^data:image\/png;base64,/);
      assert.match(body.images.corridor, /^data:image\/png;base64,/);
      uploadCount++;
      data = { starts: Date.now(), ends: Date.now() + 86400000 };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#advertiseOption").click();
  await frame.locator("#pay:not([disabled])").waitFor();
  assert.equal(await frame.locator("#artwork").isHidden(), true);
  assert.match(
    await frame.locator("#terms").textContent(),
    /Confirm paying 0\.00001 test SOL on Solana Devnet through your MetaMask wallet/,
  );
  assert.deepEqual(
    await frame
      .locator("body")
      .evaluate(() => [window.adWalletConnections, window.adWalletPayments]),
    [0, 0],
  );
  await page.screenshot({ path: "test-results/ads/popup-confirmation.png" });
  await frame.locator("#pay").click();
  await frame
    .locator("#status")
    .filter({ hasText: "Waiting for confirmation" })
    .waitFor();
  assert.equal(await frame.locator("#artwork").isHidden(), true);
  assert.deepEqual(
    await frame
      .locator("body")
      .evaluate(() => [window.adWalletConnections, window.adWalletPayments]),
    [1, 1],
  );
  paid = true;
  // Closing and reopening/reloading the popup restores the paid order.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#advertiseOption").click();
  await frame.locator("#artwork:not([hidden])").waitFor();
  const png = fs.readFileSync("public/assets/bathroom-portrait.png");
  for (const id of ["bathroom", "corridor"])
    await frame
      .locator(`#${id}`)
      .setInputFiles({ name: `${id}.png`, mimeType: "image/png", buffer: png });
  await frame.locator("#upload").click();
  await frame
    .locator("#status")
    .filter({ hasText: "Both pictures saved!" })
    .waitFor();
  assert.equal(uploadCount, 1);
  await page.screenshot({ path: "test-results/ads/popup-success.png" });
  await page.getByRole("button", { name: "CLOSE ×" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#advertiseOption").click();
  assert.equal(
    await frame
      .locator("body")
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
    true,
  );
  await page.screenshot({ path: "test-results/ads/popup-mobile.png" });
  await page.unroute("**/api/ads**");
  await page.route("**/api/ads**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Demo checkout unavailable" }),
    }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#advertiseOption").click();
  await frame
    .locator("#status")
    .filter({ hasText: "unavailable right now" })
    .waitFor();
  await page.getByRole("button", { name: "CLOSE ×" }).click();
  await page.locator("#enter").click();
  await page.locator("#entryForm:not(.hidden)").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Ad popup verified: optional loading, payment before two uploads, receipt recovery, mobile layout and checkout failure isolation. Wallet/RPC mocked.",
  );
} finally {
  await browser.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise((r) => wss.close(r));
  await new Promise((r) => server.close(r));
}
