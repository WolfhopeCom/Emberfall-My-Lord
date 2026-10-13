# Emberfall: My Lord 👑🔥

A pixel-art medieval story game. Your father is dead and the throne of **Emberfall** is yours. Over your first year, month by month, petitioners walk up the red carpet to your throne: villagers, your family, a witch from the fen, a moneylender, a spy and the envoy of the Baron who wants your city. Every answer costs something. In high summer, Baron Vex's banners appear on the river. Survive that, and you still have to get through the harvest, a rival cousin with a forged will, the King's war and a hard winter before the lords judge you at the Midwinter Council.

## The game

- **4 resources:** Gold, Grain, Army and Favor. Let any one collapse and your reign ends early (famine, revolt, or the Guild owns you).
- **A year in 12 months** with seasons (spring rain, summer sun, autumn leaves, winter snow), a month-end ledger, and **Hildra's Works**: build a granary, market, chapel, barracks or stone walls.
- **Night in the castle** at each month's end: a cut-away map of the castle where you tap a room (gold "!" = must visit, red "!" = something is happening, ✓ = visited) and then **walk into it**. Each room is its own animated scene (candlelit treasury, war room map table, the mason's yard under the stars, the family hearth, the dungeon cells), and its matters play out as dialogue with the people there, just like the throne room. Every room is optional: the **Treasury** (ledger, next-month forecast, tax rate), the **War Room** (send 5/10/20 soldiers on missions; they report back next month), the **Mason's Yard** (one building a month) and **Family Quarters** (an evening with Elinor, Maren or Tobin changes the story). One surprise event happens in a random room each night. Most nights also have **1–3 required scenes** (gold "!"), drawn from `SCENES` by month and by your earlier choices (your father's letter, the Brannoc–Aldric quarrel, Maren's tears, the quarry, the smugglers' tunnel, a rider from the river fort, Morwen at the nursery window, Elinor's fever, Vex's chest of gold...). A **Dungeon** room appears when you hold a prisoner.
- **Soldiers cost gold wages and grain**, so a bigger army needs a healthy treasury.
- **The full year:** Chapter One (March to July) ends with the Vex battle; Chapter Two (August to February) carries its outcome into the harvest, Lord Corvin's claim, the King's northern war, Maren's wedding (or flight), Tobin's knighting, Vex's revenge or your uprising against him, and the Midwinter Council.
- **Countdown** in the top bar and on every month card: "Vex comes in 3 months", then "Council in 6 months".
- **Your council of agents:** the General (Brannoc, Sergeant Wynn or Sir Tobin), the Spy (The Whisper, once hired) and the Witch (Morwen, if you've dealt with her). Some requests can be handled by sending one of them instead of spending gold; a sent agent is away until next month, and missions go worse without your General (`AGENTS`, `send()`).
- **The Fox:** a chained storyline. Have the bread thief flogged in May and he returns as a bandit chief in August, blockades the salt road in October and walks into your hall in December.
- **Hidden unrest:** low favor or heavy taxes month after month brings a mob to the gate (`S.unrest`, `RIOT`).
- **$1.99 full-year unlock:** spring (March–May) is free; the unlock screen appears at the end of May. Uses `@capgo/native-purchases` (product `emberfall_full_unlock`), like TypeMonkey; in a browser it's a demo unlock. Restore purchase is in Settings.
- **Harder late game:** favor drifts down when it's high and after July; the battle and the council need more preparation; three late buildings (Watchtowers, Infirmary, Great Hall).
- **Comfort:** first-time tips (night, Treasury, War Room, agents, reports), tap any resource for its monthly breakdown, text speed and larger text, vibration (`@capacitor/haptics`), a confirm before New Reign overwrites a save.
- **Endings:** "Your reign in numbers" and memorable moments on every ending; hints for locked endings.
- **Feel:** title, autumn and winter themes; the throne room shows lanterns after feasts, mourning drapes after the battle, Vex's banners while you're his vassal, and green fire while Morwen holds court.
- **Grain market** in the Treasury: buy and sell grain with the Guild (cheap at harvest, dear in winter).
- **16 characters, 19 endings:** 7 ways to lose your reign early, and 12 final endings decided by the Midwinter Council. Choices carry forward: a marriage brings an ally, a broken pact brings a curse, the spy you pay unmasks a traitor, your son finds a tunnel.
- **Animated throne room:** visitors walk in through the great doors, talk with animated portraits and react with emotes and particles.
- **Synthesized music and sound:** an original medieval theme played on lute by day, bells at month's end and war drums when Vex comes; footsteps, doors, coins, bells and a babble "voice" for each character. No audio files.
- **Animated castle vistas** for the title, each night and every ending (dawn, moonlight, fire, snow).
- **Chronicle** of your big decisions, an **endings collection**, autosave, and Music/Sound switches.
- Fully offline. No accounts, no ads, no tracking.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole game: one file of HTML, CSS and JavaScript. All art is drawn in code. |
| `fonts/` | Cinzel (names, headings), Alegreya (story text, numbers) and Pixelify Sans (logo, top bar), all SIL Open Font License (see `fonts/OFL.txt`), bundled so the game works offline. |
| `app/` | Capacitor wrapper for the iPhone and Android apps (same setup as TypeMonkey). |
| `app/resources/` | App icon, adaptive-icon layers and splash screens. |
| `app/store/` | App Store listing text (`APP_STORE.md`) and 1206×2622 screenshots. |

The Privacy Policy, Terms, Support and marketing pages live on the public website repo, at
**https://wolfhopecom.github.io/emberfall/**, so this repo can be made private at any time.

## Play it

Open `index.html` in Safari or Chrome. Tap **New Reign** (the tap also starts the music).
Add `?fast` to the address to skip animations when testing.

## Build the iPhone app (on the Mac)

```
cd app
npm install
python3 build_app.py --setup     # first time only: adds ios/ and android/ and the icons
npm run ios                       # rebuilds and opens Xcode
```

After changing `index.html`, run `python3 build_app.py` again, then **Product → Clean Build Folder** and **▶ Run** in Xcode.
To set the version: `python3 build_app.py --set-version 1.0.1`.

To re-render the icon, splash screens and App Store screenshots: `cd app && npx playwright install chromium && npm run render`.

## Writing more story

Events live in the `E` array in `index.html` (`m` is the month: 1 = March … 12 = February). Each one is:

```js
{m:3, who:"morwen", req:()=>has("someFlag"),   // req is optional
 text:"What they say.",
 choices:[{t:"Button text", cost:{gold:20},        // cost is optional
           go:()=>{ fx({gold:-20,favor:5}); set("flag"); note("Line for the Chronicle."); return "Their reply."; }}]}
```

Random everyday petitions live in `R` (tagged by season). Buildings are in `BUILD`, the month-end numbers in `ledgerRows()`, endings in `ENDINGS`, and `battle()` decides how the July battle ends. `BATTLE_MONTH` (July) runs `siege()`; surviving outcomes go through `aftermath()` into August. February ends with `finale()`, `councilScore()` and `finalEnding()`.

© 2026 Wolfhope. All rights reserved.
