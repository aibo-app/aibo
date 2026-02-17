#!/usr/bin/env python3
"""
Generate proper app icons for all platforms from pfp final.png.

macOS:  Squircle with ~100px transparent padding on 1024x1024 canvas → .icns via iconutil
Windows: Full-bleed square, no padding → .ico with 16/24/32/48/64/256 sizes
Linux:  Full-bleed PNGs in build/icons/ at standard sizes

Apple HIG spec: 1024x1024 canvas, ~824x824 content area (squircle), ~100px padding.
macOS does NOT auto-apply the squircle mask (Big Sur–Sequoia). Must bake it in.
Windows/Linux icons are full-bleed — no squircle, no padding.
"""

import math
import os
import shutil
import struct
import subprocess
import sys
from io import BytesIO
from PIL import Image, ImageDraw, ImageChops, ImageFilter


# ── Superellipse (Apple squircle) ──────────────────────────────────────────

def superellipse_points(cx, cy, rx, ry, n=5, num_points=1000):
    """Generate points for Apple's continuous-curve squircle (superellipse n≈5)."""
    points = []
    for i in range(num_points):
        t = 2 * math.pi * i / num_points
        cos_t = math.cos(t)
        sin_t = math.sin(t)
        exp = 2.0 / n
        x = cx + rx * (1 if cos_t >= 0 else -1) * (abs(cos_t) ** exp)
        y = cy + ry * (1 if sin_t >= 0 else -1) * (abs(sin_t) ** exp)
        points.append((x, y))
    return points


def make_squircle_mask(size, content_size, n=5):
    """Create a squircle mask centered on a canvas."""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = size / 2, size / 2
    r = content_size / 2
    points = superellipse_points(cx, cy, r, r, n)
    draw.polygon(points, fill=255)
    return mask


# ── macOS Icon ─────────────────────────────────────────────────────────────

