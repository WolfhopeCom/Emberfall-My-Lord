# Submitting Emberfall: My Lord 1.0, step by step

Go through this from top to bottom. Each step says where to click and what to paste. Everything to paste is in a grey box, or in `APP_STORE.md` and `REVIEW_NOTES.txt` in this folder. App Store Connect is at https://appstoreconnect.apple.com.

Allow about 2 hours, plus time to upload the build. Your phone needs to be charged for the screen recording.

---

## 0. Before anything else (5 min)

1. **Agreements.** In App Store Connect, open **Business** (on older layouts, **Agreements, Tax, and Banking**). The **Paid Apps** agreement must show **Active**, with bank and tax info filled in. If it doesn't, in-app purchases can't be sold, and Apple will reject the app because the purchase fails. Finish it first; it can take a while to activate.
2. **Build the store version on the Mac.** In Terminal, one line at a time (press Return after each and wait for it to finish):
   ```
   cd ~/Emberfall-My-Lord
   ```
   (If that folder isn't there, find it with `find ~ -maxdepth 4 -type d -name "Emberfall-My-Lord" 2>/dev/null` and `cd` to what it prints.)
   ```
   git pull
   ```
   ```
   cd app
   ```
   ```
   npm install
   ```
   ```
   python3 build_app.py --set-version 1.0.0 --build 10
   ```
   This keeps version 1.0.0 and sets build number 10, safely higher than anything uploaded before (Apple refuses a build number it has already seen for this version; if it ever says so, run it again with `--build 11`). The version here must match the version on the App Store Connect page (step 3.4).
   ```
   python3 build_app.py
   ```
   **Never add `--tester` for this one.** The checklist at the end must finish with **READY to archive** and show, among others:
   - "www/ is a store build (no tester switch at all)"
   - "app icon is the Emberfall crown"
   - "UIScene life cycle adopted" (this is the fix for the iOS 27 launch crash that hit TypeMonkey)

   If anything says **FAIL**, stop and send me the whole output.
   ```
   npx cap open ios
   ```
3. In Xcode: **Product → Clean Build Folder**, then **Product → Archive**, then **Distribute App → App Store Connect → Upload**. Wait for the email "has completed processing" (10–30 min).
4. Quick check on the iPhone with the TestFlight copy of this build: launch it, look at the title screen (no TESTER text), and open **Settings**: the bottom line should say "Build" followed by a code, not "preview".

## 1. Create the in-app purchase (10 min)

1. **Apps → Emberfall: My Lord**. In the left sidebar, under **Monetization**, click **In-App Purchases**, then the blue **+** button.
2. Type: **Non-Consumable**. Reference Name: `Full Year Unlock`. Product ID: `emberfall_full_unlock` (copy it exactly; it can never be changed or reused). Click **Create**.
3. **Availability**: all countries or regions → **Save**.
4. **Price Schedule → Add Pricing**: base country United States, price **$1.99** → **Next** → keep Apple's other prices → **Confirm**.
5. **Family Sharing**: leave it **off**.
6. **App Store Localization → + / Create**: English (U.S.).
   - Display Name: `The Full Year`
   - Description: `Unlock July to February and all 21 endings.`
7. **Review Information**:
   - Screenshot: upload `app/store/iap-review-screenshot-2796x1290.png` (the real unlock screen).
   - Review Notes: paste
     ```
     Non-consumable that unlocks the rest of the game (July to February: the Battle of the Ford, Chapter Two and all 21 endings). March to June is free.
     Fastest way to see it: title screen > Settings > "Unlock the full game · $1.99" (Restore purchase is right below it).
     In normal play it appears at the end of June: on the night castle map tap "Sleep until July" and the unlock screen "The Banners Are Coming" opens (Unlock / Restore purchase / Not now). About 230 taps from a new game; Settings > Text speed > Instant makes it quicker.
     No account or server. StoreKit only.
     ```
8. **Save**. The status should become **Ready to Submit**. If it says **Missing Metadata**, one of the fields above is empty.

## 2. Make the screen recording (20 min, iPhone)

Apple asked TypeMonkey for this, so send it up front. It must be **3 minutes or less**, filmed on a real iPhone, and **start with launching the app**.

**Setup the day before or this morning (not filmed):**
- Install this version from **TestFlight**. TestFlight purchases use the sandbox and cost nothing. The IAP from step 1 must be saved first, or the unlock will say "The App Store doesn't have this unlock available yet". It can take up to an hour after creating the IAP before the sandbox sees it.
- Play a reign up to the **night at the end of June**, then visit the "!" rooms so that only the Sleep button is left. Leave it there (the game autosaves). Don't buy anything yet. If you already bought the unlock on this Apple Account, delete and reinstall the app; Restore will still work at the end of the recording.
- Turn on **Do Not Disturb**. Add **Screen Recording** to Control Center. Hold the phone in landscape.
- Swipe the app away so the recording starts from a cold launch.

**Shot list (about 2:45):**

| Time | What to do on screen |
|---|---|
| 0:00 | Start Screen Recording. Home screen: tap the Emberfall icon. Splash screen, then the title screen. |
| 0:10 | Tap **Settings**. Pause 2 seconds on "Unlock the full game · $1.99" and "Restore purchase". Tap **Back**. |
| 0:20 | Tap **Continue Reign**. The June night castle map opens. Tap one room (for example the **Treasury**), let the scene play, tap **Leave the Treasury** to return to the map. |
| 0:50 | Tap **Sleep until July**. The unlock screen "The Banners Are Coming" appears. Pause 3 seconds. |
| 1:00 | Tap **Unlock the full game · $1.99**. The Apple purchase sheet shows **[Sandbox]**. Confirm with the sandbox or TestFlight account. The toast "Thank you, my lord! The full game is yours." appears and July begins. |
| 1:25 | Paid content: the July month card, answer the first July scene, then the war map and the **Battle of the Ford**. Choose an order or two. |
| 2:20 | Tap **⚙** (top right). Settings now says "The full game is unlocked. Thank you!" Tap **Restore purchase** and wait for "Purchase restored! The full game is unlocked." |
| 2:40 | Tap **Back**. Stop the recording. |

Trim the start and end in Photos if needed, and check it's under 3:00. AirDrop it to the Mac.

## 3. Fill in the version page (30 min)

**Apps → Emberfall: My Lord → iOS App → 1.0 Prepare for Submission.**

1. **Previews and Screenshots** → **View All Sizes in Media Manager**.
   - **iPhone 6.9" Display**: drag in the 6 files from `app/store/screenshots/6.9in/` in order 01 to 06.
   - **iPhone 6.3" Display**: drag in the 6 files from `app/store/screenshots/6.3in/` in order 01 to 06.
   - No iPad screenshots are needed, because the app is iPhone only. Don't use `screenshots/old/`.
2. **Promotional Text, Description, Keywords**: paste from `APP_STORE.md`. Keywords:
   ```
   kingdom,medieval,choices,story,throne,king,pixel,narrative,castle,ruler,fantasy,rpg,mystery,siege
   ```
3. **Support URL**: `https://wolfhopecom.github.io/emberfall/support.html`
   **Marketing URL**: `https://wolfhopecom.github.io/emberfall/`
4. **Version**: must match the build's version exactly (Xcode → App target → General → Version, for example `1.0` or `1.0.0`; App Store Connect treats these as different). **Copyright**: `2026 Wolfhope`.
5. **Build** → **Add Build** (the + next to Build) → choose the build you uploaded in step 0 → **Done**. If it asks about encryption, answer **None of the algorithms mentioned above**. It normally doesn't ask, because Info.plist already says no.
6. **In-App Purchases and Subscriptions** (further down the same page) → **Select In-App Purchases or Subscriptions** → tick **Full Year Unlock (emberfall_full_unlock)** → **Done**. ⚠ A first IAP is only reviewed when it's attached here. If it isn't, Apple rejects the app because the unlock fails.
7. **App Review Information**:
   - Sign-in required: **untick** (no account).
   - Contact: Harrison Wolfhope, your phone number, `wolfhopeco@gmail.com`.
   - **Notes**: paste the whole of `REVIEW_NOTES.txt` (about 3,400 characters; the limit is 4,000).
   - **Attachment**: upload the screen recording (.mov or .mp4).
8. **App Store Version Release**: choose **Manually release this version** if you want to pick the launch day, or **Automatically**.
9. Click **Save** (top right).

## 4. App Information (5 min)

Left sidebar → **General → App Information**.
- Subtitle: `Rule. Scheme. Find the killer.` (exactly 30 characters)
- Category: Primary **Games**, subcategory **Role Playing**. Secondary **Games**, subcategory **Simulation**.
- **Content Rights** → Edit → **Yes, it contains, shows, or accesses third-party content, and I have the necessary rights**. (These are the bundled open-license fonts; everything else is original.)
- **Age Rating** → Edit and answer:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | Infrequent/Mild |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Violent themes (if asked) | Yes |
| Profanity or Crude Humor | None |
| Mature or Suggestive Themes | Infrequent/Mild |
| Horror/Fear Themes | Infrequent/Mild |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | Infrequent/Mild |
| Sexual Content or Nudity / Graphic Sexual Content and Nudity | None |
| Simulated Gambling / Contests | None |
| Unrestricted Web Access | No |
| User-generated content / messaging / chat / account creation | No |
| Advertising | No |
| Parental controls / age assurance | No |
| Loot boxes | No |
| Made for Kids | **No**. Don't pick the Kids category. |

Expect **13+** (maybe 9+). Accept what Apple calculates, and don't override it lower. **Save**.

## 5. App Privacy (3 min)

Left sidebar → **Trust & Safety** (or **App Privacy** on older layouts).
- Privacy Policy URL: `https://wolfhopecom.github.io/emberfall/privacy.html` → **Save**.
- **Get Started / Edit** next to Data Types → "Do you or your third-party partners collect data from this app?" → **No, we do not collect data from this app** → **Save**.
- Click **Publish**. The label should read **Data Not Collected**.

## 6. Price (2 min)

Left sidebar → **Monetization → Pricing and Availability**.
- **Price Schedule → Add Pricing**: United States, **USD 0.00 (Free)** → Confirm.
- **App Availability**: all countries or regions.
- **iPad and Mac availability**: leaving the app available on Apple silicon Macs and iPad is fine (it runs in iPhone compatibility mode, in landscape). To be extra careful, you can untick **Make this app available on Mac**.

## 7. Submit (2 min)

1. Back on the **1.0 Prepare for Submission** page, check that the build, screenshots, review notes, attachment and the attached IAP are all shown.
2. Click **Add for Review** (top right). If App Store Connect lists anything missing, fix it and come back.
3. On the **Submission** screen, check that both **Emberfall: My Lord 1.0** and **Full Year Unlock** are listed, then click **Submit for Review**.
4. The status changes to **Waiting for Review**. Review usually takes about 24–48 hours. Watch the email for "Ready for Distribution" or "Rejected / Information Needed".

## 8. If Apple asks for more information (Guideline 2.1, Information Needed)

Open **App Review → Messages** (or **Resolution Center**) and reply in that same thread. Don't make a new submission. Paste the template below, attach the screen recording again, and also make sure the full `REVIEW_NOTES.txt` is still in the App Review Information → Notes field (Apple asked TypeMonkey for both).

```
Hello, and thank you for reviewing Emberfall: My Lord.

Here is the information you asked for. The same text is also in the App Review Information notes, and the screen recording is attached.

1. Screen recording: attached. It was filmed on a physical iPhone, starts at app launch, and shows the title screen, Settings, the night castle map, the in-app purchase screen, a sandbox purchase, the paid content after it (July and the Battle of the Ford) and Restore purchase.

2. Purpose and audience: a single-player story game for teens and adults (general audience, not made for children). The player rules a fictional medieval city for one in-game year: answering petitioners, managing gold, grain, soldiers and favor, defending the city in a battle, and solving their father's murder before a council of lords votes on their crown.

3. Setup and access: no account, login or demo account is needed, and the game works fully offline. Launch, tap New Reign, then tap an answer for each visitor. Settings is on the title screen and the gear icon in the top bar.

4. External services: none. There is no server, analytics, advertising, tracking or third-party SDK. The only network use is Apple's StoreKit for the in-app purchase.

5. Regional differences: none. The content and features are the same in every storefront, English only.

6. Regulated industry or protected material: not applicable. All story, art and music are original works by Wolfhope. The bundled fonts are under the SIL Open Font License.

7. In-app purchase: one non-consumable, "The Full Year" (emberfall_full_unlock), $1.99. March to June is free; the purchase unlocks July to February and all 21 endings. To reach it quickly: title screen > Settings > "Unlock the full game · $1.99" (Restore purchase is below it). In normal play it appears at the end of June, when you tap "Sleep until July" on the night castle map.

Please let me know if anything else would help.

Best regards,
Harrison Wolfhope
Wolfhope · wolfhopeco@gmail.com
```

For any other rejection: read the guideline number Apple cites, reply in the same thread and don't argue. If something needs a fix, fix it, upload a new build (`python3 build_app.py --set-version <same version as now>` keeps the version and raises the build number by 1), select the new build on the version page and click **Resubmit to App Review**.

## Last checks before clicking Submit
- [ ] The Paid Apps agreement is **Active**.
- [ ] The build is a store build (no TESTER text on the title screen). Settings shows "Build" followed by a code.
- [ ] The IAP is **Ready to Submit** and ticked on the version page.
- [ ] Review notes are pasted and the recording is attached.
- [ ] Screenshots are in both iPhone slots.
- [ ] The privacy, support and terms pages are live on wolfhopecom.github.io. Push the website changes first, then open each URL on your phone.
