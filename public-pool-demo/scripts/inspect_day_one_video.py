from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[2]
VIDEO = ROOT / "portfolio-concept" / "media" / "day-one-replay.webm"
OUTPUT = ROOT / "portfolio-concept" / "media" / "day-one-video-contact-sheet.jpg"

capture = cv2.VideoCapture(str(VIDEO))
if not capture.isOpened():
    raise RuntimeError(f"无法解码视频：{VIDEO}")

targets = iter((0.1, 15.0, 29.5))
target = next(targets, None)
frames = []
while target is not None:
    ok, frame = capture.read()
    if not ok:
        break
    seconds = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
    if seconds >= target:
        frames.append((seconds, frame))
        target = next(targets, None)

capture.release()
if len(frames) != 3:
    raise RuntimeError(f"顺序解码后仅取得 {len(frames)} / 3 个目标画面")
height, width = frames[0][1].shape[:2]
label_height = 32
sheet = cv2.copyMakeBorder(
    cv2.hconcat([frame for _, frame in frames]),
    label_height,
    0,
    0,
    0,
    cv2.BORDER_CONSTANT,
    value=(7, 19, 23),
)
for index, (seconds, _) in enumerate(frames):
    cv2.putText(
        sheet,
        f"{seconds:.1f}s - recorded frame",
        (index * width + 14, 22),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (217, 243, 238),
        1,
        cv2.LINE_AA,
    )

if not cv2.imwrite(str(OUTPUT), sheet, [cv2.IMWRITE_JPEG_QUALITY, 92]):
    raise RuntimeError(f"无法保存接触表：{OUTPUT}")

print(f"视频：{VIDEO}")
print(f"分辨率：{width} x {height}")
print(f"接触表：{OUTPUT}")
