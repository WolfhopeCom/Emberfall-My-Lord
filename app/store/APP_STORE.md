# Emberfall: My Lord · App Store listing

| Field | Value |
|---|---|
| App name | Emberfall: My Lord |
| Subtitle (30) | Rule the throne. Choose a fate. |
| Bundle ID | com.wolfhope.emberfall |
| Category | Games → Role Playing (secondary: Games → Simulation) |
| Price | Free download; March to June is free (the game asks for the unlock on the eve of the July battle) |
| In-App Purchase | Non-Consumable · Product ID `emberfall_full_unlock` · Reference name "Full Year Unlock" · **$1.99** (Tier 2) |
| Privacy Policy URL | https://wolfhopecom.github.io/emberfall/privacy.html |
| Support URL | https://wolfhopecom.github.io/emberfall/support.html |
| Marketing URL | https://wolfhopecom.github.io/emberfall/ |
| Data collection | Data Not Collected |
| Age rating | Expect 9+ (Infrequent/Mild Cartoon or Fantasy Violence: battles and deaths are described in text, never shown) |
| Screenshots | `screenshots/` (2622×1206 landscape, iPhone 6.9") |

## Promotional text (170)
Your father didn't die in his sleep. Rule Emberfall for one year, hold the ford against Baron Vex, and find his killer before the lords vote on your crown.

## Description
Your father is dead, and the throne of Emberfall is yours. Everyone says he died in his sleep. His last letter says otherwise.

Rule a small river city for one year, from spring thaw to midwinter. Every day, someone climbs to your throne with a problem: a starving village, a marriage offer for your daughter, the strange ferrywoman of the Ember, with a bargain she won't explain, an envoy from Baron Vex, who wants your city. Every answer costs gold, grain, soldiers or your people's love.

At night, walk the castle. Set taxes in the treasury, send soldiers out from the war room, build walls with your master mason, and spend the evening with your family.

In high summer, Vex's army crosses the ford. Command the battle yourself. Survive it, and your cousin Corvin arrives with a will that names him heir. Eleven lords will vote on who rules Emberfall. Win them over, gather the evidence, and at the Midwinter Council, decide whether to name your father's murderer in front of them all.

• A full year of story in two chapters, with a mystery that runs through all of it
• A playable siege: your preparations and your orders on the night decide the battle
• Eleven lords to win over before the Midwinter Council
• Your family, with conversations that change as the year does
• 21 endings: a stolen crown, a burning city, a kingdom saved, and stranger fates
• Hand-drawn pixel art with real lighting, seasons and weather, plus an original soundtrack
• Plays fully offline. No accounts, no ads, no tracking

How will you be remembered, my lord?

## Keywords (100)
kingdom,medieval,choices,story,throne,king,lord,pixel,narrative,castle,ruler,fantasy,decisions,rpg

## What's New (1.0)
The throne of Emberfall awaits.

## Review notes
No account or login. The game is fully offline. Tap New Reign, then pick an answer for each visitor. A full year (March to February) takes about an hour.

## In-App Purchase setup (App Store Connect)
1. App → **Monetization → In-App Purchases → +** → **Non-Consumable**.
2. Reference name: `Full Year Unlock` · Product ID: `emberfall_full_unlock` (must match exactly).
3. Price: **$1.99**. Availability: all countries.
4. Display name: `The Full Year` · Description: `Unlock Chapter Two, August to February: Corvin's claim, the poisoner, the King's war, winter and all 21 endings.`
5. Review screenshot: the unlock screen on the eve of the July battle ("The Banners Are Coming"). Review notes: "Play March to June (about 30 minutes). At the end of June, tap Sleep on the night map and the unlock screen appears before the July battle. Restore Purchase is in Settings and on the unlock screen."
6. Attach the IAP to the version on the version page before submitting.

## Review notes (add to the IAP note above)
March to June (months 1–4) is free. The unlock is a one-time non-consumable; Restore purchase is in Settings and on the unlock screen. No account, no server: StoreKit only.


## Testing the unlock before the in-app purchase exists
`build_app.py` copies `store/Emberfall.storekit` into the iOS project and turns on StoreKit testing in the Xcode scheme. Runs started from Xcode then use a local test store: the $1.99 unlock works and nothing is charged. TestFlight and App Store builds ignore this file and use the real product `emberfall_full_unlock`, which must be created in App Store Connect (non-consumable, $1.99) before submitting.
