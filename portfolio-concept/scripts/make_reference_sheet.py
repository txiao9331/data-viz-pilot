from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
names = [
    "reference-01-personal.png",
    "reference-02-public-pool.png",
    "reference-03-overhead.png",
]
frames = []
for name in names:
    image = Image.open(root / "media" / name).convert("RGB")
    image = image.crop((0, 0, image.width, image.height - 52))
    image = image.resize((640, 360), Image.Resampling.LANCZOS)
    frames.append(image)
sheet = Image.new("RGB", (1920, 360), "#0D100F")
for index, image in enumerate(frames):
    sheet.paste(image, (index * 640, 0))
sheet.save(root / "screenshots" / "visual-references.jpg", quality=92)
