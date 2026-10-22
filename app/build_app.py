#!/usr/bin/env python3
"""Build Emberfall: My Lord for the native (Capacitor) app.

  python3 build_app.py                 copy ../index.html and ../fonts/ to www/, apply native settings, `npx cap sync`,
                                       then check the iOS project and print a release checklist
  python3 build_app.py --setup         first time: also `npx cap add ios/android` for missing platforms + app icons
  python3 build_app.py --icons         (re)generate app icons and splash screens from resources/
  python3 build_app.py --no-sync       build and copy only (the iOS project is NOT updated: don't archive after this)
  python3 build_app.py --tester        a test build with the whole game unlocked (never upload this one)
  python3 build_app.py --no-scene      leave out the UIScene life cycle patch (not recommended: see patch_scene)
  python3 build_app.py --set-version 1.2.0 [--build 7]
                                       set the store version (and build number) for iOS, Android and package.json

The game is never edited here: ../index.html stays the single source of truth.
Exit code 0 means every check passed; anything else means: do not archive or upload this build.
"""
import argparse, json, pathlib, platform, plistlib, re, shutil, subprocess, sys

APP = pathlib.Path(__file__).resolve().parent
ROOT = APP.parent
WWW = APP / "www"
IOS = APP / "ios"
ANDROID = APP / "android"
CONFIG = json.loads((APP / "capacitor.config.json").read_text())
APP_NAME = CONFIG["appName"]
APP_ID = CONFIG["appId"]

MIN_IOS = "15.0"          # @capgo/native-purchases uses StoreKit 2 (iOS 15+); its newer releases require 15.0
LANDSCAPE = ["UIInterfaceOrientationLandscapeRight", "UIInterfaceOrientationLandscapeLeft"]
TESTER_MARK = "window.EF_TESTER=true"
# Native plugin classes that must be registered (ios/App/App/capacitor.config.json "packageClassList").
REQUIRED_PLUGINS = {"NativePurchasesPlugin": "@capgo/native-purchases", "HapticsPlugin": "@capacitor/haptics"}
EXPECTED_PLUGINS = {"SplashScreenPlugin": "@capacitor/splash-screen", "StatusBarPlugin": "@capacitor/status-bar"}
NPM_PLUGINS = ["@capacitor/haptics", "@capacitor/splash-screen", "@capacitor/status-bar", "@capgo/native-purchases"]


def run(cmd, cwd=APP, check=True):
    print("$", " ".join(cmd))
    code = subprocess.run(cmd, cwd=cwd).returncode
    if check and code != 0:
        die(f"`{' '.join(cmd)}` failed (exit code {code}). Read the error above, fix it, and run this script again.")
    return code


def die(msg):
    bar = "!" * 70
    sys.exit(f"\n{bar}\nBUILD FAILED: {msg}\nDo NOT archive or upload from Xcode until this script finishes without errors.\n{bar}")


def have_capacitor():
    return (APP / "node_modules" / "@capacitor" / "cli").is_dir()


def ver_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v))[:3]) or (0,)


def build_web(tester=False):
    WWW.mkdir(exist_ok=True)
    html = (ROOT / "index.html").read_text()
    if TESTER_MARK in html:
        die(f"../index.html itself contains `{TESTER_MARK}`. Remove it: tester mode is only switched on by --tester.")
    try:
        rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except Exception:
        rev = ""
    stamp = (rev or "local") + (" tester" if tester else "")
    html = html.replace("<script>", f'<script>window.EF_BUILD="{stamp}";</script>\n<script>', 1)
    print(f"build stamp: {stamp} (shown at the bottom of Settings)")
    if tester:
        import time
        until = int((time.time() + 3 * 86400) * 1000)
        html = html.replace("<script>", f"<script>{TESTER_MARK};window.EF_TESTER_UNTIL={until};</script>\n<script>", 1)
        print("\n" + "!" * 70 + "\nTESTER BUILD: the whole game is unlocked for 3 days.\nDO NOT upload this build. Run plain `python3 build_app.py` before archiving for the App Store.\n" + "!" * 70 + "\n")
    (WWW / "index.html").write_text(html)
    if (WWW / "fonts").exists():
        shutil.rmtree(WWW / "fonts")
    shutil.copytree(ROOT / "fonts", WWW / "fonts")
    print(f"copied index.html and fonts/ -> {WWW.relative_to(ROOT)}/")
    return stamp


