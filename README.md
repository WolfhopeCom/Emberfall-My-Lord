# Emberfall: My Lord 👑🔥

A pixel-art medieval story game. Your father is dead and the throne of **Emberfall** is yours. Over your first year, month by month, petitioners walk up the red carpet to your throne: villagers, your family, a witch from the fen, a moneylender, a spy and the envoy of the Baron who wants your city. Every answer costs something. In high summer, Baron Vex's banners appear on the river.

## The game

- **4 resources:** Gold, Grain, Army and Favor. Let any one collapse and your reign ends early (famine, revolt, or the Guild owns you).
- **A year in 12 months** with seasons (spring rain, summer sun, autumn leaves, winter snow), a month-end ledger, and **Hildra's Works**: build a granary, market, chapel, barracks or stone walls.
- **Night in the castle** at each month's end (every room is optional): the **Treasury** (ledger, next-month forecast, tax rate), the **War Room** (send 5/10/20 soldiers on missions; they report back next month), the **Mason's Yard** (one building a month) and **Family Quarters** (an evening with Elinor, Maren or Tobin changes the story). One surprise event happens in a random room each night. Some nights also have a **story scene** in a set room (marked with a gold "!") that must be seen before you can sleep: your father's letter, Brannoc and Aldric's quarrel, the smugglers' tunnel, Vex's chest of gold. They live in `STORY_NIGHTS`.
- **Soldiers cost gold wages and grain**, so a bigger army needs a healthy treasury.
- **Chapter One is playable now:** March to July, ending with the Vex battle. Autumn and winter are next.
- **15 characters, 13 endings so far.** Choices carry forward: a marriage brings an ally, a broken pact brings a curse, the spy you pay unmasks a traitor, your son finds a tunnel.
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

Random everyday petitions live in `R` (tagged by season). Buildings are in `BUILD`, the month-end numbers in `ledgerRows()`, endings in `ENDINGS`, and `battle()` decides how the July battle ends. `LAST_MONTH` is where the current chapter stops.

© 2026 Wolfhope. All rights reserved.
