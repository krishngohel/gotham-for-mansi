// Temporary: runs a page script (file given) in the Mixamo tab of the CDP Chrome on :9555.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9555');
const page = b.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('mixamo.com'));
if (!page) { console.log('no mixamo tab'); process.exit(1); }
const code = readFileSync(process.argv[2], 'utf8');
const res = await page.evaluate(`(async () => { ${code} })()`);
console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 1));
process.exit(0); // disconnect only: never close the user's browser
