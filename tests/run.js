/* Emberfall: My Lord, automated tests.
   Runs the real game (index.html) in headless Chromium and checks the systems that matter for release.
   Usage (from the project folder):
     npm i -D playwright        (once; or use a global install)
     node tests/run.js           (all tests, about 10 minutes)
     node tests/run.js quick     (skips the long playthroughs)
     node tests/run.js play=military:6   (only six playthroughs in one style)
   Exit code 0 = everything passed. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const QUICK = process.argv.includes('quick');
const PLAY = (process.argv.find(a => a.startsWith('play=')) || '').slice(5);   // e.g. play=military:6 runs only those playthroughs
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

async function fresh(b, vp = { width: 852, height: 393 }, opts = {}) {
  const p = await b.newPage({ viewport: vp, ...opts });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' ').replace(/file:\S+index.html/g, '')));
  await p.goto(FILE + '?fast');
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ef_tips', JSON.stringify(['start', 'night', 'war', 'treasury', 'mason', 'agents', 'report', 'family', 'journal', 'council', 'table']));
  });
  await p.reload();
  await p.waitForTimeout(300);
  p.errs = errs;
  return p;
}

(async () => {
  const b = await chromium.launch();

  /* ---------- 1. economy formulas ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const r = await p.evaluate(() => {
      const out = {};
      S = fresh(); S.month = 1;
      const L = ledgerRows();
      out.startGold = L.gold; out.startFood = L.food;
      S.month = 7; out.autumnFood = ledgerRows().food;      // harvest
      S.month = 10; out.winterFood = ledgerRows().food;     // no crops in winter
      S = fresh(); S.men = 60; out.bigArmyGold = ledgerRows().gold;
      S = fresh(); S.tax = 'high'; out.highTaxGold = ledgerRows().gold; out.highTaxMood = ledgerRows().mood;
      S = fresh(); S.tax = 'low'; out.lowTaxGold = ledgerRows().gold; out.lowTaxMood = ledgerRows().mood;
      S = fresh(); S.b.barracks = 1; out.barracksMen = ledgerRows().men;
      S = fresh(); S.b.granary = 1; S.month = 7; out.granaryAutumn = ledgerRows().granary;
      return out;
    });
    ok('economy: a new reign earns gold at the start', r.startGold > 0, `+${r.startGold} gold/month`);
    ok('economy: spring grain is tight but not ruinous', r.startFood >= -6 && r.startFood <= 2, `${r.startFood} grain/month`);
    ok('economy: the autumn harvest fills the granary', r.autumnFood > 10, `+${r.autumnFood}`);
    ok('economy: winter eats into stores', r.winterFood < 0, `${r.winterFood}`);
    ok('economy: a big army is expensive', r.bigArmyGold < r.startGold, `60 men: ${r.bigArmyGold}/month`);
    ok('economy: heavy tax = more gold, less favor', r.highTaxGold > r.startGold && r.highTaxMood < r.lowTaxMood);
    ok('economy: low tax = less gold, more favor', r.lowTaxGold < r.startGold && r.lowTaxMood > 0);
    ok('economy: barracks recruit every month', r.barracksMen === 2);
    ok('economy: granary pays at harvest', r.granaryAutumn === 15);

    /* edge cases: shortages hurt but are recoverable; three bad months end the reign */
    const e = await p.evaluate(() => {
      const out = {};
      S = fresh(); S.month = 10; S.food = 0; S.men = 30;
      applyLedger(ledgerRows()); out.food1 = S.food; out.hunger1 = S.hunger; out.men1 = S.men; out.fail1 = !!(S.hunger >= 3);
      S.food = 0; applyLedger(ledgerRows()); S.food = 0; applyLedger(ledgerRows()); out.hunger3 = S.hunger;
      S = fresh(); S.food = 5; fx({ food: -20 }); out.foodClamp = S.food; out.favorAfterClamp = S.favor;
      S = fresh(); fx({ men: -100 }); out.menClamp = S.men;
      S = fresh(); fx({ favor: 500 }); out.favorCap = S.favor;
      S = fresh(); S.gold = -10; S.month = 3; applyLedger({ ...ledgerRows(), gold: -10 }); out.debtM = S.debtM;
      return out;
    });
    ok('edge: an empty granary never goes negative', e.food1 === 0);
    ok('edge: hunger is counted, soldiers desert', e.hunger1 === 1 && e.men1 < 30);
    ok('edge: three hungry months in a row are fatal', e.hunger3 === 3);
    ok('edge: grain costs below zero become lost favor', e.foodClamp === 0 && e.favorAfterClamp < 50);
    ok('edge: soldiers never go negative', e.menClamp === 0);
    ok('edge: favor is capped at 100', e.favorCap === 100);
    ok('edge: unpaid months are counted', e.debtM === 1);
    ok('no page errors (economy)', p.errs.length === 0, p.errs.join(' | '));
    await p.close();
  }

  /* ---------- 2. new game, save, load, migration, corruption ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const r = await p.evaluate(async () => {
      const out = {};
      S = fresh(); S.f.corvinFight = 1; S.gold = 999; SC.place = 'king'; TRIAL.yes = 9;
      newGame(); closeOverlay();
      out.resetFlags = Object.keys(S.f).length === 0 && S.gold === 50 && SC.place === null && TRIAL.yes === undefined;
      S.month = 7; S.gold = 123; S.f.testFlag = 1; S.clues = ['vial']; save();
      const back = JSON.parse(localStorage.getItem('ef_save3'));
      out.roundTrip = back.month === 7 && back.gold === 123 && back.f.testFlag === 1 && back.clues[0] === 'vial' && back.v === SAVE_V;
      // an old save without newer fields still loads
      localStorage.setItem('ef_save3', JSON.stringify({ month: 3, gold: 40, food: 30, men: 12, favor: 44, f: { church: 1 }, queue: [], qi: 0 }));
      try { cont(); out.oldLoads = S.month === 3 && S.f.church === 1 && Array.isArray(S.clues) && S.v === SAVE_V; } catch (e) { out.oldLoads = 'threw ' + e.message; }
      closeOverlay(); closeModal();
      // a corrupted save shows a message and is kept as a backup
      localStorage.setItem('ef_save3', '{not json');
      cont();
      out.corruptMsg = /Chronicle is torn/.test(document.getElementById('modal').textContent);
      out.backupKept = localStorage.getItem('ef_save3_backup') === '{not json';
      closeModal();
      return out;
    });
    ok('save: new game clears every flag and scene state', r.resetFlags === true);
    ok('save: round trip keeps resources, flags, clues, version', r.roundTrip === true);
    ok('save: an old-format save loads and migrates', r.oldLoads === true, String(r.oldLoads));
    ok('save: a corrupted save shows a message', r.corruptMsg === true);
    ok('save: a corrupted save is backed up, not destroyed', r.backupKept === true);
    ok('no page errors (save/load)', p.errs.length === 0, p.errs.join(' | '));
    await p.close();
  }

  /* ---------- 3. the $1.99 unlock ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const r = await p.evaluate(async () => {
      const out = {};
      const reset = () => { PRO = false; localStorage.removeItem('ef_pro'); closeModal(); };
      // in the app, a missing store plugin must NOT unlock
      reset(); window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
      await unlockFull(); out.noPluginStaysLocked = PRO === false && /isn't reachable/.test(document.getElementById('modal').textContent);
      // the store doesn't know the product: no unlock
      reset(); window.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: { getProducts: async () => ({ products: [] }), purchaseProduct: async () => ({ transactionId: 'x' }), getPurchases: async () => ({ purchases: [] }) } } };
      await unlockFull(); out.unknownProductLocked = PRO === false;
      // cancelled: no unlock
      reset(); window.Capacitor.Plugins.NativePurchases.getProducts = async () => ({ products: [{ identifier: IAP_ID, priceString: '$1.99' }] });
      window.Capacitor.Plugins.NativePurchases.purchaseProduct = async () => { throw new Error('User cancelled'); };
      await unlockFull(); out.cancelLocked = PRO === false;
      // failed: no unlock
      reset(); window.Capacitor.Plugins.NativePurchases.purchaseProduct = async () => { throw new Error('Payment failed'); };
      await unlockFull(); out.failLocked = PRO === false;
      // success: unlock, and it persists
      reset(); window.Capacitor.Plugins.NativePurchases.purchaseProduct = async () => ({ transactionId: 't1', productIdentifier: IAP_ID });
      await unlockFull(); out.successUnlocks = PRO === true && localStorage.getItem('ef_pro') === '1';
      // restore finds an earlier purchase
      reset(); window.Capacitor.Plugins.NativePurchases.restorePurchases = async () => ({});
      window.Capacitor.Plugins.NativePurchases.getPurchases = async () => ({ purchases: [{ productIdentifier: IAP_ID, purchaseState: 'PURCHASED' }] });
      await restoreFull(); out.restoreWorks = PRO === true;
      // restore with nothing to restore stays locked
      reset(); window.Capacitor.Plugins.NativePurchases.getPurchases = async () => ({ purchases: [] });
      await restoreFull(); out.restoreEmptyLocked = PRO === false;
      // the browser demo (no Capacitor) is clearly separate
      reset(); delete window.Capacitor; await unlockFull(); out.browserDemo = PRO === true;
      // the paywall sits on the eve of July
      reset(); S = fresh(); S.month = 4; S.night = { req: [], reqDone: {}, evs: [], evDone: {} }; showNight(); $('nextBtn').click();
      out.paywallBeforeJuly = /The Banners Are Coming/.test(document.getElementById('overlay').textContent);
      closeOverlay();
      S = fresh(); S.month = 3; S.night = { req: [], reqDone: {}, evs: [], evDone: {} }; showNight(); $('nextBtn').click();
      out.freeBeforeJune = S.month === 4;
      out.productId = IAP_ID;
      return out;
    });
    ok('purchase: app without the store plugin does not unlock', r.noPluginStaysLocked === true);
    ok('purchase: unknown product does not unlock', r.unknownProductLocked === true);
    ok('purchase: cancelled purchase does not unlock', r.cancelLocked === true);
    ok('purchase: failed purchase does not unlock', r.failLocked === true);
    ok('purchase: successful purchase unlocks and persists', r.successUnlocks === true);
    ok('purchase: restore finds an earlier purchase', r.restoreWorks === true);
    ok('purchase: restore with nothing stays locked', r.restoreEmptyLocked === true);
    ok('purchase: browser demo unlock is separate from the app', r.browserDemo === true);
    ok('purchase: the paywall appears on the eve of July', r.paywallBeforeJuly === true);
    ok('purchase: March to June is free', r.freeBeforeJune === true);
    ok('purchase: product id is emberfall_full_unlock', r.productId === 'emberfall_full_unlock');
    await p.close();
  }

  /* ---------- 4. endings: every one is reachable from a valid state ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const r = await p.evaluate(() => {
      const cases = {
        chained: { f: { vassal: 1, rebelCrushed: 1 } }, vassalForever: { f: { vassal: 1 } }, fenThrone: { f: { witchThrone: 1 } },
        usurped: { f: { corvinFight: 1, councilLost: 1 } }, emberCrown: { f: { corvinFight: 1, corvinExposed: 1 } }, pricePeace: { f: { corvinPact: 1 } },
        brokenChain: { f: { freed: 1 } }, twoBanks: { f: { vexLands: 1 }, favor: 60 }, kingsHand: { f: { kingChampion: 1 }, favor: 50 },
        twoHouses: { f: { marenWed: 1, harwinAlly: 1 }, favor: 50 }, emberLord: { f: {}, favor: 85 }, ironYear: { f: { ironLaw: 1 }, favor: 40, men: 40 }, longYear: { f: {}, favor: 50 }
      };
      const out = {};
      for (const [k, c] of Object.entries(cases)) { S = fresh(); S.month = 12; Object.assign(S.f, c.f); if (c.favor != null) S.favor = c.favor; if (c.men) S.men = c.men; out[k] = finalEnding(); }
      // the endings that come from fail() and battles render too
      const shown = {};
      for (const k of Object.keys(ENDINGS)) { S = fresh(); S.month = 12; try { ending(k); document.getElementById('cutBtn').click(); document.getElementById('cutBtn').click(); shown[k] = !!document.querySelector('.ending h3'); } catch (e) { shown[k] = 'threw ' + e.message } }
      return { out, shown, total: Object.keys(ENDINGS).length };
    });
    for (const [k, got] of Object.entries(r.out)) ok(`ending: ${k} is reached from its conditions`, got === k, got === k ? '' : 'got ' + got);
    const bad = Object.entries(r.shown).filter(([, v]) => v !== true);
    ok(`ending: all ${r.total} endings render their cutaway, grave and summary`, bad.length === 0, bad.map(x => x.join(':')).join(', '));
    ok('no page errors (endings)', p.errs.length === 0, p.errs.join(' | '));
    await p.close();
  }

  /* ---------- 5. every line of story text and every choice runs in many random states ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const TRIALS = QUICK ? 12 : 30; let r = { sets: 0, runs: 0, errs: [] };
    for (let trial = 0; trial < TRIALS; trial++) {
    const rr = await p.evaluate(() => {
      const flags = ['corvinClaim', 'corvinFight', 'corvinPact', 'vassal', 'freed', 'knelt', 'harwinAlly', 'marenWed', 'marenGone', 'tobinHostage', 'tobinKnight', 'brannocJailed', 'brannocExiled', 'brannocPardoned', 'brannocFled', 'vexDead', 'vexWounded', 'spy', 'witchPact', 'morwenCourt', 'outcome_peace', 'outcome_victory', 'winterDone', 'corvinAttacked', 'elinorSleuth', 'roderickSin', 'ironLaw', 'corvinExposed', 'councilLost', 'harsh', 'tunnel'];
      const sets = [];
      E.forEach((e, i) => sets.push(['E' + i, e])); R.forEach((e, i) => sets.push(['R' + i, e])); SCENES.forEach(e => sets.push(['SC:' + e.id, e])); NIGHT_EVENTS.forEach((e, i) => sets.push(['NE' + i, e]));
      for (const k in TALKS) TALKS[k].forEach(t => { sets.push(['T:' + t.id, t]); if (t.then) sets.push(['T:' + t.id + '+', t.then]) });
      for (const k in TALK_MORE) sets.push(['TM:' + k, TALK_MORE[k]]);
      for (const k in SEAT_EV) sets.push(['SEAT:' + k, SEAT_EV[k]]);
      const errs = new Set(); let runs = 0;
      // choices may start scenes, battles and timers; those are tested elsewhere, so here they're held back
      const keep = { toast: window.toast, st: window.setTimeout, si: window.setInterval, raf: window.requestAnimationFrame };
      window.toast = () => { }; window.setTimeout = () => 0; window.setInterval = () => 0; window.requestAnimationFrame = () => 0;
      {
        for (const [tag, e] of sets) {
          S = fresh(); S.month = 1 + Math.floor(Math.random() * 12); S.night = { req: [], reqDone: {}, evs: [], evDone: {} };
          flags.forEach(f => { if (Math.random() < .25) S.f[f] = 1 });
          S.clues = Object.keys(CLUES).filter(() => Math.random() < .4); S.gold = Math.floor(Math.random() * 120) - 10; S.food = Math.floor(Math.random() * 80); S.men = Math.floor(Math.random() * 50);
          try { if (e.req && !e.req()) continue; if (e.when && !e.when()) continue; const t = typeof e.text === 'function' ? e.text() : e.text; if (typeof t !== 'string' || /undefined|NaN|\[object/.test(t)) errs.add(tag + ': bad text ' + String(t).slice(0, 60));
            (e.choices || []).forEach(c => { if (c.req && !c.req()) return; const lbl = typeof c.t === 'function' ? c.t() : c.t; if (/undefined|NaN/.test(lbl)) errs.add(tag + ': bad label'); const snap = JSON.stringify(S); const reply = c.go(); runs++; if (reply != null && typeof reply !== 'string') errs.add(tag + ': reply not text'); if (typeof reply === 'string' && /undefined|NaN|\[object/.test(reply)) errs.add(tag + ': bad reply ' + reply.slice(0, 60)); S = JSON.parse(snap); });
          } catch (x) { errs.add(tag + ': ' + x.message); }
        }
      }
      window.toast = keep.toast; window.setTimeout = keep.st; window.setInterval = keep.si; window.requestAnimationFrame = keep.raf;
      try { closeModal(); closeOverlay(); } catch (x) { }
      return { sets: sets.length, runs, errs: [...errs].slice(0, 30) };
    });
    r.sets = rr.sets; r.runs += rr.runs; r.errs = [...new Set([...r.errs, ...rr.errs])].slice(0, 30);
    }
    ok(`story: ${r.sets} events, ${TRIALS} random states each, and ${r.runs} choice runs in random states without errors`, r.errs.length === 0, r.errs.join(' | '));
    await p.close();
  }

  /* ---------- 6. nothing scrolls: every choice set fits on iPhone-sized screens ---------- */
  if (!PLAY) {
    for (const [nm, vp] of [['iPhone', { width: 852, height: 393 }], ['iPhone SE', { width: 667, height: 375 }]]) {
      const p = await fresh(b, vp);
      const r = await p.evaluate(async () => {
        S = fresh(); S.month = 7; render(); closeOverlay();
        const sets = []; E.forEach((e, i) => sets.push(['E' + i, e])); R.forEach((e, i) => sets.push(['R' + i, e])); SCENES.forEach(s => sets.push(['SC:' + s.id, s]));
        const out = [];
        for (const [tag, e] of sets) {
          PCHAR = C.aldric; $('txt').className = ''; $('txt').textContent = 'A short line.'; const c = $('choices'); c.innerHTML = '';
          (e.choices || []).forEach((o, i) => { if (o.agent && !agentKnown(o.agent)) return; const bt = choiceBtn(o, i, () => { }); bt.style.animation = 'none'; c.appendChild(bt) });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (c.scrollHeight > c.clientHeight + 2) out.push(tag);
        }
        return out;
      });
      ok(`layout: no choice list scrolls on ${nm}`, r.length === 0, r.slice(0, 10).join(', '));
      await p.close();
    }
  }

  /* ---------- 8. regressions found by independent QA: reloads, double taps, broken saves, crowded nights ---------- */
  if (!PLAY) {
    const p = await fresh(b);
    const drive = async (want, tries = 60) => {   // advance text and click the first choice matching `want`
      for (let i = 0; i < tries; i++) {
        const hit = await p.evaluate(w => { if (typeof TY !== 'undefined' && TY && TY.typing) { finishType(); return 'typing' } if (document.querySelector('#txt.more')) { advanceType(); return 'more' }
          const bs = [...document.querySelectorAll('#choices button')]; const m = bs.find(x => new RegExp(w).test(x.textContent)); if (m) { m.click(); return 'hit' } const c = bs.find(x => /Continue/.test(x.textContent)); if (c) { c.click(); return 'cont' } const cb = document.querySelector('#cutBtn'); if (cb) { cb.click(); return 'cut' } return 'wait' }, want);
        if (hit === 'hit') return true; await p.waitForTimeout(60);
      }
      return false;
    };
    const reload = async () => { await p.reload(); await p.waitForTimeout(400); await p.evaluate(() => { PRO = true; cont() }); await p.waitForTimeout(500); };
    // A. after the July battle is decided, a reload continues into August and never fights it again
    await p.evaluate(() => { PRO = true; localStorage.setItem('ef_pro', '1'); S = fresh(); S.month = 5; S.men = 40; render(); battleBegin(); BSCORE = 130; aftermath('victory'); });
    const a1 = await p.evaluate(() => ({ m: JSON.parse(localStorage.getItem('ef_save3')).month, men: S.men }));
    await reload();
    const a2 = await p.evaluate(() => ({ m: S.month, battles: (S.chron || []).filter(c => /battle for Emberfall/.test(c)).length, men: S.men, onWar: /Last Night of July/.test(document.getElementById('overlay').textContent + $('txt').textContent) }));
    ok('reload: after the July battle, Continue goes on to August without refighting it', a1.m === 6 && a2.m === 6 && a2.battles === 1 && a2.men === a1.men && !a2.onWar, JSON.stringify([a1, a2]));
    // B. a ceremony reloaded halfway gives its reward once, not twice
    await p.evaluate(() => { closeOverlay(); S = fresh(); S.month = 3; S.favor = 60; S.queue = ['cere:vex']; S.qi = 0; render(); next(); });
    await drive('Ride to the water'); await drive('Come across');
    await p.waitForTimeout(200); await reload();
    const b1 = await p.evaluate(() => S.favor);
    ok('reload: a parley reloaded halfway does not repeat its favor', b1 === 60, 'favor ' + b1);
    // C. a reloaded ending does not bring the reign back
    await p.evaluate(() => { closeOverlay(); S = fresh(); S.month = 5; save(); ending('fallen'); });
    const c1 = await p.evaluate(() => localStorage.getItem('ef_save3'));
    ok('reload: once an ending starts, there is no save to continue', c1 === null);
    // D. a double tap on Unlock buys once and continues once
    const d1 = await p.evaluate(async () => {
      closeOverlay(); PRO = false; localStorage.removeItem('ef_pro'); let buys = 0, afters = 0;
      window.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: { getProducts: async () => ({ products: [{ identifier: IAP_ID, priceString: '$1.99' }] }),
        purchaseProduct: async () => { buys++; await new Promise(r => setTimeout(r, 300)); return { transactionId: 't' + buys, productIdentifier: IAP_ID } }, getPurchases: async () => ({ purchases: [] }), restorePurchases: async () => ({}) } } };
      S = fresh(); S.month = 4; paywall(() => afters++); $('buyBtn').click(); $('buyBtn').click(); $('restoreBtn').click();
      await new Promise(r => setTimeout(r, 900)); delete window.Capacitor; closeOverlay(); return { buys, afters, pro: PRO };
    });
    ok('purchase: a double tap on Unlock buys once and continues once', d1.buys === 1 && d1.afters === 1 && d1.pro === true, JSON.stringify(d1));
    // E. "Not now" while the store is thinking: the purchase still counts, but the game doesn't jump ahead
    const e1 = await p.evaluate(async () => {
      PRO = false; localStorage.removeItem('ef_pro'); let afters = 0;
      window.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: { getProducts: async () => ({ products: [{ identifier: IAP_ID }] }), purchaseProduct: async () => { await new Promise(r => setTimeout(r, 300)); return { transactionId: 'z', productIdentifier: IAP_ID } }, getPurchases: async () => ({ purchases: [] }) } } };
      S = fresh(); S.month = 4; paywall(() => afters++); $('buyBtn').click(); $('laterBtn').click();
      await new Promise(r => setTimeout(r, 700)); delete window.Capacitor; return { afters, pro: PRO };
    });
    ok('purchase: leaving the paywall mid-purchase unlocks without jumping ahead', e1.afters === 0 && e1.pro === true, JSON.stringify(e1));
    // F. broken or out-of-date saves never crash: they load or show "The Chronicle is torn"
    const bad = [{ month: 6, queue: [9999, 'r9999', 'seat:nope', 'cere:nope'], qi: 0 }, { month: 6, tax: 'bogus' }, { month: 6, night: { req: ['noSuchScene'], reqDone: {}, evs: [999], evDone: {} } },
      { month: 6, mission: { id: 'bogus' } }, { month: 6, clues: 'vial' }, { month: 6, doneScenes: {} }, { month: 13 }, { month: '7' }, { month: 6, f: null, b: null, bond: 'x' }];
    const fbad = [];
    for (const sv of bad) {
      await p.evaluate(x => { closeModal(); closeOverlay(); PRO = true; localStorage.setItem('ef_save3', JSON.stringify(x)) }, sv);
      const before = p.errs.length; await reload();
      const st = await p.evaluate(() => /Chronicle is torn/.test(document.getElementById('modal').textContent) ? 'torn' : (S && S.month >= 1 && S.month <= 12 ? 'loaded' : 'broken'));
      if (p.errs.length > before || st === 'broken') fbad.push(JSON.stringify(sv).slice(0, 50) + ' → ' + st + ' ' + p.errs.slice(before).join(';').slice(0, 80));
    }
    ok(`save: ${bad.length} broken saves load or show a message, never crash`, fbad.length === 0, fbad.join(' | '));
    // G. "New Reign" works even when the old save is unreadable
    const g1 = await p.evaluate(() => { closeModal(); localStorage.setItem('ef_save3', '{not json'); try { confirmNew(); return /new reign/i.test(document.getElementById('modal').textContent) } catch (e) { return 'threw ' + e.message } });
    ok('save: New Reign works with an unreadable save', g1 === true, String(g1));
    // H. a crowded night keeps the scenes that can't wait
    const h1 = await p.evaluate(() => { closeModal(); S = fresh(); S.month = 4; S.f.plague = 1; S.f.refugees = 1; S.f.tobinRides = 1; S.queue = []; S.qi = 0; endMonth(); const r = S.night.req; closeOverlay(); return r });
    ok('night: single-month scenes are never crowded out', ['pitch', 'elinorFever', 'refugeeLand', 'tobinWound'].every(id => h1.includes(id)), h1.join(','));
    // I. the river map never opens over a story screen (that used to strand the player)
    const i1 = await p.evaluate(() => { closeModal(); closeOverlay(); S = fresh(); S.month = 12; render(); HOLD = true; openWorld(); const a = !!$('wmClose'); HOLD = false; closeOverlay();
      overlay('<div class="ovb ending"><h3>x</h3><button class="pb" id="fateBtn">Go</button></div>'); openWorld(); const b = !!$('wmClose') || !$('fateBtn'); closeOverlay();
      S.night = { req: [], reqDone: {}, evs: [], evDone: {} }; showNight(); openWorld(); const c = !!$('wmClose'); closeOverlay(); return { a, b, c } });
    ok('map: refused over a battle/trial/ending, allowed from the night map', !i1.a && !i1.b && i1.c, JSON.stringify(i1));
    ok('no page errors (regressions)', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
    await p.close();
  }

  /* ---------- 9. every choice set in the real game text fits, with agents known, on the smallest phones ---------- */
  if (!PLAY) {
    for (const [nm, vp] of [['iPhone 15', { width: 852, height: 393 }], ['iPhone SE', { width: 667, height: 375 }]]) {
      const p = await fresh(b, vp);
      const r = await p.evaluate(async () => {
        S = fresh(); S.month = 8; S.gold = 0; ['spy', 'foxPardoned', 'witchPact', 'harwinAlly', 'brannocJailed'].forEach(f => S.f[f] = 1); render(); closeOverlay();
        const sets = []; E.forEach((e, i) => sets.push(['E' + i, e])); R.forEach((e, i) => sets.push(['R' + i, e]));
        const out = [];
        for (const [tag, e] of sets) {
          let t = ''; try { t = typeof e.text === 'function' ? e.text() : e.text } catch (x) { continue }
          PCHAR = C[e.who] || null; $('who').textContent = C[e.who] ? C[e.who].n : ''; $('txt').className = ''; $('txt').style.fontSize = ''; $('txt').textContent = String(t).split('\n\n')[0];
          const c = $('choices'); c.innerHTML = ''; delete $('dialog').dataset.fit; fitDialog();
          (e.choices || []).forEach((o, i) => { let ok = true; try { ok = !o.req || o.req() } catch (x) { } if (!ok) return; const bt = choiceBtn(o, i, () => { }); bt.style.animation = 'none'; c.appendChild(bt) });
          fitDialog(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (c.scrollHeight > c.clientHeight + 2) out.push(tag);
        }
        $("choices").innerHTML = ""; fitDialog();
        return out;
      });
      ok(`layout: real choice text with agents fits on ${nm}`, r.length === 0, r.slice(0, 10).join(', '));
      await p.close();
    }
  }

  /* ---------- 10. iPad: every window size iPadOS allows, portrait and landscape ---------- */
  if (!PLAY) {
    const IPADS = [['iPad Pro 13" landscape', 1376, 1032], ['iPad Pro 13" portrait', 1032, 1376], ['iPad Air 11" landscape', 1180, 820], ['iPad Air 11" portrait', 820, 1180],
      ['iPad mini landscape', 1133, 744], ['iPad mini portrait', 744, 1133], ['iPad 9.7" landscape', 1024, 768], ['iPad 9.7" portrait', 768, 1024],
      ['window 900x700', 900, 700], ['window 700x900', 700, 900], ['window 1100x600', 1100, 600], ['window 600x800', 600, 800], ['window 1000x500', 1000, 500], ['window 500x700', 500, 700]];
    // screens that must fit inside the window with nothing cut off (lists inside the Journal may scroll, as on iPhone)
    const SCREENS = {
      title: `showTitle()`, prologue: `prologue(()=>{},3)`,
      night: `S=fresh();S.month=4;S.f.plague=1;S.queue=[];S.qi=0;render();endMonth()`,
      family: `S=fresh();S.month=5;S.night={req:[],reqDone:{},evs:[],evDone:{}};render();showNight();enterRoom('family')`,
      treasury: `S=fresh();S.month=5;S.lastLedger=ledgerRows();render();panel('treasury')`, war: `S=fresh();S.month=5;render();panel('war')`, mason: `S=fresh();S.month=5;S.night={};render();panel('mason')`,
      journalTable: `S=fresh();S.month=5;render();openJournal('table')`, journalCouncil: `S=fresh();S.month=9;S.f.corvinClaim=1;render();openJournal('council')`, journalMurder: `S=fresh();S.month=5;render();openJournal('murder')`,
      settings: `openSettings()`, endings: `openEndings()`, world: `S=fresh();S.month=10;S.f.corvinClaim=1;render();openWorld();openWorld('greymarch')`,
      warmap: `S=fresh();S.month=5;S.men=30;render();siege()`, paywall: `S=fresh();S.month=4;render();PRO=false;paywall(()=>{})`,
      endingCard: `S=fresh();S.month=12;S.f.tobinKnight=1;S.f.marenWed=1;for(let i=0;i<14;i++)S.chron.push('March: something memorable happened '+i);render();ending('emberLord');$('cutBtn').click();$('cutBtn').click()`,
      grave: `S=fresh();S.month=12;render();ending('emberLord');$('cutBtn').click()`, stat: `S=fresh();render();statInfo('gold')`,
    };
    const outside = () => {   // visible text and buttons that end up outside the window (after clipping by their scrolling/clipping parents)
      const vw = innerWidth, vh = innerHeight, bad = [];
      const vis = el => { for (let a = el; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false } return true };
      for (const el of document.querySelectorAll('#app button, #app h2, #app h3, #app p, #app b, #app small, #app li, #app .lrow, #app #txt')) {
        if (!el.getClientRects().length || !vis(el)) continue;
        let r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
        let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
        for (let a = el.parentElement; a && a.id !== 'app'; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = a.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom) } }
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;   // scrolled out of sight inside a list that scrolls
        if (x0 < -1 || y0 < -1 || x1 > vw + 1 || y1 > vh + 1) bad.push((el.id || el.tagName.toLowerCase() + '.' + el.className) + ' "' + el.textContent.trim().slice(0, 24) + '"');
      }
      for (const el of document.querySelectorAll('#choices, #overlay .ovb.ending, #overlay .ovb.siege')) if (vis(el) && el.scrollHeight > el.clientHeight + 2) bad.push('scrolls: ' + (el.id || el.className));
      return bad;
    };
    for (const [nm, w, h] of IPADS) {
      const p = await fresh(b, { width: w, height: h }, { hasTouch: true, isMobile: true });
      // a. every choice set in the real game text fits without a scrollbar
      const r = await p.evaluate(async () => {
        S = fresh(); S.month = 8; S.gold = 0; ['spy', 'foxPardoned', 'witchPact', 'harwinAlly', 'brannocJailed'].forEach(f => S.f[f] = 1); render(); closeOverlay();
        const sets = []; E.forEach((e, i) => sets.push(['E' + i, e])); R.forEach((e, i) => sets.push(['R' + i, e])); SCENES.forEach(s => sets.push(['SC:' + s.id, s]));
        const out = [];
        for (const [tag, e] of sets) {
          let t = ''; try { t = typeof e.text === 'function' ? e.text() : e.text } catch (x) { continue }
          PCHAR = C[e.who] || null; $('who').textContent = C[e.who] ? C[e.who].n : ''; $('txt').className = ''; $('txt').style.fontSize = ''; $('txt').textContent = String(t).split('\n\n')[0];
          const c = $('choices'); c.innerHTML = ''; delete $('dialog').dataset.fit; fitDialog();
          (e.choices || []).forEach((o, i) => { let ok = true; try { ok = !o.req || o.req() } catch (x) { } if (!ok) return; const bt = choiceBtn(o, i, () => { }); bt.style.animation = 'none'; c.appendChild(bt) });
          fitDialog(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const d = $('dialog').getBoundingClientRect();
          if (c.scrollHeight > c.clientHeight + 2 || d.bottom > innerHeight + 1 || d.right > innerWidth + 1) out.push(tag);
          else for (const bt of c.children) { const q = bt.getBoundingClientRect(); if (q.height < 40) { out.push(tag + ' (button ' + Math.round(q.height) + 'px tall)'); break } }
        }
        $('choices').innerHTML = ''; fitDialog();
        return out;
      });
      ok(`iPad layout: every choice set fits, no scrollbar, targets 40pt+ on ${nm} (${w}x${h})`, r.length === 0, r.slice(0, 8).join(', '));
      // b. nothing is cut off on the key screens
      const bad = [];
      for (const [k, js] of Object.entries(SCREENS)) {
        await p.evaluate(js => { closeModal(); closeOverlay(); HOLD = false; BT.on = false; eval(js) }, js);
        await p.waitForTimeout(80);
        const o = await p.evaluate(outside);
        if (o.length) bad.push(k + ': ' + o.slice(0, 3).join('; '));
      }
      ok(`iPad layout: nothing cut off on ${Object.keys(SCREENS).length} key screens on ${nm} (${w}x${h})`, bad.length === 0, bad.slice(0, 6).join(' | '));
      ok(`no page errors (iPad ${nm})`, p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
      await p.close();
    }
  }

  /* ---------- 7. full playthroughs with different ruling styles ---------- */
  if (!QUICK) {
    const [onlyStyle, onlyN] = PLAY.split(':');
    const STYLES = {
      cautious: { tax: 'normal', pref: /Not now|Refuse|Say nothing|Keep it|Volunteers|Train villagers|Hold the walls/, avoid: /Kneel|Flee/ },
      military: { tax: 'high', pref: /Hire|sellswords|Barracks|Stone Walls|Watchtowers|Do it. Every|Arrows|Buy the arrows|Archers|Charge/, avoid: /Kneel|Flee|Parley/ },
      generous: { tax: 'low', pref: /Give|Feed|Pay|Donate|Open|grand|Grant|blessing|together/, avoid: /Kneel|Flee/ },
      hightax: { tax: 'high', pref: null, avoid: /Kneel|Flee/ },
      careless: { tax: 'high', pref: /Kneel|Refuse|Hush|Burn it|Throw|Let him come|Tell the Guild|can't help/, avoid: null }
    };
    for (const [style, P] of Object.entries(STYLES)) {
      if (onlyStyle && style !== onlyStyle) continue;
      const p = await fresh(b);
      await p.evaluate(() => { PRO = true; localStorage.setItem('ef_pro', '1') });
      const runs = [];
      for (let g = 0; g < (+onlyN || 2); g++) {
        const res = await p.evaluate(async ([tax, pref, avoid]) => {
          const PR = pref ? new RegExp(pref, 'i') : null, AV = avoid ? new RegExp(avoid, 'i') : null; const pick = a => a[Math.floor(Math.random() * a.length)];
          localStorage.removeItem('ef_save3'); newGame(); const traj = []; let lastM = 0, steps = 0, stuck = 0;
          while (steps++ < 30000) {
            await new Promise(r => setTimeout(r, 1));
            if (S.month !== lastM) { lastM = S.month; S.tax = tax; traj.push([S.month, S.gold, S.food, S.men, S.favor]) }
            const h = document.querySelector('.ending h3'); if (h && !document.querySelector('#cutBtn,#onBtn,#onBtn2,#fateBtn,#buyBtn')) return { end: h.textContent, m: S.month, traj };
            if (document.querySelector('#txt.more')) { advanceType(); continue }
            if (typeof TY !== 'undefined' && TY && TY.typing) { finishType(); continue }
            const sk = document.querySelector('#plSkip'); if (sk) { sk.click(); continue }
            const dn = [...document.querySelectorAll('#modal .pb,#modal .mx')].find(x => /Done|Close|✕|Back/.test(x.textContent)); if (dn) { dn.click(); continue }
            const f = document.querySelector('#fateBtn,#onBtn,#onBtn2,#verdictBtn,#wmGo,#cutBtn,#repBtn'); if (f) { f.click(); continue }
            if (document.querySelector('#overlay .rooms')) { if (document.querySelector('#overlay.going')) continue; const req = [...document.querySelectorAll('#overlay .room.req')]; if (req.length) { req[0].click(); continue } if (S.food < 20 && S.gold > 25 && !window.__bought) { window.__bought = S.month; const t = grainPrice(); if (S.gold >= t.buy) { fx({ gold: -t.buy, food: 10 }) } } if (window.__bought !== S.month) window.__bought = 0; $('nextBtn').click(); continue }
            const bs = [...document.querySelectorAll('#choices button')].filter(x => !x.disabled);
            if (!bs.length) { if (++stuck > 4000) return { stuck: JSON.stringify({ m: S.month, txt: $('txt').textContent.slice(0, 60) }) }; continue } stuck = 0;
            const ok = AV ? bs.filter(x => !AV.test(x.textContent)) : bs; const pr = PR ? ok.filter(x => PR.test(x.textContent)) : [];
            pick(pr.length && Math.random() < .75 ? pr : ok.length ? ok : bs).click();
          }
          return { stuck: 'steps' };
        }, [P.tax, P.pref && P.pref.source, P.avoid && P.avoid.source]);
        runs.push(res);
      }
      for (const r of runs) {
        if (r.stuck) ok(`playthrough (${style}): finishes`, false, 'stuck ' + r.stuck);
        else { const last = r.traj[r.traj.length - 1] || []; ok(`playthrough (${style}): reached "${r.end}" in month ${r.m}`, true, `last month gold ${last[1]}, grain ${last[2]}, army ${last[3]}, favor ${last[4]}`) }
      }
      ok(`no page errors (${style} playthroughs)`, p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
      await p.close();
    }
  }

  await b.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
