#!/usr/bin/env python3
"""Build Emberfall: My Lord for the native (Capacitor) app.

  python3 build_app.py                 copy ../index.html and ../fonts/ to www/, apply native settings, `npx cap sync`
  python3 build_app.py --setup         first time: also `npx cap add ios/android` for missing platforms + app icons
  python3 build_app.py --icons         (re)generate app icons and splash screens from resources/
  python3 build_app.py --no-sync       build and copy only
  python3 build_app.py --set-version 1.2.0 [--build 7]
                                       set the store version (and build number) for iOS, Android and package.json

The game is never edited here: ../index.html stays the single source of truth.
"""
import argparse, json, pathlib, platform, plistlib, re, shutil, subprocess, sys

APP = pathlib.Path(__file__).resolve().parent
ROOT = APP.parent
WWW = APP / "www"
IOS = APP / "ios"
ANDROID = APP / "android"
APP_NAME = json.loads((APP / "capacitor.config.json").read_text())["appName"]


def run(cmd, cwd=APP, check=True):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=cwd, check=check).returncode


def have_capacitor():
    return (APP / "node_modules" / "@capacitor" / "cli").is_dir()


def build_web():
    WWW.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "index.html", WWW / "index.html")
    if (WWW / "fonts").exists():
        shutil.rmtree(WWW / "fonts")
    shutil.copytree(ROOT / "fonts", WWW / "fonts")
    print(f"copied index.html and fonts/ -> {WWW.relative_to(ROOT)}/")


def platforms():
    return [p for p, d in (("ios", IOS), ("android", ANDROID)) if d.is_dir()]


def add_platforms():
    if not have_capacitor():
        sys.exit("Capacitor is not installed yet: run `npm install` in app/ first.")
    if not IOS.is_dir():
        # With CocoaPods installed, use Capacitor's standard CocoaPods project (some Capacitor 7 versions still run
        # `pod install` on SPM projects and fail with "no Podfile"). Without CocoaPods, fall back to Swift Package Manager.
        if shutil.which("pod"):
            run(["npx", "cap", "add", "ios"])
        else:
            run(["npx", "cap", "add", "ios", "--packagemanager", "SPM"])
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


def patch_podfile():
    """Newer Xcode versions turn Capacitor's 'double-quoted include in framework header' warnings into errors and
    reject iOS 14 targets. Raise the minimum to iOS 15 and silence that one check for the Pods."""
    pod = IOS / "App" / "Podfile"
    if not pod.exists():
        return
    s = pod.read_text()
    new = s.replace("platform :ios, '14.0'", "platform :ios, '15.0'")
    if "quoted-include" not in new and "assertDeploymentTarget(installer)" in new:
        new = new.replace("assertDeploymentTarget(installer)", "assertDeploymentTarget(installer)" + PODFILE_FIX, 1)
    if new != s:
        pod.write_text(new)
        print("patched ios/App/Podfile (iOS 15 minimum, quoted-include check off)")
    proj = IOS / "App" / "App.xcodeproj" / "project.pbxproj"
    if proj.exists():
        p = proj.read_text()
        q = p.replace("IPHONEOS_DEPLOYMENT_TARGET = 14.0;", "IPHONEOS_DEPLOYMENT_TARGET = 15.0;")
        # Xcode's user-script sandbox blocks CocoaPods' "[CP] Embed Pods Frameworks" step (PhaseScriptExecution failed)
        q = q.replace("ENABLE_USER_SCRIPT_SANDBOXING = YES;", "ENABLE_USER_SCRIPT_SANDBOXING = NO;")
        # Version 1 is iPhone only (iPads can still run it in iPhone mode): fewer screenshots and checks for review
        q = q.replace('TARGETED_DEVICE_FAMILY = "1,2";', "TARGETED_DEVICE_FAMILY = 1;")
        if "ENABLE_USER_SCRIPT_SANDBOXING" not in q:
            q = q.replace("IPHONEOS_DEPLOYMENT_TARGET = 15.0;", "IPHONEOS_DEPLOYMENT_TARGET = 15.0;\n\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;")
        if q != p:
            proj.write_text(q)
            print("set the App target's iOS Deployment Target to 15.0")


def patch_ios():
    patch_podfile()
    plist = IOS / "App" / "App" / "Info.plist"
    if not plist.exists():
        return
    data = plistlib.loads(plist.read_bytes())
    before = dict(data)
    data["CFBundleDisplayName"] = APP_NAME
    # Emberfall is a landscape game on iPhone; every orientation on iPad (required for iPad multitasking).
    data["UISupportedInterfaceOrientations"] = ["UIInterfaceOrientationLandscapeRight", "UIInterfaceOrientationLandscapeLeft"]
    data["UISupportedInterfaceOrientations~ipad"] = [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
    ]
    # No custom encryption: skips the export-compliance question on every upload.
    data["ITSAppUsesNonExemptEncryption"] = False
    if data != before:
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
    import native_icons
    native_icons.main(APP)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--setup", action="store_true", help="add missing native platforms and generate icons")
    ap.add_argument("--icons", action="store_true", help="regenerate icons and splash screens")
    ap.add_argument("--no-sync", action="store_true", help="skip `npx cap sync`")
    ap.add_argument("--set-version", metavar="X.Y.Z")
    ap.add_argument("--build", type=int, help="build number (default: current + 1)")
    a = ap.parse_args()

    if a.set_version:
        set_version(a.set_version, a.build)
        return

    build_web()
    if a.setup:
        add_platforms()
    patch_ios()
    patch_android()
    if a.setup or a.icons:
        icons()
    if a.no_sync:
        return
    if not platforms():
        print("No ios/ or android/ folder yet. Run `npm install` then `python3 build_app.py --setup`.")
    elif not have_capacitor():
        print("Skipping `npx cap sync`: run `npm install` in app/ first.")
    else:
        run(["npx", "cap", "sync"])
        if "ios" in platforms() and platform.system() != "Darwin":
            print("Note: iOS native dependencies resolve when the project is opened in Xcode on a Mac.")


if __name__ == "__main__":
    main()