def copy_public():
    pub = IOS / "App" / "App" / "public"
    if (IOS / "App" / "App").is_dir():
        pub.mkdir(exist_ok=True)
        shutil.copy2(WWW / "index.html", pub / "index.html")
        if (pub / "fonts").exists():
            shutil.rmtree(pub / "fonts")
        shutil.copytree(WWW / "fonts", pub / "fonts")
        print("copied the game into ios/App/App/public/")


def platforms():
    return [p for p, d in (("ios", IOS), ("android", ANDROID)) if d.is_dir()]


def add_platforms():
    if not have_capacitor():
        die("Capacitor is not installed yet: run `npm install` in app/ first.")
    if not IOS.is_dir():
        # With CocoaPods installed, use Capacitor's standard CocoaPods project (some Capacitor 7 versions still run
        # `pod install` on SPM projects and fail with "no Podfile"). Without CocoaPods, fall back to Swift Package Manager.
        if shutil.which("pod"):
            code = run(["npx", "cap", "add", "ios"], check=False)
        else:
            code = run(["npx", "cap", "add", "ios", "--packagemanager", "SPM"], check=False)
        if code != 0:
            if (IOS / "App" / "App.xcodeproj").is_dir():
                # Usually `pod install` refusing the iOS 14 template before our iOS 15 patch; the patch + sync below fix it.
                print("`npx cap add ios` reported an error after creating ios/. Applying the native settings and syncing again.")
            else:
                die("`npx cap add ios` failed and no iOS project was created.")
    if not ANDROID.is_dir():
        run(["npx", "cap", "add", "android"])


# ---------- native settings (safe to run every build) ----------

PODFILE_FIX = """
  installer.pods_project.targets.each do |t|
    t.build_configurations.each do |c|
      c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      c.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
      c.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      c.build_settings['OTHER_CFLAGS'] = '$(inherited) -Wno-quoted-include-in-framework-header -Wno-error'
    end
  end"""


def _raise_target(m):
    return m.group(0) if ver_tuple(m.group(2)) >= ver_tuple(MIN_IOS) else m.group(1) + MIN_IOS + m.group(3)


def patch_podfile():
    """Newer Xcode versions turn Capacitor's 'double-quoted include in framework header' warnings into errors and
    reject iOS 14 targets. Raise the minimum to iOS 15 and silence that one check for the Pods."""
    pod = IOS / "App" / "Podfile"
    if pod.exists():
        s = pod.read_text()
        new = re.sub(r"(platform :ios, ')([\d.]+)(')", _raise_target, s)
        if "quoted-include" not in new and "assertDeploymentTarget(installer)" in new:
            new = new.replace("assertDeploymentTarget(installer)", "assertDeploymentTarget(installer)" + PODFILE_FIX, 1)
        if new != s:
            pod.write_text(new)
            print("patched ios/App/Podfile (iOS 15 minimum, quoted-include check off)")
    proj = IOS / "App" / "App.xcodeproj" / "project.pbxproj"
    if proj.exists():
        p = proj.read_text()
        q = re.sub(r"(IPHONEOS_DEPLOYMENT_TARGET = )([\d.]+)(;)", _raise_target, p)
        # Xcode's user-script sandbox blocks CocoaPods' "[CP] Embed Pods Frameworks" step (PhaseScriptExecution failed)
        q = q.replace("ENABLE_USER_SCRIPT_SANDBOXING = YES;", "ENABLE_USER_SCRIPT_SANDBOXING = NO;")
        # Version 1 is iPhone only (iPads run it in iPhone compatibility mode): no iPad multitasking/orientation rules
        q = re.sub(r"TARGETED_DEVICE_FAMILY = [^;]+;", "TARGETED_DEVICE_FAMILY = 1;", q)
        if "ENABLE_USER_SCRIPT_SANDBOXING" not in q:
            q = q.replace(f"IPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};", f"IPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};\n\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;")
        if q != p:
            proj.write_text(q)
            print(f"Xcode project: iOS Deployment Target {MIN_IOS}, iPhone only, script sandboxing off")


