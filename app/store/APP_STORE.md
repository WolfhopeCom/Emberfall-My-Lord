# Emberfall: My Lord · App Store listing (version 1.1)

> **1.1 (iPad)**: submit only after 1.0 has been approved. What changed for the listing: the **Devices** row, a new **iPad 13" screenshots** slot, the **What's New** text, and one line in the review notes. Everything else below is unchanged from 1.0.

Checked against the current `index.html` on 2026-10-22. The step-by-step submission guide is `SUBMIT_TOMORROW.md`, and the review notes to paste are in `REVIEW_NOTES.txt`.

| Field | Value | Checked |
|---|---|---|
| App name | Emberfall: My Lord | 18 characters |
| Subtitle (max 30) | `Rule. Scheme. Find the killer.` | 30 characters. The old subtitle, "Rule the throne. Choose a fate.", was 31, one over the limit. |
| Bundle ID | com.wolfhope.emberfall | matches `capacitor.config.json` |
| SKU | `emberfall-ios-1` (any unique text works) | |
| Primary language | English (U.S.) | |
| Category | Primary **Games → Role Playing**, secondary **Games → Simulation** | Fits a choice-driven story game with resource management. Don't choose Kids or Family. |
| Price | **Free** (the app itself is USD 0.00), with one in-app purchase | |
| Free content | March to June (months 1–4 of 12). The unlock screen appears when the player taps **Sleep until July** at the end of June. Settings also has an Unlock button at any time. | `FREE_MONTHS=4`, `showNight()`, `openSettings()` |
| In-app purchase | Non-consumable · Product ID `emberfall_full_unlock` · Reference name `Full Year Unlock` · **$1.99** | matches `IAP_ID` and `Emberfall.storekit` |
| Endings | **21** | `Object.keys(ENDINGS).length` = 21. The title screen shows "Endings (0/21)". |
| Privacy Policy URL | https://wolfhopecom.github.io/emberfall/privacy.html | page updated |
| Support URL | https://wolfhopecom.github.io/emberfall/support.html | page updated |
| Marketing URL | https://wolfhopecom.github.io/emberfall/ | page updated |
| Copyright | `2026 Wolfhope` | |
| App Privacy | **Data Not Collected** | The game has no network code except StoreKit, and saves only to on-device storage. |
| Export compliance | No non-exempt encryption | `ITSAppUsesNonExemptEncryption = NO` is in Info.plist (`build_app.py`), so App Store Connect won't ask. If it does ask: "None of the algorithms mentioned above". |
| Content rights | "Yes, it contains third-party content, and I have the necessary rights" | The only third-party content is the bundled fonts (Cinzel, Alegreya, Pixelify Sans), all under the SIL Open Font License. Everything else is original. |
| Devices | **1.1: iPhone and iPad.** iPhone in landscape; iPad in every orientation, with Split View, Slide Over and Stage Manager. | `TARGETED_DEVICE_FAMILY = "1,2"`, `UISupportedInterfaceOrientations~ipad` = all four (`build_app.py`). iPad screenshots are now **required** (13" slot). |
| Screenshots | `screenshots/6.9in/` (2868×1320) and `screenshots/6.3in/` (2622×1206), both landscape, 6 each | See "Screenshots" below. |

## Promotional text (max 170)
155 characters:

```
Your father didn't die in his sleep. Rule Emberfall for one year, hold the ford against Baron Vex, and find his killer before the lords vote on your crown.
```

## Description
```
Your father is dead, and the throne of Emberfall is yours. Everyone says he died in his sleep. His last letter says otherwise.

Rule a small river city for one year, from the spring thaw to the end of winter. Every day, someone climbs to your throne with a problem: a starving village, a marriage offer for your daughter, a strange ferrywoman with a bargain she won't explain, an envoy from Baron Vex, who wants your city. Every answer costs gold, grain, soldiers or your people's love.

At night, walk the castle. Set taxes in the treasury, send soldiers out from the war room, build walls with your master mason, and spend the evening with your family.

In high summer, Vex's army comes for the ford. Command the battle yourself. Survive it, and your cousin Corvin arrives with a will that names him heir. Eleven lords will vote on who rules Emberfall. Win them over, gather the evidence, and in the King's hall in February, decide whether to name your father's murderer in front of them all.

• A full year of story in two chapters, with a mystery that runs through all of it
• A playable battle: your preparations and your orders on the night decide it
• Eleven lords to win over before the Lords' Council
• Your family, with conversations that change as the year does
• 21 endings: a stolen crown, a burning city, a kingdom saved, and stranger fates
• Pixel art with real lighting, seasons and weather, plus an original soundtrack
• Plays fully offline. No accounts, no ads, no tracking

March to June is free. One in-app purchase unlocks the rest of the year, from the battle in July to the council in February, with all 21 endings.

How will you be remembered, my lord?
```

Changes from the previous draft:
- "Hand-drawn pixel art" is now "Pixel art", because the art is drawn in code.
- The free and paid split is stated plainly (Guideline 3.1.1 and 2.3).

## Keywords (max 100)
97 characters. Words already in the app name ("Emberfall", "Lord") are left out, because Apple indexes the name anyway.

```
kingdom,medieval,choices,story,throne,king,pixel,narrative,castle,ruler,fantasy,rpg,mystery,siege
```

## What's New (1.1)
```
Emberfall now rules on iPad! Play in landscape or portrait, in Split View or Stage Manager, with crisp pixel art at every size.
• Larger story text and portraits on iPad
• The throne room keeps its true shape on every iPhone too
• The Mason's Yard has one moon again
• Small fixes for rotating the screen mid-conversation
```

## What's New (1.0)
Not shown for a first release. If App Store Connect asks for it anyway: `First release.`

## Age rating questionnaire
Apple's 2025–26 system has the tiers 4+, 9+, 13+, 16+ and 18+, plus questions about in-app controls, capabilities, medical or wellness topics and violent themes. Answer honestly and accept the rating Apple calculates. **Don't** set a lower age, and don't tick "Made for Kids".

| Question | Answer | Why |
|---|---|---|
| Cartoon or Fantasy Violence | **Infrequent/Mild** | Small pixel-art soldiers fight in the July battle (and in a winter battle). There is a duel with Baron Vex. Deaths are described in text, with no blood or gore on screen. |
| Realistic Violence | None | Stylised pixel art in a fictional fantasy world |
| Prolonged Graphic or Sadistic Realistic Violence | None | |
| Violent themes (new question, if shown) | **Yes**: a murder mystery (the old lord was poisoned), a battle, a traitor who can be hanged (one line of text) and a thief who can be flogged (mentioned in text) | Nothing is shown graphically |
| Mature or Suggestive Themes | **Infrequent/Mild** | Murder by poison, an arranged political marriage, an execution mentioned in text |
| Horror/Fear Themes | **Infrequent/Mild** | A witch, a curse and "green fire" |
| Alcohol, Tobacco, or Drug Use or References | **Infrequent/Mild** | Wine at feasts. Poison is a murder weapon, not drug use. |
| Medical/Treatment Information | None | A character's fever is a story beat, not medical information |
| Profanity or Crude Humor | None | |
| Sexual Content or Nudity / Graphic Sexual Content | None | |
| Simulated Gambling / Contests | None | |
| Unrestricted Web Access | No | |
| User-Generated Content, messaging, social features, account creation | No | |
| Advertising | No | |
| Parental controls / age assurance in the app | No | |
| Loot boxes / random paid items | No | The single purchase is a fixed unlock |

The expected result is **13+**, or possibly 9+. Either is fine, and 13+ matches the Terms of Service ("13 or older").

## In-app purchase (App Store Connect values)
| Field | Value |
|---|---|
| Type | Non-Consumable |
| Reference name | `Full Year Unlock` |
| Product ID | `emberfall_full_unlock` (must match exactly; it can never be reused) |
| Price | USD **1.99**, all countries and regions |
| Family Sharing | Off (matches `Emberfall.storekit`; it can't be turned off later once it's on) |
| Display name (en-US, max 30) | `The Full Year` |
| Description (en-US, max 45) | `Unlock July to February and all 21 endings.` (43 characters) |
| Review screenshot | `iap-review-screenshot-2796x1290.png`: the real unlock screen at the end of June, rendered from the current game |
| Review notes | below |

The old description, "Unlock Chapter Two, August to February: …", was over the 45-character limit and wrong: the unlock starts at the July battle, not August.

**IAP review notes:**
```
Non-consumable that unlocks the rest of the game (July to February: the Battle of the Ford, Chapter Two and all 21 endings). March to June is free.
Fastest way to see it: title screen > Settings > "Unlock the full game · $1.99" (Restore purchase is right below it).
In normal play it appears at the end of June: on the night castle map tap "Sleep until July" and the unlock screen "The Banners Are Coming" opens (Unlock / Restore purchase / Not now). About 230 taps from a new game; Settings > Text speed > Instant makes it quicker.
No account or server. StoreKit only.
```

## Review notes (App Review Information → Notes)
Paste the full text of `REVIEW_NOTES.txt`. It is about 3,400 characters, under the 4,000 limit, and answers all seven points Apple asked TypeMonkey for.

## Screenshots
These are rendered from the current game (Cinzel title font) by `tools/render_store.js`, which plays a real year with a bot. Nothing is staged. Every image was checked by eye: none shows "demo", "test", "tester", "beta" or "prototype", there are no toasts, and nothing is gory (the 2026 rules want marketing assets that suit all audiences).

| # | File | Moment |
|---|---|---|
| 1 | `01-title.png` | Title screen at dusk ("EMBERFALL · MY LORD", New Reign, Endings 0/21, Settings) |
| 2 | `02-throne-petition.png` | Throne room, April: Sir Gerrit, Vex's envoy, demands tribute (3 choices with costs) |
| 3 | `03-night-castle.png` | Night castle map at the end of April, with rooms needing a visit marked "!" |
| 4 | `04-battle-of-the-ford.png` | The Battle of the Ford: Vex's host at the river, archers on the walls, 4 orders |
| 5 | `05-world-map.png` | The River Country map |
| 6 | `06-ending.png` | The ending "The Ember Crown" with "Your reign in numbers" |

- `screenshots/6.9in/`: 2868×1320. Upload these to the **iPhone 6.9" Display** slot (the Dynamic Island, large display class). App Store Connect also scales them for smaller iPhones.
- `screenshots/6.3in/`: 2622×1206. Upload these to the **iPhone 6.3" Display** slot (the Dynamic Island, medium display class). Apple's screenshot specifications page, as of October 2026, lists this class as required ("At least one screenshot for iPhone with Dynamic Island (medium display)"). Uploading both sets covers either reading of the rules.
- `screenshots/old/`: the previous October 13 set (Pixelify title, 2622×1206). Don't upload these.
- Screenshots 4 and 6 come from paid content. That's allowed, because the description says plainly that March to June is free and the rest is a $1.99 unlock.

## iPad screenshots (1.1)
App Store Connect requires at least one screenshot in the **iPad 13" Display** slot once the app runs on iPad (accepted: 2064×2752 portrait or 2752×2064 landscape; 2048×2732 also works). The 11" and smaller iPad slots are filled from it automatically.

Rendered with `tools/render_store.js <outdir> 1376 1032 year 2` (landscape, 2752×2064) and `... 1032 1376 year 2` (portrait, 2064×2752). Upload the six in `screenshots/ipad-13in/`, in this order (same story as the iPhone set):

| # | File | Moment |
|---|---|---|
| 1 | `01-title.png` | Title screen at dusk |
| 2 | `02-throne-petition.png` | Throne room petition with choices |
| 3 | `03-night-castle.png` | Night castle map |
| 4 | `04-battle-of-the-ford.png` | The Battle of the Ford (paid content, allowed: the description says what is free) |
| 5 | `05-world-map.png` | The River Country map |
| 6 | `06-portrait.png` | The game held upright (portrait), to show it works both ways |

Check each by eye before uploading (no toasts, nothing gory, no "test"/"demo" text), as for the iPhone set.

## Testing the unlock before the in-app purchase exists
`build_app.py` copies `store/Emberfall.storekit` into the iOS project and turns on StoreKit testing in the Xcode scheme. Runs started from Xcode then use a local test store: the $1.99 unlock works and nothing is charged. TestFlight and App Store builds ignore this file and use the real product `emberfall_full_unlock`, which must be created in App Store Connect (non-consumable, $1.99) before submitting. In TestFlight the purchase uses the sandbox and is free.

## Re-rendering
```
cd emberfall-my-lord
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=<path to playwright> node app/store/tools/render_store.js <outdir> 956 440 year      # 2868x1320 candidates
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=<path to playwright> node app/store/tools/render_store.js <outdir> 874 402 year      # 2622x1206 candidates
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=<path to playwright> node app/store/tools/render_store.js <outdir> 932 430 paywall   # IAP review screenshot 2796x1290
node app/store/tools/playthrough.js instant   # counts the taps from New Reign to the unlock screen
```
