from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
GENERATED = Path(r"C:\Users\v.roitman_swaygaming\.codex\generated_images\019fefe6-f63f-7f92-b69d-a0b25617ed7d")

SOURCES = {
    "panel.png": GENERATED / "exec-792ede53-b397-4e6a-84d6-3ceb252ef758.png",
    "star-gold.png": GENERATED / "exec-21022d32-aeac-489f-82f9-e4c095bae74f.png",
    "reward-coin.png": GENERATED / "exec-09f1763a-1e8e-4cf9-a6e7-4c87c9ca071c.png",
    "reward-hint.png": GENERATED / "exec-c15d8051-c18a-4c27-9671-24916a1762e4.png",
    "reward-card.png": GENERATED / "exec-d7245d36-f9a4-4924-b888-198b3e5168df.png",
    "chest-closed.png": GENERATED / "exec-ca76a454-c05a-4f3a-8ba6-405e78c7fe2f.png",
    "chest-open.png": GENERATED / "exec-1279c6b2-319b-4929-a191-53c0d8e7f806.png",
    "primary-cta-idle.png": GENERATED / "exec-f31fe160-48bc-4e35-bd3a-24fa209b9f4a.png",
    "primary-cta-pressed.png": GENERATED / "exec-c656cacf-3a54-42b1-a068-800bb6aa212a.png",
}

TARGETS = {
    "panel.png": (923, 1521, 904, 1497, "center"),
    "star-gold.png": (448, 477, 410, 437, "center"),
    "reward-coin.png": (452, 485, 410, 410, "center"),
    "reward-hint.png": (1254, 1254, 1110, 1110, "center"),
    "reward-card.png": (455, 567, 405, 505, "center"),
    "chest-closed.png": (582, 642, 540, 555, "bottom"),
    "chest-open.png": (582, 642, 560, 610, "bottom"),
    "primary-cta-idle.png": (1200, 360, 1140, 306, "center"),
    "primary-cta-pressed.png": (1200, 360, 1140, 288, "lower"),
}


def chroma_mask(image: Image.Image, threshold: int = 12) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    mask = Image.fromarray(np.where(chroma >= threshold, 255, 0).astype(np.uint8), "L")
    return mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))


def fill_enclosed(mask: Image.Image) -> Image.Image:
    flooded = mask.copy()
    for point in ((0, 0), (mask.width - 1, 0), (0, mask.height - 1),
                  (mask.width - 1, mask.height - 1)):
        ImageDraw.floodfill(flooded, point, 128, thresh=0)
    arr = np.asarray(flooded)
    return Image.fromarray(np.where(arr == 128, 0, 255).astype(np.uint8), "L")


