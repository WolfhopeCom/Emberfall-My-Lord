// Plays March to June the honest way (no shortcuts) and counts taps until the paywall appears.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node app/store/tools/playthrough.js [normal|instant]
const PW = process.env.PW_MODULE || 'playwright';
const { chromium } = require(PW);
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const speed = process.argv[2] || 'normal';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  await p.evaluate((sp) => { localStorage.clear(); localStorage.setItem('ef_prefs', JSON.stringify({ sp })); }, speed);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { Math.random = (() => { let q = 7; return () => (q = q * 16807 % 2147483647) / 2147483647 })(); });
  console.error('ready');
  const t0 = Date.now(); let taps = 0, choices = 0; const log = [];
  const tap = async (sel, why) => { await p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel).catch(() => {}); taps++; if (why) log.push(why); };
  await p.evaluate(() => newGame()); taps++;
  let lastMonth = 0;
  for (let i = 0; i < 4000; i++) {
    const st = await p.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' };
      const q = s => document.querySelector(s);
      return {
        month: S && S.month, modal: vis('modal'), overlay: vis('overlay'), card: vis('card'),
        buy: !!q('#buyBtn'), plSkip: !!q('#plSkip'), plNext: !!q('#plNext'), nextBtn: !!q('#nextBtn'), nextWait: !!q('#nextBtn.wait'),
        req: !!q('#overlay .room.req'), ovBtn: !!q('#overlay button.pb'), ovBtnText: (q('#overlay button.pb') || {}).textContent,
        modalBtn: !!q('#modal button'), ch: [...document.querySelectorAll('#choices .ch')].map(b => ({ t: b.textContent, go: b.classList.contains('go'), dis: b.disabled })),
        typing: !!(window.TY || (typeof TY !== 'undefined' && TY)), walking: !!(SC.walker && Math.abs(SC.walker.target - SC.walker.x) > 1),
      };
    });
    if (process.env.DBG && i % 10 === 0) console.error(i, JSON.stringify(st).slice(0, 400));
    if (st.month !== lastMonth) { log.push(`month ${st.month} at ${((Date.now() - t0) / 60000).toFixed(1)} min, ${taps} taps`); lastMonth = st.month; }
    if (st.buy) { log.push('PAYWALL'); break; }
    if (st.card) { await p.waitForTimeout(200); continue; }
    if (st.modal && st.modalBtn) { await tap('#modal button.pb, #modal button', 'modal'); continue; }
    if (st.overlay) {
      if (st.plSkip) { await tap('#plSkip'); continue; }
      if (st.nextBtn) { if (st.nextWait) await tap('#overlay .room.req'); else await tap('#nextBtn', 'sleep'); await p.waitForTimeout(400); continue; }
      if (st.ovBtn) { await tap('#overlay button.pb', 'overlay:' + st.ovBtnText); await p.waitForTimeout(300); continue; }
    }
    const en = st.ch.filter(c => !c.dis);
    if (en.length) {
      const leave = en.find(c => c.go && /^Leave/.test(c.t)); const pick = en.find(c => !c.go);
      if (pick && !leave) { await p.evaluate(() => document.querySelector('#choices .ch:not(.go):not([disabled])').click()).catch(() => {}); taps++; choices++; }
      else if (leave) await tap('#choices .go');
      else await tap('#choices .go');
      await p.waitForTimeout(150); continue;
    }
    if (st.walking || st.typing) { await p.evaluate(() => document.getElementById('dialog').click()).catch(() => {}); taps++; await p.waitForTimeout(250); continue; }
    await p.waitForTimeout(250);
  }
  const end = await p.evaluate(() => ({ month: S.month, ending: document.querySelector('#overlay h3') && document.querySelector('#overlay h3').textContent, endings: Object.keys(ENDINGS).length }));
  console.log(JSON.stringify({ speed, minutes: ((Date.now() - t0) / 60000).toFixed(1), taps, choices, end, log: log.filter(l => /month|PAYWALL|sleep|overlay/.test(l)) }, null, 1));
  await b.close();
})();