STOREKIT_REF = '<StoreKitConfigurationFileReference\n         identifier = "../../Emberfall.storekit">\n      </StoreKitConfigurationFileReference>'


def patch_storekit():
    """Local StoreKit testing: lets the $1.99 unlock work on a phone run from Xcode before the
    in-app purchase exists in App Store Connect. Only affects runs started from Xcode (no real charge)."""
    src = APP / "store" / "Emberfall.storekit"
    if not src.exists() or not (IOS / "App").is_dir():
        return
    dst = IOS / "App" / "Emberfall.storekit"
    if not dst.exists() or dst.read_bytes() != src.read_bytes():
        shutil.copy2(src, dst)
        print("copied store/Emberfall.storekit -> ios/App/")
    scheme = IOS / "App" / "App.xcodeproj" / "xcshareddata" / "xcschemes" / "App.xcscheme"
    if not scheme.exists():
        print("NOTE: to test the unlock from Xcode, choose Product > Scheme > Edit Scheme > Run > Options > StoreKit Configuration: Emberfall.storekit")
        return
    x = scheme.read_text()
    if "StoreKitConfigurationFileReference" in x:
        return
    m = re.search(r"(<LaunchAction\b[^>]*>)", x)
    if not m:
        return
    x = x[:m.end()] + "\n      " + STOREKIT_REF + x[m.end():]
    scheme.write_text(x)
    print("Xcode scheme: StoreKit testing on (Emberfall.storekit)")


SCENE_MANIFEST = {
    "UIApplicationSupportsMultipleScenes": False,
    "UISceneConfigurations": {
        "UIWindowSceneSessionRoleApplication": [{
            "UISceneConfigurationName": "Default Configuration",
            "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).SceneDelegate",
            "UISceneStoryboardFile": "Main",
        }]
    },
}
SCENE_MARK = "// build_app.py: UIScene life cycle"
SCENE_DELEGATE = SCENE_MARK + """ (apps built with the iOS 27 SDK fail to launch without it, see Apple TN3187).
// Main.storyboard (UISceneStoryboardFile in Info.plist) creates the window and its CAPBridgeViewController,
// exactly as UIMainStoryboardFile did before. The fallback below only runs if the storyboard gave no window.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard window == nil, let windowScene = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: windowScene)
        w.rootViewController = CAPBridgeViewController()
        window = w
        w.makeKeyAndVisible()
    }
}
"""


def patch_scene(data):
    """Adopt the UIScene life cycle. Capacitor 7's template still uses the old app-delegate life cycle, and Apple:
    'Beginning in iOS 27 ... apps built with the latest SDK must adopt the scene-based life cycle or they fail to
    launch.' Same approach as Capacitor 8.5's template (scene manifest + SceneDelegate), minus the deep-link proxy
    that Capacitor 7 doesn't have and this game doesn't use. Returns True if AppDelegate.swift is ready."""
    data["UIApplicationSceneManifest"] = SCENE_MANIFEST
    app_dir = IOS / "App" / "App"
    if (app_dir / "SceneDelegate.swift").exists():
        return True   # a newer template already ships its own SceneDelegate
    delegate = app_dir / "AppDelegate.swift"
    if not delegate.exists():
        return False
    s = delegate.read_text()
    t = s.replace("@UIApplicationMain", "@main")   # @UIApplicationMain is deprecated; @main is the same entry point
    if SCENE_MARK not in t and "class SceneDelegate" not in t:
        t = t.rstrip() + "\n\n" + SCENE_DELEGATE
    if t != s:
        delegate.write_text(t)
        print("ios/App/App/AppDelegate.swift: added SceneDelegate (UIScene life cycle)")
    return True


