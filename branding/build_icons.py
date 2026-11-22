#!/usr/bin/env python3
"""Builds every app icon from the artwork defined here.

Run:  python3 branding/build_icons.py   (needs Python Playwright with Chromium, and Pillow)
Web icons go to icons/ (all of them are cached for offline use, so keep that folder small).
Android and store artwork goes to branding/, which is not served with the app.
"""
import io, pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB, BRAND = ROOT / 'icons', ROOT / 'branding'
ANDROID = BRAND / 'android' / 'res'
BG = '#0B0E16'

DEFS = '''<defs>
  <radialGradient id="sky" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2A3552"/><stop offset=".58" stop-color="#141A2A"/><stop offset="1" stop-color="#090B10"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F2B84B" stop-opacity=".30"/><stop offset="1" stop-color="#F2B84B" stop-opacity="0"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE3A3"/><stop offset=".48" stop-color="#F2B84B"/><stop offset="1" stop-color="#B97A22"/></linearGradient>
  <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3D2"/><stop offset="1" stop-color="#E9C77C"/></linearGradient>
  <mask id="crescent"><rect width="1024" height="1024" fill="#000"/><circle cx="724" cy="282" r="84" fill="#fff"/><circle cx="692" cy="258" r="74" fill="#000"/></mask>
</defs>'''
TOWER = 'M504 112h16v44l66 198h44v30h-20v340l64 76v102H352V800l64-76V384h-20v-30h44l66-198z'
PINS = 'M396 354l20-64 20 64zM588 354l20-64 20 64z'
DOOR = 'M470 902v-84a42 42 0 0 1 84 0v84z'
HANDS = '<path d="M512 498V438M512 498l42 28" fill="none" stroke="{c}" stroke-width="15" stroke-linecap="round"/>'

def glyph(detail=True):
    moon = '<rect width="1024" height="1024" fill="url(#moon)" mask="url(#crescent)"/>' if detail else ''
    bands = '<path d="M416 650h192v16H416zM416 384h192v12H416z" fill="#0E1220" opacity=".55"/>' if detail else ''
    return f'''{moon}<path d="{TOWER}" fill="url(#gold)"/><path d="{PINS}" fill="url(#gold)"/>{bands}
      <path d="{DOOR}" fill="#0E1220"/><circle cx="512" cy="498" r="86" fill="#0E1220"/><circle cx="512" cy="498" r="86" fill="none" stroke="#FFE3A3" stroke-width="9"/>
      {HANDS.format(c='#FFD27A')}<circle cx="512" cy="498" r="17" fill="#F0625D"/>'''

def placed(inner, scale, dy=6):
    return f'<g transform="translate(512 {512 + dy}) scale({scale}) translate(-512 -507)">{inner}</g>'
def sky(): return '<rect width="1024" height="1024" fill="url(#sky)"/><circle cx="512" cy="498" r="340" fill="url(#glow)"/>'
def svg(body, w=1024, h=1024): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{body}</svg>'

ROUNDED = svg(f'<clipPath id="r"><rect width="1024" height="1024" rx="228"/></clipPath><g clip-path="url(#r)">{sky()}{placed(glyph(), 1.0)}</g>')
FULL = svg(sky() + placed(glyph(), 1.0))                 # square, for iOS, which rounds the corners itself
MASKABLE = svg(sky() + placed(glyph(), .88))              # stays inside the 80% circle every launcher keeps
ROUND = svg(f'<clipPath id="r"><circle cx="512" cy="512" r="512"/></clipPath><g clip-path="url(#r)">{sky()}{placed(glyph(), .9)}</g>')
SMALL_MARK = '<path d="M512 64 768 430H724V960H300V430H256Z" fill="url(#gold)"/><circle cx="512" cy="676" r="172" fill="#0E1220"/><path d="M512 676V576M512 676l70 46" fill="none" stroke="#FFD27A" stroke-width="44" stroke-linecap="round"/>'
SMALL = svg(f'<clipPath id="r"><rect width="1024" height="1024" rx="200"/></clipPath><g clip-path="url(#r)"><rect width="1024" height="1024" fill="#141A2A"/>{SMALL_MARK}</g>')  # a bolder drawing that survives 16 px
FOREGROUND = svg(placed(glyph(), .72))                    # Android keeps the middle 66 of 108 dp
BACKGROUND = svg(sky())
MONO_ART = f'''<mask id="m"><rect width="1024" height="1024" fill="#000"/><path d="{TOWER}" fill="#fff"/><path d="{PINS}" fill="#fff"/><circle cx="724" cy="282" r="84" fill="#fff"/><circle cx="692" cy="258" r="74" fill="#000"/>
  <path d="{DOOR}" fill="#000"/><circle cx="512" cy="498" r="86" fill="#000"/><path d="M512 498V438M512 498l42 28" fill="none" stroke="#fff" stroke-width="17" stroke-linecap="round"/><circle cx="512" cy="498" r="18" fill="#fff"/></mask><rect width="1024" height="1024" fill="#fff" mask="url(#m)"/>'''
