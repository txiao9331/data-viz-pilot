from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
paths = [root / "screenshots" / f"page-{i}.png" for i in range(1, 13)]
thumb_w, thumb_h = 480, 270
label_h = 26
cols, rows = 3, 4
sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + label_h)), "#252927")
draw = ImageDraw.Draw(sheet)
for idx, path in enumerate(paths):
    image = Image.open(path).convert("RGB")
    image.thumbnail((thumb_w, thumb_h))
    x = (idx % cols) * thumb_w
    y = (idx // cols) * (thumb_h + label_h)
    sheet.paste(image, (x, y))
    draw.text((x + 10, y + thumb_h + 5), f"PAGE {idx + 1:02d}", fill="#F0EEE7")
sheet.save(root / "screenshots" / "contact-sheet.jpg", quality=90)