def patch_native_assets():
    """Copy the app icon and launch image into the iOS project on every build.
    A freshly created ios/ folder (npx cap add ios) holds Capacitor's blank placeholder icon, and the old way of
    replacing it needed an image library (Pillow) that a Mac may not have: that is how a placeholder icon ships.
    Xcode 14+ builds every size from one 1024x1024 image, so no resizing is needed."""
    xc = IOS / "App" / "App" / "Assets.xcassets"
    res = APP / "resources"
    if not xc.is_dir() or not (res / "icon.png").exists():
        return
    icon_dir = xc / "AppIcon.appiconset"
    icon_dir.mkdir(exist_ok=True)
    target = icon_dir / "AppIcon-512@2x.png"
    src = (res / "icon.png").read_bytes()
    changed = not target.exists() or target.read_bytes() != src
    for old in icon_dir.glob("*.png"):
        if old != target:
            old.unlink()
            changed = True
    contents = json.dumps({"images": [{"filename": "AppIcon-512@2x.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
                           "info": {"author": "xcode", "version": 1}}, indent=2) + "\n"
    cj = icon_dir / "Contents.json"
    if changed or not cj.exists() or cj.read_text() != contents:
        target.write_bytes(src)
        cj.write_text(contents)
        print("set the app icon in ios/App/App/Assets.xcassets/AppIcon.appiconset")
    splash_dir = xc / "Splash.imageset"
    if splash_dir.is_dir() and (res / "splash.png").exists():
        sp = (res / "splash.png").read_bytes()
        n = 0
        for f in splash_dir.glob("*.png"):
            if f.read_bytes() != sp:
                f.write_bytes(sp)
                n += 1
        if n:
            print(f"set the launch image in ios/App/App/Assets.xcassets/Splash.imageset ({n} files)")


def patch_ios(scene=True):
    patch_podfile()
    patch_storekit()
    patch_native_assets()
    plist = IOS / "App" / "App" / "Info.plist"
    if not plist.exists():
        return
    data = plistlib.loads(plist.read_bytes())
    before = json.dumps(data, sort_keys=True, default=str)
    data["CFBundleDisplayName"] = APP_NAME
    # Landscape only. The app is iPhone only (TARGETED_DEVICE_FAMILY = 1), so iPads run it in iPhone compatibility
    # mode; the ~ipad list is set to the same landscape pair so every lookup agrees with what Capacitor's view
    # controller reports (it reads UISupportedInterfaceOrientations). Portrait on iPad would never be honoured anyway.
    data["UISupportedInterfaceOrientations"] = list(LANDSCAPE)
    data["UISupportedInterfaceOrientations~ipad"] = list(LANDSCAPE)
    data.pop("UIRequiresFullScreen", None)   # deprecated in iPadOS 26 and meaningless for an iPhone-only app
    # No custom encryption: skips the export-compliance question on every upload.
    data["ITSAppUsesNonExemptEncryption"] = False
    if scene:
        patch_scene(data)
    if json.dumps(data, sort_keys=True, default=str) != before:
        plist.write_bytes(plistlib.dumps(data, sort_keys=False))
        print("patched ios/App/App/Info.plist")


def patch_android():
    strings = ANDROID / "app" / "src" / "main" / "res" / "values" / "strings.xml"
    if strings.exists():
        s = strings.read_text()
        t = s
        for key in ("app_name", "title_activity_main"):
            t = re.sub(rf'(<string name="{key}">)[^<]*(</string>)', rf"\g<1>{APP_NAME}\g<2>", t)
        if t != s:
            strings.write_text(t)
            print("patched android strings.xml")
    manifest = ANDROID / "app" / "src" / "main" / "AndroidManifest.xml"
    if manifest.exists():
        perms = re.findall(r'uses-permission[^>]*android:name="([^"]+)"', manifest.read_text())
        extra = [p for p in perms if p != "android.permission.INTERNET"]
        if extra:
            print("WARNING: Android permissions beyond INTERNET (check they are needed):", ", ".join(extra))


# ---------- checks: is this iOS project safe to archive? ----------

class Checklist:
    def __init__(self):
        self.items = []

    def ok(self, msg):
        self.items.append(("OK", msg))

    def warn(self, msg):
        self.items.append(("WARN", msg))

    def fail(self, msg):
        self.items.append(("FAIL", msg))

    def check(self, cond, good, bad, level="fail"):
        if cond:
            self.ok(good)
        else:
            getattr(self, level)(bad)
        return cond

    @property
    def failed(self):
        return [m for s, m in self.items if s == "FAIL"]


def read_json(path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def npm_version(name):
    pkg = read_json(APP / "node_modules" / name / "package.json")
    return pkg.get("version") if pkg else None


def xcode_version():
    if platform.system() != "Darwin" or not shutil.which("xcodebuild"):
        return None, None
    try:
        out = subprocess.run(["xcodebuild", "-version"], capture_output=True, text=True, timeout=60).stdout
        sdk = subprocess.run(["xcrun", "--sdk", "iphoneos", "--show-sdk-version"], capture_output=True, text=True, timeout=60).stdout.strip()
    except Exception:
        return None, None
    m = re.search(r"Xcode\s+([\d.]+)", out)
    return (m.group(1) if m else None), (sdk or None)


def verify_web(ck, tester):
    html = (WWW / "index.html").read_text()
    if tester:
        ck.check(TESTER_MARK in html, "www/ is a TESTER build, as asked (never upload it)", "www/ should be a tester build but has no tester flag")
    else:
        ck.check(TESTER_MARK not in html, "www/ is a store build (no tester unlock)", "www/index.html is a TESTER build: the whole game would be free")
    ck.check(html.count('window.EF_BUILD="') == 1, "build stamp present once", "build stamp missing or duplicated in www/index.html")


def verify_ios(ck, tester, strict, scene):
    """Everything here was a way to ship an app that dies at launch or is missing its store."""
    app_dir = IOS / "App" / "App"
    icon = app_dir / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
    src_icon = APP / "resources" / "icon.png"
    if src_icon.exists():
        ck.check(icon.exists() and icon.read_bytes() == src_icon.read_bytes(), "app icon is the Emberfall crown",
                 "the app icon in the iOS project is NOT the Emberfall icon (Capacitor placeholder would ship)", "fail")
    # 1. web assets: Capacitor calls exit(1) at launch if public/index.html is missing (CAPBridgeViewController.loadWebView)
    pub = app_dir / "public" / "index.html"
    www = (WWW / "index.html").read_bytes()
    level = "fail" if strict else "warn"
    if ck.check(pub.exists(), "ios/App/App/public/index.html exists",
                "ios/App/App/public/index.html is MISSING: the app would quit at launch", level):
        same = pub.read_bytes() == www
        ck.check(same, "ios/App/App/public/index.html matches the fresh www/index.html",
                 "ios/App/App/public/index.html is stale (differs from www/index.html)" + ("" if strict else ": expected with --no-sync, run without it before archiving"), level)
        pub_html = pub.read_text(errors="replace")
        if not tester:
            ck.check(TESTER_MARK not in pub_html, "the iOS copy is not a tester build", "ios/App/App/public/index.html is a TESTER build", level)
    missing_fonts = [f.name for f in (WWW / "fonts").iterdir()
                     if not (app_dir / "public" / "fonts" / f.name).exists()
                     or (app_dir / "public" / "fonts" / f.name).read_bytes() != f.read_bytes()]
    ck.check(not missing_fonts, "fonts/ copied into the iOS project",
             "fonts missing or stale in ios/App/App/public/fonts: " + ", ".join(missing_fonts), level)

    # 2. native config written by `cap sync`: plugins are only registered if listed in packageClassList
    native = read_json(app_dir / "capacitor.config.json")
    if ck.check(native is not None, "ios/App/App/capacitor.config.json present",
                "ios/App/App/capacitor.config.json missing or invalid: run `npx cap sync`"):
        classes = native.get("packageClassList") or []
        missing = [c for c in REQUIRED_PLUGINS if c not in classes]
        ck.check(not missing, "native plugins registered: " + ", ".join(classes),
                 "native plugin list is missing " + ", ".join(f"{c} ({REQUIRED_PLUGINS[c]})" for c in missing)
                 + ": run `npm install` then this script again")
        extra_missing = [c for c in EXPECTED_PLUGINS if c not in classes]
        if extra_missing:
            ck.warn("plugin(s) not registered: " + ", ".join(extra_missing))
        ck.check(native.get("appId") == APP_ID, f"native config appId {APP_ID}", f"native config appId is {native.get('appId')!r}, expected {APP_ID}")

    # 3. Info.plist
    info = plistlib.loads((app_dir / "Info.plist").read_bytes())
    ck.check(info.get("UISupportedInterfaceOrientations") == LANDSCAPE and info.get("UISupportedInterfaceOrientations~ipad") == LANDSCAPE,
             "orientations: landscape left/right (iPhone and iPad compatibility mode)", "Info.plist orientations are not the landscape pair")
    ck.check(info.get("ITSAppUsesNonExemptEncryption") is False, "ITSAppUsesNonExemptEncryption = NO", "ITSAppUsesNonExemptEncryption not set")
    ck.check(bool(info.get("UILaunchStoryboardName")), "launch screen storyboard set", "UILaunchStoryboardName missing (required by the iOS 27 SDK)")
    has_scene = "UIApplicationSceneManifest" in info
    delegate = app_dir / "AppDelegate.swift"
    delegate_ok = (app_dir / "SceneDelegate.swift").exists() or (delegate.exists() and "class SceneDelegate" in delegate.read_text())
    if scene:
        ck.check(has_scene and delegate_ok, "UIScene life cycle adopted (scene manifest + SceneDelegate)",
                 "UIScene life cycle incomplete: Info.plist manifest " + ("present" if has_scene else "MISSING") + ", SceneDelegate " + ("present" if delegate_ok else "MISSING"))
    elif has_scene and not delegate_ok:
        ck.fail("Info.plist names a SceneDelegate that does not exist: the app would not launch")

    # 4. Xcode project
    pbx_path = IOS / "App" / "App.xcodeproj" / "project.pbxproj"
    pbx = pbx_path.read_text()
    fams = set(re.findall(r"TARGETED_DEVICE_FAMILY = ([^;]+);", pbx))
    ck.check(fams == {"1"}, "iPhone only (TARGETED_DEVICE_FAMILY = 1)", f"TARGETED_DEVICE_FAMILY is {sorted(fams)}; expected 1 (iPhone only)")
    targets = set(re.findall(r"IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);", pbx))
    ck.check(targets and all(ver_tuple(t) >= ver_tuple(MIN_IOS) for t in targets), f"iOS Deployment Target {', '.join(sorted(targets))}",
             f"iOS Deployment Target {sorted(targets)} is below {MIN_IOS}")
    ids = set(re.findall(r"PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);", pbx))
    ck.check(ids == {APP_ID}, f"bundle id {APP_ID}", f"bundle id is {sorted(ids)}, expected {APP_ID}")
    mv = sorted(set(re.findall(r"MARKETING_VERSION = ([^;]+);", pbx)))
    bn = sorted(set(re.findall(r"CURRENT_PROJECT_VERSION = ([^;]+);", pbx)))
    ck.ok(f"version {'/'.join(mv)} build {'/'.join(bn)} (each upload needs a new build: --set-version X.Y.Z)")

    # 5. native dependencies: versions that cannot resolve, or that need a higher iOS than the project
    cap_ios = npm_version("@capacitor/ios")
    if not cap_ios:
        ck.warn("node_modules not installed: native dependency versions not checked")
        return
    versions = {n: npm_version(n) for n in ["@capacitor/core", "@capacitor/cli"] + NPM_PLUGINS}
    ck.ok(f"@capacitor/ios {cap_ios}; " + ", ".join(f"{n.split('/')[-1]} {v}" for n, v in versions.items()))
    for n in ("@capacitor/core", "@capacitor/cli"):
        if versions[n] and ver_tuple(versions[n])[0] != ver_tuple(cap_ios)[0]:
            ck.fail(f"{n} {versions[n]} and @capacitor/ios {cap_ios} are different major versions")
    spm = (IOS / "App" / "CapApp-SPM" / "Package.swift").exists()
    podfile = IOS / "App" / "Podfile"
    pod_min = None
    if podfile.exists():
        m = re.search(r"platform :ios, '([\d.]+)'", podfile.read_text())
        pod_min = m.group(1) if m else None
        ck.check(pod_min and ver_tuple(pod_min) >= ver_tuple(MIN_IOS), f"CocoaPods platform iOS {pod_min}", f"Podfile platform is {pod_min}, expected >= {MIN_IOS}")
    if spm:
        m = re.search(r"\.iOS\(\.v(\d+)\)", (IOS / "App" / "CapApp-SPM" / "Package.swift").read_text())
        ck.check(m and int(m.group(1)) >= ver_tuple(MIN_IOS)[0], f"CapApp-SPM platform iOS {m.group(1) if m else '?'}",
                 "CapApp-SPM/Package.swift platform below iOS 15: run this script again (it syncs after raising the target)")
    for n in NPM_PLUGINS:
        d = APP / "node_modules" / n
        if not d.is_dir():
            ck.fail(f"{n} is not installed: run `npm install`")
            continue
        if spm and (d / "Package.swift").exists():
            m = re.search(r'capacitor-swift-pm\.git"\s*,\s*from:\s*"(\d+)', (d / "Package.swift").read_text())
            if m and int(m.group(1)) != ver_tuple(cap_ios)[0]:
                ck.fail(f"{n} {versions.get(n)} needs capacitor-swift-pm {m.group(1)}.x but this project uses Capacitor {cap_ios}: "
                        f"Swift Package Manager cannot resolve that. Fix: `npm install {n}@7.16.2 --save-exact` (last release built for Capacitor 7), "
                        "or delete ios/ and run --setup with CocoaPods installed")
        specs = list(d.glob("*.podspec"))
        if podfile.exists() and specs and pod_min:
            m = re.search(r"deployment_target\s*=\s*'([\d.]+)'", specs[0].read_text())
            if m and ver_tuple(m.group(1)) > ver_tuple(pod_min):
                ck.fail(f"{n} needs iOS {m.group(1)} but the Podfile platform is {pod_min}")
    np_v = versions.get("@capgo/native-purchases")
    if np_v and ver_tuple(np_v) >= (7, 18) and ver_tuple(cap_ios)[0] == 7 and podfile.exists():
        ck.warn(f"@capgo/native-purchases {np_v} is developed against Capacitor 8 (its Package.swift asks for capacitor-swift-pm 8); "
                "with CocoaPods it builds against Capacitor 7, test the purchase on a device")


def verify_xcode(ck):
    xc, sdk = xcode_version()
    if not xc:
        ck.warn("Xcode version not checked (not on a Mac): look at Xcode > About Xcode before archiving")
        return
    ck.ok(f"Xcode {xc}, iOS SDK {sdk}")
    info = IOS / "App" / "App" / "Info.plist"
    has_scene = info.exists() and "UIApplicationSceneManifest" in plistlib.loads(info.read_bytes())
    if ver_tuple(sdk or xc)[0] >= 27 and not has_scene:
        ck.fail(f"iOS SDK {sdk or xc} without the UIScene life cycle: the app fails to launch on iOS 27. Run without --no-scene")


def print_checklist(ck, tester, synced):
    print("\n" + "=" * 70 + "\nRELEASE CHECKLIST (iOS)\n" + "=" * 70)
    for status, msg in ck.items:
        print(f"[{status:4}] {msg}")
    print("-" * 70)
    if ck.failed:
        print(f"NOT READY: {len(ck.failed)} problem(s) above marked FAIL. Do NOT archive or upload this build.")
    elif tester:
        print("TESTER build ready for your own phone. Never archive/upload it: run plain `python3 build_app.py` first.")
    elif not synced:
        print("Built with --no-sync: the iOS project was not updated. Run `python3 build_app.py` before archiving.")
    else:
        print("READY to archive. Before uploading, by hand:")
        print("  1. Xcode > Product > Scheme > Edit Scheme > Run > Build Configuration: Release, run on your iPhone,")
        print("     force-quit the app and open it again from the Home Screen (not from Xcode).")
        print("  2. Run it on an iPad simulator (iPad Air, newest iPadOS): App Review tests iPhone apps on iPads too.")
        print("  3. Product > Archive, then Distribute App. Don't run --tester in between.")
    print("=" * 70)


# ---------- version numbers ----------

def set_version(version, build):
    if not re.fullmatch(r"\d+\.\d+(\.\d+)?", version):
        sys.exit("version must look like 1.2.0")
    pkg = APP / "package.json"
    pkg.write_text(re.sub(r'("version":\s*")[^"]+(")', rf"\g<1>{version}\g<2>", pkg.read_text(), count=1))
    gradle = ANDROID / "app" / "build.gradle"
    if gradle.exists():
        g = gradle.read_text()
        if build is None:
            m = re.search(r"versionCode\s+(\d+)", g)
            build = int(m.group(1)) + 1 if m else 1
        g = re.sub(r"versionCode\s+\d+", f"versionCode {build}", g)
        g = re.sub(r'versionName\s+"[^"]*"', f'versionName "{version}"', g)
        gradle.write_text(g)
        print(f"android: versionName {version}, versionCode {build}")
    pbx = IOS / "App" / "App.xcodeproj" / "project.pbxproj"
    if pbx.exists():
        p = pbx.read_text()
        if build is None:
            m = re.search(r"CURRENT_PROJECT_VERSION = (\d+);", p)
            build = int(m.group(1)) + 1 if m else 1
        p = re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {version};", p)
        p = re.sub(r"CURRENT_PROJECT_VERSION = [^;]+;", f"CURRENT_PROJECT_VERSION = {build};", p)
        pbx.write_text(p)
        print(f"ios: MARKETING_VERSION {version}, CURRENT_PROJECT_VERSION {build}")


# ---------- icons ----------

def icons():
    if not platforms():
        print("no native platforms yet: skipping icons")
        return
    if have_capacitor() and (APP / "node_modules" / "@capacitor" / "assets").is_dir():
        if run(["npm", "run", "assets"], check=False) == 0:
            # @capacitor/assets writes every size; keep the adaptive background dark.
            sys.path.insert(0, str(APP / "scripts"))
            import native_icons
            native_icons.android_background_color(APP)
            return
        print("@capacitor/assets failed: falling back to the Pillow icon writer")
    sys.path.insert(0, str(APP / "scripts"))
    try:
        import native_icons
    except ImportError:
        print("\nWARN: app icons were not regenerated because the Pillow helper is missing.")
        print("      Install it with:  python3 -m pip install --user pillow   then run this again.")
        print("      (The build carries on; the icons already in the project are kept.)\n")
        return
    native_icons.main(APP)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--setup", action="store_true", help="add missing native platforms and generate icons")
    ap.add_argument("--icons", action="store_true", help="regenerate icons and splash screens")
    ap.add_argument("--no-sync", action="store_true", help="skip `npx cap sync` (don't archive after this)")
    ap.add_argument("--tester", action="store_true", help="unlock the whole game for testing on your own phone")
    ap.add_argument("--no-scene", action="store_true", help="don't add the UIScene life cycle (required with Xcode 27+)")
    ap.add_argument("--set-version", metavar="X.Y.Z")
    ap.add_argument("--build", type=int, help="build number (default: current + 1)")
    a = ap.parse_args()

    if a.set_version:
        set_version(a.set_version, a.build)
        return

    build_web(a.tester)
    if a.setup:
        add_platforms()
    patch_ios(scene=not a.no_scene)
    patch_android()
    if a.setup or a.icons:
        icons()

    synced = False
    if a.no_sync:
        pass
    elif not platforms():
        print("No ios/ or android/ folder yet. Run `npm install` then `python3 build_app.py --setup`.")
    elif not have_capacitor():
        print("`npx cap sync` needs `npm install` in app/ first. Copying the game files into the iOS project directly instead.")
        copy_public()
    else:
        if run(["npx", "cap", "sync"], check=False) != 0:
            die("`npx cap sync` failed (see the error above). The iOS project may hold an old or missing copy of the game "
                "and an old plugin list. Common fixes: run `npm install` in app/, then `cd ios/App && pod install` "
                "(CocoaPods) or File > Packages > Reset Package Caches in Xcode (SPM), then run this script again.")
        synced = True
        if "ios" in platforms() and platform.system() != "Darwin":
            print("Note: iOS native dependencies resolve when the project is opened in Xcode on a Mac.")

    ck = Checklist()
    verify_web(ck, a.tester)
    if "ios" in platforms():
        if not synced and not a.no_sync:
            ck.fail("`npx cap sync` did not run (Capacitor not installed): the plugin list in the iOS project was not refreshed")
        verify_ios(ck, a.tester, not a.no_sync, scene=not a.no_scene)
        verify_xcode(ck)
    else:
        ck.warn("no ios/ project yet: run `python3 build_app.py --setup`")
    print_checklist(ck, a.tester, synced)
    if ck.failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
