// Renders App Store screenshots and the IAP review screenshot from the CURRENT index.html by playing the game.
// No state is faked for the store shots: a bot plays a full year (first enabled answer each time) and
// candidate frames are saved at the moments we want; the best are then copied into ../screenshots/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=<path to playwright> node app/store/tools/render_store.js <outdir> <W> <H> [year|paywall]
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = process.argv[2], W = +process.argv[3], H = +process.argv[4], MODE = process.argv[5] || 'year';
const TIPS = ['journal', 'start', 'night', 'treasury', 'war', 'mason', 'agents', 'council', 'report', 'family', 'dungeon'];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: false });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  await p.evaluate(([tips, pro]) => { localStorage.clear(); localStorage.setItem('ef_tips', JSON.stringify(tips)); localStorage.setItem('ef_prefs', JSON.stringify({ sp: 'instant' })); if (pro) localStorage.setItem('ef_pro', '1'); }, [TIPS, MODE === 'year']);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(3000);
  await p.addStyleTag({ content: '#toast{display:none!important}' });
  const shot = async (name) => { await p.waitForTimeout(900); const f = path.join(OUT, name + '.png'); await p.screenshot({ path: f }); console.log('shot', name); };
  if (MODE === 'year') await shot('title');
  await p.evaluate(() => { Math.random = (() => { let q = 11; return () => (q = q * 16807 % 2147483647) / 2147483647 })(); newGame(); });
  const done = {}; let throneN = 0, nightN = 0, battleN = 0, voteN = 0, lastSpeaker = null;
  for (let i = 0; i < 20000; i++) {
    const st = await p.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' };
      const q = s => document.querySelector(s);
      return { month: S && S.month, modal: vis('modal'), overlay: vis('overlay'), card: vis('card'), buy: !!q('#buyBtn'), plSkip: !!q('#plSkip'),
        nextBtn: !!q('#nextBtn'), nextWait: !!q('#nextBtn.wait'), ovBtn: !!q('#overlay button.pb'), ending: /AN ENDING/.test((q('#overlay .ovb') || {}).textContent || ''),
        ch: [...document.querySelectorAll('#choices .ch')].map(b => ({ t: b.textContent, go: b.classList.contains('go'), dis: b.disabled })),
        walking: !!(SC.walker && Math.abs(SC.walker.target - SC.walker.x) > 1), room: SC.room, speaker: SC.speaker, bt: typeof BT !== 'undefined' && BT.on, btPhase: typeof BT !== 'undefined' && BT.phase,
        role: (q('#role') || {}).textContent, pbox: vis('pbox'), who: (q('#who') || {}).textContent, warmap: !!q('#wmGo') };
    });
    if (st.buy) { if (MODE === 'paywall') { await p.waitForTimeout(2500); await shot('iap-paywall'); } else console.log('unexpected paywall'); break; }
    if (st.ending) { await p.waitForTimeout(2500); await shot('ending'); console.log('ending at month', st.month); break; }
    if (st.card) { await p.waitForTimeout(200); continue; }
    if (st.modal) { await p.evaluate(() => { const e = document.querySelector('#modal button.pb') || document.querySelector('#modal button'); e && e.click() }); continue; }
    if (st.overlay) {
      if (st.plSkip) { await p.evaluate(() => document.getElementById('plSkip')?.click()); continue; }
      if (st.nextBtn) {
        if (MODE === 'year' && !done['night' + st.month] && nightN < 6) { done['night' + st.month] = 1; nightN++; await p.waitForTimeout(1500); await shot(`night-m${st.month}`);
          if (st.month >= 2 && !done.world1 && st.month <= 4) { done.world1 = 1; await p.evaluate(() => openWorld()); await p.waitForTimeout(2000); await shot(`world-m${st.month}`); await p.evaluate(() => document.getElementById('wmClose')?.click()); await p.waitForTimeout(500); continue; }
          if (st.month >= 9 && !done.world2) { done.world2 = 1; await p.evaluate(() => openWorld()); await p.waitForTimeout(2000); await shot(`world-m${st.month}`); await p.evaluate(() => document.getElementById('wmClose')?.click()); await p.waitForTimeout(500); continue; } }
        if (st.nextWait) await p.evaluate(() => document.querySelector('#overlay .room.req')?.click()); else await p.evaluate(() => document.getElementById('nextBtn')?.click());
        await p.waitForTimeout(400); continue; }
      if (st.warmap && MODE === 'year' && !done['war' + st.month]) { done['war' + st.month] = 1; await p.waitForTimeout(2600); await shot(`warmap-m${st.month}`); }
      if (st.ovBtn) { await p.waitForTimeout(300); await p.evaluate(() => { const e = document.querySelector('#overlay button.pb'); e && e.click() }); await p.waitForTimeout(300); continue; }
    }
    const en = st.ch.filter(c => !c.dis);
    if (st.walking) { await p.evaluate(() => document.getElementById('dialog')?.click()); await p.waitForTimeout(150); continue; }
    if (en.length) {
      const opts = en.filter(c => !c.go);
      if (MODE === 'year' && opts.length >= 2) {
        if (!st.room && !st.bt && st.pbox && st.who && st.who !== lastSpeaker && throneN < 10 && st.month <= 4) { throneN++; lastSpeaker = st.who; await shot(`throne-${throneN}-m${st.month}-${st.who.replace(/\W+/g, '_')}`); }
        if (st.bt && battleN < 6 && !done['bt' + st.btPhase]) { done['bt' + st.btPhase] = 1; battleN++; await p.waitForTimeout(1200); await shot(`battle-${battleN}-${st.btPhase}`); }
      }
      if (MODE === 'year' && /For you \d+ · For Corvin \d+/.test(st.role || '') && voteN < 4) { const m = st.role.match(/(\d+) · For Corvin (\d+)/); if (+m[1] + +m[2] >= 4 && !done['v' + m[1] + m[2]]) { done['v' + m[1] + m[2]] = 1; voteN++; await shot(`vote-${voteN}`); } }
      const leave = en.find(c => c.go && /^Leave/.test(c.t));
      if (opts.length && !leave) await p.evaluate(() => { const bs = [...document.querySelectorAll('#choices .ch:not(.go):not([disabled])')];
        const bad = /kneel|knee|swear|oath|surrender|flee|tunnel|white (flag|banner)|parley|yield|fall back/i; (bs.find(b => !bad.test(b.textContent)) || bs[0])?.click(); });
      else await p.evaluate(() => document.querySelector('#choices .go')?.click());
      await p.waitForTimeout(120); continue;
    }
    if (st.bt && MODE === 'year' && battleN < 8 && !done['btx' + st.btPhase]) { done['btx' + st.btPhase] = 1; battleN++; await p.waitForTimeout(1500); await shot(`battle-${battleN}-${st.btPhase}-reply`); }
    await p.evaluate(() => document.getElementById('dialog')?.click()); await p.waitForTimeout(200);
  }
  await b.close();
})();
