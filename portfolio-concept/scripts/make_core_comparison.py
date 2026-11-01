from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "portfolio-concept" / "screenshots" / "core-form-comparison.jpg"

low = [
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537760728-conversation-4940ee1f-d94b-45c3-989f-7c5631200bd5.png"),
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537783818-conversation-a9b4440f-5de4-4e65-8795-28e58a52838f.png"),
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537805549-conversation-1a550360-a47e-429a-b475-0c37afaf36ee.png"),
]
overhead = [
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537830257-conversation-86eb4bd8-81af-4bc8-9793-1a89846564c4.png"),
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537854608-conversation-23c70e14-daa3-45fd-ac13-efb5279e5cff.png"),
    Path(r"C:\Users\54189\AppData\Local\Temp\kimi-workbench-browser\1793537879055-conversation-b8b407d5-8ffd-4201-a2a8-01a777a3d8a5.png"),
]

for path in [*low, *overhead]:
    if not path.is_file():
        raise FileNotFoundError(path)

font_candidates = [
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
]
font_path = next((path for path in font_candidates if path.is_file()), None)
def font(size):
    return ImageFont.truetype(str(font_path), size) if font_path else ImageFont.load_default(size=size)

cell_w, cell_h = 640, 341
header_h, row_label_h = 68, 38
canvas = Image.new("RGB", (cell_w * 3, header_h + (row_label_h + cell_h) * 2), "#111815")
draw = ImageDraw.Draw(canvas)
draw.text((24, 17), "核心形态对照｜固定路线、镜头与线迹，仅切换核心显示", font=font(28), fill="#e6e0d4")

columns = ["1  粒子群（180 点）", "2  无核心", "3  单点"]
rows = [("23 秒 · 低位跟随", low), ("12 秒 · 俯视停留", overhead)]
for row_index, (row_label, images) in enumerate(rows):
    y = header_h + row_index * (row_label_h + cell_h)
    draw.text((24, y + 5), row_label, font=font(21), fill="#aebbb3")
    for col_index, (label, path) in enumerate(zip(columns, images)):
        x = col_index * cell_w
        draw.text((x + cell_w - 218, y + 7), label, font=font(18), fill="#c7d8d0")
        image = Image.open(path).convert("RGB").resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        canvas.paste(image, (x, y + row_label_h))

OUT.parent.mkdir(parents=True, exist_ok=True)
canvas.save(OUT, quality=93, subsampling=0)
print(OUT)
print(canvas.size)
