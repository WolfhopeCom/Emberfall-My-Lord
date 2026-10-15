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

async function fresh(b, vp = { width: 852, height: 393 }) {
  const p = await b.newPage({ viewport: vp });
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
