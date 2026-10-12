#!/usr/bin/env python3
"""Write Emberfall's app icons and splash screens into the native projects (Pillow only).

Used by build_app.py when `@capacitor/assets` is not available. Reads app/resources/:
  icon.png             1024x1024, no transparency (iOS App Store icon, Android legacy icons)
  icon-foreground.png  1024x1024, transparent, crest inside the adaptive-icon safe zone
  splash.png           2732x2732, light background   splash-dark.png  dark background

  python3 scripts/native_icons.py        (from app/)
"""
import json, pathlib, sys
from PIL import Image, ImageDraw

ORANGE = "#120B16"  # adaptive icon background (dark castle night)
ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def _mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def cover(img, w, h):
    """Scale to cover w x h, then centre-crop (like CENTER_CROP / aspect-fill)."""
    s = max(w / img.width, h / img.height)
    r = img.resize((max(w, round(img.width * s)), max(h, round(img.height * s))), Image.LANCZOS)
    x, y = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((x, y, x + w, y + h))


def ios(app, res):
    xc = app / "ios" / "App" / "App" / "Assets.xcassets"
    if not xc.is_dir():
        return
    icon_dir = xc / "AppIcon.appiconset"
    icon_dir.mkdir(exist_ok=True)
    for old in icon_dir.glob("*.png"):
        old.unlink()
    Image.open(res / "icon.png").convert("RGB").save(icon_dir / "AppIcon-512@2x.png")
    (icon_dir / "Contents.json").write_text(json.dumps({
        "images": [{"filename": "AppIcon-512@2x.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
        "info": {"author": "xcode", "version": 1}}, indent=2) + "\n")
    print("ios: AppIcon.appiconset (single 1024 icon)")
    splash_dir = xc / "Splash.imageset"
    if splash_dir.is_dir():
        light = Image.open(res / "splash.png").convert("RGB")
        for f in splash_dir.glob("*.png"):
            w, h = Image.open(f).size
            cover(light, w, h).save(f)
        print("ios: Splash.imageset")


def android_background_color(app):
    f = app / "android" / "app" / "src" / "main" / "res" / "values" / "ic_launcher_background.xml"
    if f.parent.is_dir():
        f.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                     f'    <color name="ic_launcher_background">{ORANGE}</color>\n</resources>\n')


def android(app, res):
    base = app / "android" / "app" / "src" / "main" / "res"
    if not base.is_dir():
        return
    icon = Image.open(res / "icon.png").convert("RGBA")
    fg = Image.open(res / "icon-foreground.png").convert("RGBA")
    for d, k in ANDROID_DENSITIES.items():
        out = base / f"mipmap-{d}"
        out.mkdir(exist_ok=True)
        s = round(48 * k)
        sq = icon.resize((s, s), Image.LANCZOS)
        legacy = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        legacy.paste(sq, (0, 0), _mask(s, round(s * 0.18)))
        legacy.save(out / "ic_launcher.png")
        rnd = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        circle = Image.new("L", (s, s), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, s - 1, s - 1), fill=255)
        rnd.paste(sq, (0, 0), circle)
        rnd.save(out / "ic_launcher_round.png")
        f = round(108 * k)
        fg.resize((f, f), Image.LANCZOS).save(out / "ic_launcher_foreground.png")
    anydpi = base / "mipmap-anydpi-v26"
    anydpi.mkdir(exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '</adaptive-icon>\n')
    (anydpi / "ic_launcher.xml").write_text(xml)
    (anydpi / "ic_launcher_round.xml").write_text(xml)
    android_background_color(app)
    print("android: mipmap icons (legacy, round, adaptive)")
    light = Image.open(res / "splash.png").convert("RGB")
    dark = Image.open(res / "splash-dark.png").convert("RGB")
    n = 0
    for f in base.glob("drawable*/splash.png"):
        w, h = Image.open(f).size
        cover(dark if "night" in f.parent.name else light, w, h).save(f)
        n += 1
    if n:
        print(f"android: {n} splash.png drawables")


def main(app=None):
    app = pathlib.Path(app or pathlib.Path(__file__).resolve().parent.parent)
    res = app / "resources"
    ios(app, res)
    android(app, res)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
