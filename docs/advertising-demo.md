# Picture-frame advertising demo

The small **Place your pictures · Devnet demo** option on the home screen opens a separate popup. Pay **0.00001 test SOL** plus the network fee with MetaMask, then upload **two** pictures: bathroom and corridor end. One payment covers both for 24 hours by default. Upload fields unlock only after server verification. Each picture can be PNG, JPEG or WebP up to 1 MB. The server decodes, resizes and re-encodes artwork as PNG.

The game refreshes active pictures every 30 seconds and preserves the existing portrait tint and secret passage. Original pictures remain when no booking is active. The wallet bundle loads only inside the popup; checkout/network/configuration failures do not block normal gameplay. Close the popup at any time to play.

## What you need to do

1. Install/update the **MetaMask browser extension**. Create or select a **Solana account**, enable **Devnet** in its network settings, and copy its **public Solana address**. An Ethereum `0x…` address cannot receive these payments. Never put a recovery phrase or private key in the app or Render.
2. Get free test SOL for the buyer account from the [Solana faucet](https://faucet.solana.com/). For a clear demonstration, use a second account as the buyer and your first account as the recipient. Test SOL has no monetary value.
3. In the Render service for this repo, use `npm ci --include=dev && npm run build:ads` as the build command and `npm start` as the start command. The wallet bundle is also committed; there is no browser CDN dependency.
4. For a quick test-SOL-only demo, set `ADS_DATA_FILE=/tmp/drishya-demo-ads.json`. **This temporary demo store can disappear when Render restarts/redeploys**, resetting pictures, bookings and payment recovery. For retained bookings, attach persistent storage at `/var/data` and set `ADS_DATA_FILE=/var/data/drishya-ads.json` instead. Use one service instance; the local JSON journal does not support shared writes from multiple instances.
5. The owner supplied `G5HvwjNTUJQTZa4yEUXPZxUf1a6kAEzpdovGHv5pJqqE` as the default public receiving address. `ADS_SOLANA_RECIPIENT` overrides it if set in Render; remove any stale override or set it to this address. An explicitly empty value disables checkout. Optionally set `ADS_PRICE_LAMPORTS` (default `10000`, or 0.00001 test SOL), `ADS_DURATION_HOURS` (default `24`; use `0.016666666666666666` for a one-minute demo), and `SOLANA_DEVNET_RPC_URL` for a dedicated Devnet RPC. The public RPC may throttle requests.
6. Redeploy. Open **Place your pictures · Devnet demo** on the homepage. Review the price/recipient, connect MetaMask, and approve the Devnet transfer. Use **Check previous payment** until it finalizes. Then upload both images and click **Use these two pictures**. Close the popup and play; active images appear within 30 seconds.

The recipient is configured in the repository. Checkout still requires `ADS_DATA_FILE` in Render; until a storage path is configured, the page explains the missing setup and prevents payment. This is a Devnet-only demo: the server checks the RPC genesis hash and refuses other networks. It does not charge real SOL or provide a mainnet checkout.

## Local demo

PowerShell, in this repo:

```powershell
npm ci --include=dev
$env:ADS_SOLANA_RECIPIENT = 'G5HvwjNTUJQTZa4yEUXPZxUf1a6kAEzpdovGHv5pJqqE'
$env:ADS_DATA_FILE = Join-Path $PWD 'ad-data/bookings.json'
npm start
```

`.env.example` documents the settings; Node does not load `.env` automatically. Set environment variables in PowerShell or Render.

## Booking and payment behavior

The server creates a unique order and a serialized Solana transfer with an order-specific memo. It accepts payment only after a finalized transaction matches the sender, recipient, exact price, memo and order creation time. A transaction cannot fund a second order. After payment, a private upload token authorizes the two images. The browser stores the order, token and signature locally so reopening the popup or refreshing can resume without a second payment. Do not clear this site's browser storage until both pictures are saved.

Bookings cover both frames together and run consecutively in upload-completion order. If the frames are occupied, the next purchase queues after that period; the popup explains this before payment. A successful upload shows the assigned start/end times. Use a one-minute duration for repeated demonstrations. There is no automatic refund or cancellation UI. Unpaid orders expire after 24 hours when new orders are created; confirm paid orders promptly. Back up the journal containing paid artwork and payment references. Add moderation and retention controls before using this demonstration as a public advertising service.

## Validation limits

Automated tests exercise payment matching, failed/wrong/replayed payments, booking queues, image handling, storage reload, and disabled checkout using a mocked RPC. A real MetaMask/Devnet payment requires the owner’s public recipient address, a funded buyer account, and an extension interaction. See [MetaMask’s platform support](https://github.com/MetaMask/metamask-docs/blob/main/metamask-connect/supported-platforms.md) and [Solana’s transaction RPC](https://solana.com/docs/rpc/http/gettransaction).

Current verification: 28 unit/server tests pass, and the popup browser checks pass for payment-before-upload, two uploads, restored receipts, mobile layout, and failure isolation. The broader pre-existing `test/browser.mjs` run failed its `canMove` assertion after a viewpoint exchange (line 262); a complete game browser regression pass is not claimed.
