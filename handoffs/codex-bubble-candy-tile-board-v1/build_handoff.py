from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
GENERATED = Path(r"C:\Users\v.roitman_swaygaming\.codex\generated_images\019fefe6-f63f-7f92-b69d-a0b25617ed7d")

SOURCES = {
    "board-card-frame.png": GENERATED / "exec-a15407bc-ebb4-4fdb-b4d0-35e11561094a.png",
    "grid-frame-overlay.png": GENERATED / "exec-c9d3068e-003f-4d2e-8a54-ecb6c8bdf1fc.png",
    "tile-idle.png": GENERATED / "exec-ba829389-b5bd-4e32-bd1c-37fd3108e243.png",
    "tile-selected.png": GENERATED / "exec-e25c3f68-ae62-4067-aa68-e8efeba6b761.png",
}


def chroma_mask(image: Image.Image, threshold: int = 16) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    mask = Image.fromarray(np.where(chroma >= threshold, 255, 0).astype(np.uint8), "L")
    return mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))


def fill_enclosed(mask: Image.Image) -> Image.Image:
    flooded = mask.copy()
    ImageDraw.floodfill(flooded, (0, 0), 128, thresh=0)
    arr = np.asarray(flooded)
    return Image.fromarray(np.where(arr == 128, 0, 255).astype(np.uint8), "L")


def rgba_with_binary_alpha(source: Path, fill: bool) -> Image.Image:
    image = Image.open(source).convert("RGB")
    alpha = chroma_mask(image)
    if fill:
        alpha = fill_enclosed(alpha)
    result = image.convert("RGBA")
    result.putalpha(alpha.point(lambda value: 255 if value >= 128 else 0))
    return result


