const { chromium } = require('playwright');

// Mock EIP-6963 wallet injection BEFORE app loads
const MOCK_WALLET = `
window.__rk_test = true;
const ACC = '0x1234567890abcdef1234567890abcdef12345678';
const PRIV = '0x' + '11'.repeat(32);
async function sign(msg) {
  // deterministic fake sig
  return '0x' + Array.from({length:130}, (_,i)=> (i%16).toString(16)).join('');
}
const provider = {
  request: async ({ method, params }) => {
    switch(method){
      case 'eth_requestAccounts':
      case 'eth_accounts': return [ACC];
      case 'eth_chainId': return '0x279f'; // 10143 monad testnet
      case 'personal_sign': return await sign(params[0]);
      case 'eth_sign': return await sign(params[1] || params[0]);
      case 'wallet_switchEthereumChain': return null;
      default: return null;
    }
  },
  on: () => {}, removeListener: () => {},
};
const w = { uuid:'rk-test', name:'TestWallet', icon:'data:,', rdns:'test', provider };
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: w }));
window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: w }));
});
window.ethereum = provider;
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const logs = [];
  page.on('console', m => logs.push('CONSOLE: ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERR: ' + e.message));

  // inject mock before any script
  await page.addInitScript(MOCK_WALLET);

  const results = [];
  const ok = (n, c) => results.push((c ? 'PASS' : 'FAIL') + ' :: ' + n);

  await page.goto('https://fokusle.vercel.app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. SPLASH visible
  const splashTxt = await page.locator('text=onchain').count();
  ok('Splash quote shows', splashTxt > 0);
  // tap splash
  await page.mouse.click(195, 400);
  await page.waitForTimeout(800);

  // 2. CONNECT screen -> "Are you ready to lock in?"
  const readyTxt = await page.locator('text=Are you ready to lock in?').count();
  ok('Connect screen text', readyTxt > 0);

  // 3. Connect wallet (RainbowKit ConnectButton)
  // click the Connect button (RainbowKit renders a button with text Connect)
  const connectBtn = page.locator('button:has-text("Connect")').first();
  await connectBtn.click();
  await page.waitForTimeout(2500); // auto-sign effect

  // 4. App loaded (should be authed after auto-sign)
  const lockInBtn = await page.locator('button:has-text("Lock in")').count();
  ok('Auto-sign -> app (Lock in visible)', lockInBtn > 0);

  // 5. Display name fallback shows @handle (not full addr)
  const headerTxt = await page.locator('text=@0x12').count();
  ok('Header shows @handle fallback', headerTxt > 0);

  // 6. Lock in -> popup wide (no emoji)
  if (lockInBtn > 0) {
    await page.locator('button:has-text("Lock in")').click();
    await page.waitForTimeout(400);
    const popup = await page.locator('text=Locked in').count();
    ok('Lock-in popup shows', popup > 0);
    const emoji = await page.locator('text=🔒').count();
    ok('No 🔒 emoji in popup', emoji === 0);
  }

  // 7. Set nickname via Settings -> Account
  await page.locator('button:has-text("Profile")').first().click().catch(()=>{});
  await page.waitForTimeout(500);
  // go to settings (gear)
  const gear = page.locator('div[onClick]:has(svg)').last();
  // navigate settings tab via tab bar
  await page.locator('text=Profile').first().click().catch(()=>{});
  await page.waitForTimeout(500);
  // click gear to open settings
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter(d => d.textContent === 'Profile' && d.querySelector('svg'));
    // find settings gear: usually top-right of profile
  });
  // Try direct: click Settings tab if present
  const settingsTab = page.locator('text=Settings').first();
  if (await settingsTab.count() > 0) { await settingsTab.click(); await page.waitForTimeout(500); }

  const nickInput = page.locator('input[placeholder*="Nickname"]').first();
  ok('Nickname input present', await nickInput.count() > 0);
  if (await nickInput.count() > 0) {
    await nickInput.fill('AsaTest');
    await page.locator('button:has-text("Save")').first().click();
    await page.waitForTimeout(4000); // wait for async save + refetch
    const saved = await page.locator('text=AsaTest').count();
    ok('Nickname saved & displayed (AsaTest visible)', saved > 0);
    const stillAddr = await page.locator('text=@0x12').count();
    ok('Header no longer @handle after save', stillAddr === 0);
  }

  // 8. Share modal compact (width 260)
  // trigger finish would need timer; skip onchain. Just check modal element style if opened.
  // We'll check the share modal width by opening via profile download path is complex; report structural.

  console.log('=== TEST RESULTS ===');
  results.forEach(r => console.log(r));
  console.log('=== PAGE LOGS (errors only) ===');
  logs.filter(l => l.includes('PAGEERR') || l.includes('error')).slice(0,10).forEach(l => console.log(l));
  console.log('TOTAL:', results.length, 'PASS:', results.filter(r=>r.startsWith('PASS')).length);

  await browser.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