def extract(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGB")
    alpha = fill_enclosed(chroma_mask(image))
    result = image.convert("RGBA")
    result.putalpha(alpha.point(lambda value: 255 if value >= 128 else 0))
    return result


def fit_asset(image: Image.Image, target: tuple[int, int, int, int, str]) -> Image.Image:
    width, height, object_width, object_height, align = target
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("Generated asset has no foreground")
    crop = image.crop(bbox)
    resized = crop.resize((object_width, object_height), Image.Resampling.LANCZOS)
    resized.putalpha(resized.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = (width - object_width) // 2
    if align == "bottom":
        y = height - object_height - 10
    elif align == "lower":
        y = height - object_height - 12
    else:
        y = (height - object_height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save_assets() -> dict[str, Image.Image]:
    assets: dict[str, Image.Image] = {}
    for name, source in SOURCES.items():
        asset = fit_asset(extract(source), TARGETS[name])
        asset.save(OUT / name)
        assets[name] = asset
    return assets


def font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in (Path(r"C:\Windows\Fonts\arialbd.ttf"), Path(r"C:\Windows\Fonts\Arial.ttf")):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def center_text(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], text: str,
                face: ImageFont.ImageFont, fill: str, stroke: int = 0, stroke_fill: str = "#000000") -> None:
    left, top, right, bottom = box
    bounds = draw.textbbox((0, 0), text, font=face, stroke_width=stroke)
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    draw.text(((left + right - width) / 2, (top + bottom - height) / 2 - bounds[1]), text,
              font=face, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def resize_visible(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    crop = image.crop(bbox) if bbox else image
    result = crop.resize(size, Image.Resampling.LANCZOS)
    result.putalpha(result.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    return result


def panel_state(assets: dict[str, Image.Image], width: int, stars: int,
                rewards: bool, chest: bool = False) -> Image.Image:
    height = round(width * 1521 / 923)
    panel = assets["panel.png"].resize((width, height), Image.Resampling.LANCZOS)
    panel.putalpha(panel.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    draw = ImageDraw.Draw(panel)
    scale = width / 923

    center_text(draw, (width * .16, height * .175, width * .84, height * .245),
                "LEVEL COMPLETE!", font(max(10, round(29 * scale))), "#1356af")

    star_width = round(width * .185)
    star_height = round(star_width * 477 / 448)
    star = assets["star-gold.png"].resize((star_width, star_height), Image.Resampling.LANCZOS)
    star.putalpha(star.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    for index, x_percent in enumerate((.2606, .5011, .7421)):
        if index < stars:
            panel.alpha_composite(star, (round(width * x_percent - star_width / 2),
                                         round(height * .3174 - star_height / 2)))

    labels = (
        ("SCORE", .2876, .4250, "12,840", .2871, .487),
        ("TIME", .7124, .4250, "1:42", .7124, .487),
        ("ACCURACY", .2882, .5694, "94%", .2882, .629),
        ("LONGEST WORD", .7172, .5684, "KINGDOM", .7124, .629),
        ("HINTS", .5000, .7120, "2 USED", .5000, .771),
    )
    for label, lx, ly, value, vx, vy in labels:
        label_width = width * (.31 if label == "LONGEST WORD" else .26)
        center_text(draw, (width * lx - label_width / 2, height * ly - 11 * scale,
                           width * lx + label_width / 2, height * ly + 11 * scale),
                    label, font(max(5, round(12 * scale))), "white")
        value_width = width * (.59 if label == "HINTS" else .30)
        center_text(draw, (width * vx - value_width / 2, height * vy - 21 * scale,
                           width * vx + value_width / 2, height * vy + 21 * scale),
                    value, font(max(7, round((17 if label != "LONGEST WORD" else 14) * scale))), "#17477f")

    if rewards:
        center_text(draw, (width * .27, height * .812, width * .73, height * .85),
                    "LEVEL REWARD", font(max(6, round(13 * scale))), "white")
        reward_specs = (
            ("reward-coin.png", .255, "+120"),
            ("reward-hint.png", .497, "+1"),
            ("reward-card.png", .742, "+1"),
        )
        icon_height = round(height * .043)
        for name, x_percent, amount in reward_specs:
            icon = assets[name]
            bbox = icon.getchannel("A").getbbox()
            visible = icon.crop(bbox) if bbox else icon
            icon_width = max(12, round(icon_height * visible.width / visible.height))
            sprite = visible.resize((icon_width, icon_height), Image.Resampling.LANCZOS)
            sprite.putalpha(sprite.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
            x = round(width * x_percent - icon_width * .72)
            y = round(height * .883)
            panel.alpha_composite(sprite, (x, y))
            center_text(draw, (x + icon_width, y, x + icon_width + width * .09, y + icon_height),
                        amount, font(max(6, round(14 * scale))), "#17477f")

    if chest:
        chest_sprite = resize_visible(assets["chest-closed.png"], (round(width * .38), round(height * .18)))
        panel.alpha_composite(chest_sprite, (round(width * .31), round(height * .795)))
    return panel


def build_mock(assets: dict[str, Image.Image]) -> None:
    width, height = 390, 1750
    pixels = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        t = y / (height - 1)
        pixels[y, :, :3] = (round(53 - 29 * t), round(176 - 77 * t), round(227 - 79 * t))
        pixels[y, :, 3] = 255
    mock = Image.fromarray(pixels, "RGBA")
    draw = ImageDraw.Draw(mock, "RGBA")
    for y in range(80, height, 70):
        draw.arc((-90, y - 38, 480, y + 48), 8, 172, fill=(205, 247, 255, 55), width=2)

    topbar = Image.open(ROOT / "public/topbar/resource-bar-board-v3.webp").convert("RGBA")
    topbar = topbar.resize((360, 55), Image.Resampling.LANCZOS)
    mock.alpha_composite(topbar, (15, 8))
    center_text(draw, (119, 20, 181, 49), "1.2K", font(11), "#173c82")
    center_text(draw, (211, 20, 279, 49), "45/50", font(11), "#173c82")
    center_text(draw, (292, 20, 329, 49), "6", font(11), "#173c82")

    center_text(draw, (20, 68, 370, 93), "3-STAR WIN + REWARDS", font(13), "white")
    mock.alpha_composite(panel_state(assets, 260, 3, True), (65, 94))

    center_text(draw, (20, 532, 370, 557), "1-STAR / NO REWARD ROW", font(13), "white")
    mock.alpha_composite(panel_state(assets, 260, 1, False), (65, 558))

    center_text(draw, (20, 996, 370, 1021), "CHEST-TIER WIN", font(13), "white")
    mock.alpha_composite(panel_state(assets, 260, 3, False, chest=True), (65, 1022))

    cta_y = 1472
    card = Image.new("RGBA", (360, 250), (246, 251, 255, 255))
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle((0, 0, 359, 249), radius=28, fill="#f6fbff", outline="#b9e2ff", width=3)
    center_text(card_draw, (20, 15, 340, 50), "PRIMARY ACTION STATES", font(15), "#1356af")
    idle = resize_visible(assets["primary-cta-idle.png"], (320, 92))
    pressed = resize_visible(assets["primary-cta-pressed.png"], (320, 92))
    card.alpha_composite(idle, (20, 52))
    card.alpha_composite(pressed, (20, 145))
    center_text(card_draw, (45, 72, 315, 124), "CONTINUE", font(17), "white", 1, "#9a2020")
    center_text(card_draw, (45, 165, 315, 217), "CLAIM", font(17), "white", 1, "#8b1d1d")
    mock.alpha_composite(card, (15, cta_y))
    mock.convert("RGB").save(OUT / "mock-level-complete-cta-390px.png")


def alpha_report(assets: dict[str, Image.Image]) -> None:
    qa = OUT / "qa-magenta"
    qa.mkdir(exist_ok=True)
    report: dict[str, object] = {}
    for name, image in assets.items():
        histogram = image.getchannel("A").histogram()
        nonzero = {str(index): count for index, count in enumerate(histogram) if count}
        report[name] = {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "alpha_histogram": nonzero,
            "binary_alpha": set(map(int, nonzero)) <= {0, 255},
        }
        background = Image.new("RGBA", image.size, (255, 0, 255, 255))
        background.alpha_composite(image)
        background.convert("RGB").save(qa / name)
    (OUT / "alpha-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    assets = save_assets()
    alpha_report(assets)
    build_mock(assets)


if __name__ == "__main__":
    main()