def fit_sprite(image: Image.Image, size: tuple[int, int], object_size: int) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("Generated sprite has no foreground")
    crop = image.crop(bbox)
    scale = min(object_size / crop.width, object_size / crop.height)
    resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    resized.putalpha(resized.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def save_assets() -> dict[str, Image.Image]:
    assets: dict[str, Image.Image] = {}

    board = rgba_with_binary_alpha(SOURCES["board-card-frame.png"], fill=True)
    board.save(OUT / "board-card-frame.png")
    assets["board-card-frame.png"] = board

    overlay = rgba_with_binary_alpha(SOURCES["grid-frame-overlay.png"], fill=False)
    overlay = overlay.resize((1536, 1536), Image.Resampling.LANCZOS)
    alpha = overlay.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    alpha_draw = ImageDraw.Draw(alpha)
    alpha_draw.rectangle((49, 77, 1487, 1439), fill=0)
    overlay.putalpha(alpha)
    overlay.save(OUT / "grid-frame-overlay.png")
    assets["grid-frame-overlay.png"] = overlay

    idle = fit_sprite(rgba_with_binary_alpha(SOURCES["tile-idle.png"], fill=True), (512, 512), 448)
    idle.save(OUT / "tile-idle.png")
    assets["tile-idle.png"] = idle

    selected = fit_sprite(rgba_with_binary_alpha(SOURCES["tile-selected.png"], fill=True), (512, 512), 448)
    selected.save(OUT / "tile-selected.png")
    assets["tile-selected.png"] = selected
    return assets


def rounded_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int], radius: int) -> Image.Image:
    width, height = size
    array = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        t = y / max(1, height - 1)
        array[y, :, :3] = [round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)]
        array[y, :, 3] = 255
    image = Image.fromarray(array, "RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [Path(r"C:\Windows\Fonts\arialbd.ttf"), Path(r"C:\Windows\Fonts\Arial.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def center_text(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, face: ImageFont.ImageFont, fill: str) -> None:
    left, top, right, bottom = box
    bounds = draw.textbbox((0, 0), text, font=face)
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    draw.text(((left + right - width) / 2, (top + bottom - height) / 2 - bounds[1]), text, font=face, fill=fill)


def build_mock(assets: dict[str, Image.Image]) -> Image.Image:
    width, height = 390, 844
    mock = Image.new("RGBA", (width, height), (29, 137, 193, 255))
    pixels = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        t = y / (height - 1)
        pixels[y, :, :3] = (round(45 - 30 * t), round(173 - 95 * t), round(220 - 90 * t))
        pixels[y, :, 3] = 255
    mock = Image.fromarray(pixels, "RGBA")
    draw = ImageDraw.Draw(mock, "RGBA")
    for y in range(120, height, 58):
        draw.arc((-80, y - 35, 470, y + 45), 8, 172, fill=(190, 245, 255, 45), width=2)

    topbar = Image.open(ROOT / "public/topbar/resource-bar-board-v3.webp").convert("RGBA").resize((360, 55), Image.Resampling.LANCZOS)
    mock.alpha_composite(topbar, (15, 3))
    center_text(draw, (119, 15, 181, 46), "1.2K", font(11), "#173c82")
    center_text(draw, (211, 15, 279, 46), "45/50", font(11), "#173c82")
    center_text(draw, (292, 15, 329, 46), "6", font(11), "#173c82")

    banner = Image.open(ROOT / "public/kingdom-banner/kingdom-identity-banner-calm.webp").convert("RGBA").resize((360, 45), Image.Resampling.LANCZOS)
    mock.alpha_composite(banner, (15, 62))
    center_text(draw, (23, 68, 232, 101), "CORAL KINGDOM", font(15), "white")
    center_text(draw, (246, 68, 281, 101), "1", font(14), "#7b4b08")
    center_text(draw, (293, 68, 367, 101), "9:51", font(12), "white")

    tray = Image.open(ROOT / "public/objective-tray/tray-frame-v3.webp").convert("RGBA").resize((360, 74), Image.Resampling.LANCZOS)
    mock.alpha_composite(tray, (15, 111))
    pill = rounded_gradient((148, 42), (255, 255, 255), (224, 240, 255), 21)
    mock.alpha_composite(pill, (32, 127))
    mock.alpha_composite(pill, (210, 127))
    center_text(draw, (32, 127, 180, 169), "SHORE", font(14), "#153c76")
    center_text(draw, (210, 127, 358, 169), "WAVE", font(14), "#153c76")

    card_source = assets["board-card-frame.png"]
    card = card_source.crop(card_source.getchannel("A").getbbox()).resize((376, 520), Image.Resampling.LANCZOS)
    mock.alpha_composite(card, (7, 188))
    center_text(draw, (35, 204, 355, 232), "Swipe across the letters to find SHORE.", font(10), "#21477d")

    overlay_size = 344
    overlay_x, overlay_y = 23, 232
    idle_source = assets["tile-idle.png"]
    selected_source = assets["tile-selected.png"]
    tile_idle = idle_source.crop(idle_source.getchannel("A").getbbox()).resize((37, 37), Image.Resampling.LANCZOS)
    tile_selected = selected_source.crop(selected_source.getchannel("A").getbbox()).resize((37, 37), Image.Resampling.LANCZOS)
    letters = [
        "QSHOREXZ",
        "ZOQXPKJY",
        "JRZQEEKX",
        "XAQZAFAN",
        "QLTARZXN",
        "JQEWAVEZ",
        "XEQLKZYQ",
    ]
    grid_x, grid_y = 39, 264
    selected_cells = {(0, column) for column in range(1, 6)}
    tile_font = font(18)
    for row, word in enumerate(letters):
        for column, letter in enumerate(word):
            x, y = grid_x + column * 39, grid_y + row * 39
            mock.alpha_composite(tile_selected if (row, column) in selected_cells else tile_idle, (x, y))
            center_text(draw, (x, y, x + 37, y + 37), letter, tile_font, "#123969")

    overlay = assets["grid-frame-overlay.png"].resize((overlay_size, overlay_size), Image.Resampling.LANCZOS)
    mock.alpha_composite(overlay, (overlay_x, overlay_y))

    hint = rounded_gradient((146, 48), (255, 255, 255), (219, 237, 255), 16)
    mock.alpha_composite(hint, (25, 635))
    center_text(draw, (25, 635, 171, 683), "Need a clue?  3 left", font(11), "#183d73")
    center_text(draw, (183, 635, 355, 683), "Drag in a straight line", font(9), "#294d78")
    mock.convert("RGB").save(OUT / "mock-board-390px.png")
    return mock


def alpha_report(files: list[Path]) -> None:
    report: dict[str, object] = {}
    qa = OUT / "qa-magenta"
    qa.mkdir(exist_ok=True)
    for path in files:
        image = Image.open(path).convert("RGBA")
        histogram = image.getchannel("A").histogram()
        nonzero = {str(index): count for index, count in enumerate(histogram) if count}
        report[path.name] = {
            "width": image.width,
            "height": image.height,
            "mode": "RGBA",
            "alpha_histogram": nonzero,
            "binary_alpha": set(nonzero).issubset({"0", "255"}),
        }
        background = Image.new("RGBA", image.size, (255, 0, 255, 255))
        background.alpha_composite(image)
        background.convert("RGB").save(qa / path.name)
    (OUT / "alpha-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    assets = save_assets()
    build_mock(assets)
    alpha_report([OUT / name for name in assets])


if __name__ == "__main__":
    main()
