import { build } from 'esbuild';
import fs from 'node:fs';
await build({
  entryPoints: ['scripts/ads-wallet.mjs'], bundle: true, format: 'esm',
  minify: true, outfile: 'public/ads-wallet.js', legalComments: 'external',
});
const notices = 'public/ads-wallet.js.LEGAL.txt';
fs.writeFileSync(notices, fs.readFileSync(notices, 'utf8').replace(/[\t ]+$/gm, ''));