MONO_WEB = svg(placed(MONO_ART, .88))
MONO_ANDROID = svg(placed(MONO_ART, .72))
CARD = svg(f'''<rect width="1200" height="630" fill="url(#sky)"/><g transform="translate(70 75) scale(.47)"><circle cx="512" cy="498" r="340" fill="url(#glow)"/>{glyph()}</g>
  <text x="590" y="295" fill="#FFE3A3" font-family="Georgia, 'DejaVu Serif', serif" font-size="74" font-weight="700">Clocktower</text>
  <text x="590" y="378" fill="#F2B84B" font-family="Georgia, 'DejaVu Serif', serif" font-size="74" font-weight="700">Companion</text>
  <text x="592" y="440" fill="#AEB6C8" font-family="system-ui, 'DejaVu Sans', sans-serif" font-size="30">A private player's notebook</text>''', 1200, 630)
FEATURE = svg(f'''<rect width="1024" height="500" fill="url(#sky)"/><g transform="translate(40 18) scale(.45)"><circle cx="512" cy="498" r="340" fill="url(#glow)"/>{glyph()}</g>
  <text x="510" y="235" fill="#FFE3A3" font-family="Georgia, 'DejaVu Serif', serif" font-size="66" font-weight="700">Clocktower</text>
  <text x="510" y="310" fill="#F2B84B" font-family="Georgia, 'DejaVu Serif', serif" font-size="66" font-weight="700">Companion</text>''', 1024, 500)

def render(page, art, w, h=None, opaque=False):
    h = h or w
    page.set_viewport_size({'width': w, 'height': h})
    page.set_content(f'<!doctype html><style>html,body{{margin:0;background:transparent}}svg{{display:block;width:{w}px;height:{h}px}}</style>{art}')
    img = Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert('RGBA')
    return img.convert('RGB') if opaque else img
def out(img, path):
    path.parent.mkdir(parents=True, exist_ok=True); img.save(path, optimize=True)

ADAPTIVE = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
'''

with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    (WEB / 'icon.svg').write_text(ROUNDED.replace(' width="1024" height="1024">', '>', 1))
    (WEB / 'favicon.svg').write_text(SMALL.replace(' width="1024" height="1024">', '>', 1))
    for name, art, size, opaque in [('icon-192.png', ROUNDED, 192, False), ('icon-512.png', ROUNDED, 512, False), ('icon-maskable-192.png', MASKABLE, 192, True),
                                    ('icon-maskable-512.png', MASKABLE, 512, True), ('icon-monochrome-512.png', MONO_WEB, 512, False), ('apple-touch-icon.png', FULL, 180, True)]:
        out(render(page, art, size, opaque=opaque), WEB / name)
    ico = [render(page, SMALL, s) for s in (16, 32, 48)]
    ico[-1].save(WEB / 'favicon.ico', format='ICO', append_images=ico[:-1], sizes=[(16, 16), (32, 32), (48, 48)])
    for dpi, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        d = ANDROID / f'mipmap-{dpi}'; a = n * 108 // 48
        out(render(page, ROUNDED, n), d / 'ic_launcher.png'); out(render(page, ROUND, n), d / 'ic_launcher_round.png')
        out(render(page, FOREGROUND, a), d / 'ic_launcher_foreground.png'); out(render(page, BACKGROUND, a, opaque=True), d / 'ic_launcher_background.png')
        out(render(page, MONO_ANDROID, a), d / 'ic_launcher_monochrome.png')
    v26 = ANDROID / 'mipmap-anydpi-v26'; v26.mkdir(parents=True, exist_ok=True)
    (v26 / 'ic_launcher.xml').write_text(ADAPTIVE); (v26 / 'ic_launcher_round.xml').write_text(ADAPTIVE)
    out(render(page, FULL, 512, opaque=True), BRAND / 'store' / 'play-store-icon-512.png')
    out(render(page, FEATURE, 1024, 500, opaque=True), BRAND / 'store' / 'play-feature-graphic-1024x500.png')
    out(render(page, CARD, 1200, 630, opaque=True), BRAND / 'store' / 'social-card-1200x630.png')
    out(render(page, ROUNDED, 1024), BRAND / 'icon-master-1024.png')
    (BRAND / 'icon-master.svg').write_text(ROUNDED)

    b.close()
