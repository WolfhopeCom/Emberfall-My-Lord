// Renders Emberfall's app icon, adaptive-icon foreground, splash screens and App Store screenshots.
//   cd app && node scripts/render_resources.js        (needs Playwright: npm i -D playwright)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..'), ROOT = path.resolve(APP, '..');
const RES = path.join(APP, 'resources'), SHOTS = path.join(APP, 'store', 'screenshots');

// 32x32 pixel-art crest: a gold crown over an ember, castle at the bottom, dusk sky behind.
const ICON_JS = `
function crest(x, sky){
  const P=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h)};
  if(sky){const S=["#140c26","#26143e","#40184a","#6a2650","#a2404c","#d8703e"];
    S.forEach((c,i)=>{P(0,i*6,32,6,c);if(i<5)for(let k=i%2;k<32;k+=2)P(k,i*6+5,1,1,S[i+1])});P(0,30,32,2,S[5]);
    [[3,3],[27,2],[6,9],[24,8],[29,13],[2,15]].forEach(([a,b])=>P(a,b,1,1,"#fff4d0"));
    const C="#0e0814";P(0,26,32,6,C);P(2,22,5,10,C);P(25,22,5,10,C);for(let k=0;k<32;k+=3)P(k,25,2,1,C);P(2,21,1,1,C);P(4,21,1,1,C);P(6,21,1,1,C);P(25,21,1,1,C);P(27,21,1,1,C);P(29,21,1,1,C);
    P(4,24,1,2,"#ffb860");P(27,24,1,2,"#ffb860");P(11,28,1,1,"#ffb860");P(20,28,1,1,"#ffb860");}
  // ember
  const F=[["....Y....","...YY....","...YYY...","..YYOY...","..YOOYY..",".YYOOOYY.",".YOOROOY.",".YORRROY.","..YORRY..","...YYY..."],{Y:"#f2c14e",O:"#f08020",R:"#ffe9a0"}];
  F[0].forEach((r,j)=>[...r].forEach((ch,i)=>{if(F[1][ch])P(11+i,2+j,1,1,F[1][ch])}));
  // crown
  const G="#f2c14e",D="#b8801a",L="#fff0a8";
  P(8,13,16,1,D);P(8,12,2,1,G);P(15,11,2,2,G);P(22,12,2,1,G);
  P(8,14,16,7,G);P(8,14,1,7,L);P(23,14,1,7,D);P(8,20,16,1,D);
  P(9,13,2,1,G);P(14,12,4,2,G);P(21,13,2,1,G);
  P(8,16,16,1,D);P(8,18,16,1,D);
  P(11,17,2,1,"#4ac0e0");P(15,16,2,3,"#d02030");P(15,16,1,1,"#ff8090");P(19,17,2,1,"#4ac0e0");
  P(7,21,18,1,"#3a1408");
}`;

(async () => {
  fs.mkdirSync(RES, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<canvas id=c></canvas>');
  const png = async (w, h, body) => {
    const url = await p.evaluate(([w, h, body, js]) => {
      eval(js); const c = document.getElementById('c'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.imageSmoothingEnabled = false; (new Function('x', 'w', 'h', 'crest', body))(x, w, h, crest); return c.toDataURL('image/png');
    }, [w, h, body, ICON_JS]);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  fs.writeFileSync(path.join(RES, 'icon.png'), await png(1024, 1024, 'x.scale(32,32);crest(x,1)'));
  fs.writeFileSync(path.join(RES, 'icon-only.png'), fs.readFileSync(path.join(RES, 'icon.png')));
  fs.writeFileSync(path.join(RES, 'icon-foreground.png'), await png(1024, 1024, 'x.translate(256,224);x.scale(16,16);crest(x,0)'));
  fs.writeFileSync(path.join(RES, 'icon-background.png'), await png(1024, 1024, 'x.fillStyle="#120B16";x.fillRect(0,0,w,h)'));
  const splash = await png(2732, 2732, 'x.fillStyle="#120B16";x.fillRect(0,0,w,h);x.translate(1110,1066);x.scale(16,16);crest(x,0)');
  fs.writeFileSync(path.join(RES, 'splash.png'), splash); fs.writeFileSync(path.join(RES, 'splash-dark.png'), splash);

  // App Store screenshots: 2622x1206 (iPhone 6.9", landscape)
  const s = await b.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 3 });
  await s.goto('file://' + path.join(ROOT, 'index.html'));
  await s.evaluate(() => { localStorage.clear(); localStorage.setItem('ef_tips', JSON.stringify(['start','night','war','treasury','mason','agents','report'])); localStorage.setItem('ef_pro', '1'); });
  await s.reload();
  await s.evaluate(() => document.fonts.ready); await s.waitForTimeout(2500);
  await s.screenshot({ path: path.join(SHOTS, '01-title.png') });
  await s.evaluate(() => { Math.random = (() => { let q = 3; return () => (q = q * 16807 % 2147483647) / 2147483647 })(); newGame(); });
  const waitChoices = async () => { await s.waitForSelector('#choices .ch', { timeout: 30000 }); await s.waitForTimeout(400); };
  const pick = async (text) => { await s.locator('#choices .ch', { hasText: text }).first().click(); };
  const cont = async () => { await s.waitForSelector('#choices .go'); await s.click('#choices .go'); };
  await waitChoices(); await pick('Then let them in'); await cont();
  await waitChoices(); await s.screenshot({ path: path.join(SHOTS, '02-throne.png') });
  await s.locator('#choices .ch:not([disabled])').first().click(); await s.waitForTimeout(900);
  await s.screenshot({ path: path.join(SHOTS, '03-choice.png') });
  // jump to the witch on day 3 for a dramatic portrait
  await s.evaluate(() => { finishType(); SC.walker = null; S.month = 3; buildMonth(); next(); });
  await waitChoices(); await s.screenshot({ path: path.join(SHOTS, '04-witch.png') });
  await s.evaluate(() => { S.month = 5; S.f.plan_wall = 1; S.men = 40; });
  await s.evaluate(() => siege()); await s.waitForTimeout(3800);
  await s.screenshot({ path: path.join(SHOTS, '05-siege.png') });
  await s.evaluate(() => ending('twoBanks')); await s.waitForTimeout(2500);
  await s.screenshot({ path: path.join(SHOTS, '06-ending.png') });
  await b.close();
  console.log('resources and screenshots written');
})();
