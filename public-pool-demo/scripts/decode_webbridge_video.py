import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESPONSE = ROOT / "portfolio-concept" / "media" / "day-one-replay-response.json"
OUTPUT = ROOT / "portfolio-concept" / "media" / "day-one-replay.webm"

payload = json.loads(RESPONSE.read_text(encoding="utf-8"))
if not payload.get("ok"):
    raise RuntimeError(f"浏览器视频传输失败：{payload}")
encoded = payload["data"]["value"]
if not encoded:
    raise RuntimeError("浏览器未返回视频数据")
OUTPUT.write_bytes(base64.b64decode(encoded))
RESPONSE.unlink()
print(f"视频：{OUTPUT}")
print(f"大小：{OUTPUT.stat().st_size} bytes")