def generate_macos_icon(source_img, output_dir):
    """
    Generate macOS .icns from source image.
    Apple spec: 1024x1024 canvas, ~824x824 squircle content area.
    """
    print("\n── macOS Icon ──")

    # Sizes needed for .iconset (pt@scale → px)
    iconset_sizes = [
        (16, 1), (16, 2),      # 16x16, 32x32
        (32, 1), (32, 2),      # 32x32, 64x64
        (128, 1), (128, 2),    # 128x128, 256x256
        (256, 1), (256, 2),    # 256x256, 512x512
        (512, 1), (512, 2),    # 512x512, 1024x1024
    ]

    iconset_dir = os.path.join(output_dir, 'icon.iconset')
    os.makedirs(iconset_dir, exist_ok=True)

    for pt, scale in iconset_sizes:
        px = pt * scale
        canvas_size = px
        # Content area is ~80.5% of canvas (824/1024)
        content_size = round(canvas_size * 0.805)

        # Resize source to fill content area
        img = source_img.copy()
        w, h = img.size
        if w != h:
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
        img = img.resize((content_size, content_size), Image.LANCZOS)

        # Create canvas with transparency
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))

        # Create squircle mask at content size
        content_mask = make_squircle_mask(content_size, content_size, n=5)

        # Apply mask to resized source
        r, g, b, a = img.split()
        a = ImageChops.multiply(a, content_mask.convert('L'))
        masked = Image.merge('RGBA', (r, g, b, a))

        # Paste centered on canvas
        offset = (canvas_size - content_size) // 2
        canvas.paste(masked, (offset, offset), masked)

        # Save to iconset
        if scale == 1:
            fname = f"icon_{pt}x{pt}.png"
        else:
            fname = f"icon_{pt}x{pt}@{scale}x.png"

        canvas.save(os.path.join(iconset_dir, fname), 'PNG')
        print(f"  {fname} ({px}x{px})")

    # Also save the 1024 version as the dev-mode dock icon
    dev_icon_path = os.path.join(output_dir, 'icon.png')
    # Generate 1024 version
    canvas_size = 1024
    content_size = round(1024 * 0.805)  # ~824
    img = source_img.copy()
    w, h = img.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    img = img.resize((content_size, content_size), Image.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    content_mask = make_squircle_mask(content_size, content_size, n=5)
    r, g, b, a = img.split()
    a = ImageChops.multiply(a, content_mask.convert('L'))
    masked = Image.merge('RGBA', (r, g, b, a))
    offset = (canvas_size - content_size) // 2
    canvas.paste(masked, (offset, offset), masked)
    canvas.save(dev_icon_path, 'PNG')
    print(f"  icon.png (1024x1024, dev-mode dock icon)")

    # Convert to .icns using macOS iconutil
    icns_path = os.path.join(output_dir, 'icon.icns')
    try:
        subprocess.run(
            ['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path],
            check=True, capture_output=True
        )
        print(f"  icon.icns created successfully")
        # Clean up iconset folder
        shutil.rmtree(iconset_dir)
    except FileNotFoundError:
        print("  WARNING: iconutil not found (not on macOS?). Skipping .icns generation.")
        print(f"  Iconset saved at: {iconset_dir}")
    except subprocess.CalledProcessError as e:
        print(f"  ERROR creating .icns: {e.stderr.decode()}")
        print(f"  Iconset kept at: {iconset_dir}")

    return icns_path


# ── Windows Icon ───────────────────────────────────────────────────────────

def generate_windows_ico(source_img, output_dir):
    """
    Generate Windows .ico with multiple sizes. Full-bleed, no padding.
    """
    print("\n── Windows Icon ──")

    ico_sizes = [16, 24, 32, 48, 64, 256]
    images = []

    for size in ico_sizes:
        img = source_img.copy()
        w, h = img.size
        if w != h:
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
        img = img.resize((size, size), Image.LANCZOS)
        images.append(img)
        print(f"  {size}x{size}")

    ico_path = os.path.join(output_dir, 'icon.ico')
    # Save from the largest image, Pillow will include all requested sizes
    # Using the source resized to 256 as the base avoids quality loss
    img_256 = source_img.copy()
    w, h = img_256.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img_256 = img_256.crop((left, top, left + side, top + side))
    img_256 = img_256.resize((256, 256), Image.LANCZOS)
    img_256.save(
        ico_path, format='ICO',
        sizes=[(s, s) for s in ico_sizes]
    )
    print(f"  icon.ico created ({len(ico_sizes)} sizes)")
    return ico_path


# ── Linux Icons ────────────────────────────────────────────────────────────

def generate_linux_icons(source_img, output_dir):
    """
    Generate Linux icon PNGs in build/icons/. Full-bleed, no padding.
    """
    print("\n── Linux Icons ──")

    icons_dir = os.path.join(output_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    linux_sizes = [16, 32, 48, 64, 128, 256, 512]

    for size in linux_sizes:
        img = source_img.copy()
        w, h = img.size
        if w != h:
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
        img = img.resize((size, size), Image.LANCZOS)
        img.save(os.path.join(icons_dir, f'{size}x{size}.png'), 'PNG')
        print(f"  {size}x{size}.png")

    print(f"  Saved to {icons_dir}/")


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(base, 'pfp final.png')
    build_dir = os.path.join(base, 'build')
    public_dir = os.path.join(base, 'public')

    if not os.path.exists(input_file):
        print(f"ERROR: Source image not found: {input_file}")
        sys.exit(1)

    os.makedirs(build_dir, exist_ok=True)

    print(f"Source: {input_file}")
    source = Image.open(input_file).convert('RGBA')
    print(f"Source size: {source.width}x{source.height}")

    # Generate all platform icons
    generate_macos_icon(source, build_dir)
    generate_windows_ico(source, build_dir)
    generate_linux_icons(source, build_dir)

    # Copy macOS dev icon to public/ for Electron dev mode
    src_icon = os.path.join(build_dir, 'icon.png')
    dst_icon = os.path.join(public_dir, 'icon.png')
    if os.path.exists(src_icon):
        shutil.copy2(src_icon, dst_icon)
        print(f"\nCopied dev icon → public/icon.png")

    print("\n✓ All icons generated!")
    print(f"  macOS:   build/icon.icns  (+ public/icon.png for dev)")
    print(f"  Windows: build/icon.ico")
    print(f"  Linux:   build/icons/*.png")


if __name__ == '__main__':
    main()
