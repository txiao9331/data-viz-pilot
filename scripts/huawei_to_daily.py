# -*- coding: utf-8 -*-
"""
Huawei Health export -> daily summary CSV for data-viz pilot.
Extracts: resting HR, sleep duration (time in bed), SpO2 daily mean, stress daily mean.
Output: date,resting_hr,sleep_min,spo2,stress,sleep_capped  (local-date via record timeZone)
Sleep attribution: night belongs to the local WAKE date (matches Huawei app display).
Sleep capping: daily time-in-bed >960min is capped and flagged (bad merges / extreme days).

Usage:
  python huawei_to_daily.py [export_dir] [out_csv]
  defaults: export_dir = ../HUAWEI_HEALTH_*/Health detail data & description (newest)
            out_csv     = ../data/huawei_daily.csv
"""
import json, os, sys, glob, csv, datetime, statistics

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PILOT_DIR = os.path.dirname(SCRIPT_DIR)

def default_export_dir():
    roots = sorted(glob.glob(os.path.join(PILOT_DIR, 'HUAWEI_HEALTH_*')))
    if not roots:
        sys.exit('no HUAWEI_HEALTH_* export folder found')
    return os.path.join(roots[-1], 'Health detail data & description')

HD = sys.argv[1] if len(sys.argv) > 1 else default_export_dir()
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(PILOT_DIR, 'data', 'huawei_daily.csv')

TARGETS = {
    'RESTING_HEART_RATE': 'rhr',
    'STRESS': 'stress',
    'STRESS_DATA': 'stress',
    'BLOOD_OXYGEN_SATURATION': 'spo2',
    'PROFESSIONAL_SLEEP_DEEP': 'sleepseg',
    'PROFESSIONAL_SLEEP_DREAM': 'sleepseg',
    'PROFESSIONAL_SLEEP_SHALLOW': 'sleepseg',
    'PROFESSIONAL_SLEEP_WAKE': 'sleepseg',
}

SLEEP_CAP_MIN = 960  # >16h time-in-bed in one wake-date -> cap + flag

def tz_offset(tz):
    # "+0800" -> +480 minutes
    try:
        sign = 1 if tz[0] == '+' else -1
        return sign * (int(tz[1:3]) * 60 + int(tz[3:5]))
    except Exception:
        return 0

def local_dt(ms, tz):
    return (datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc)
            + datetime.timedelta(minutes=tz_offset(tz)))

def local_date(ms, tz):
    return local_dt(ms, tz).date().isoformat()

# pass 1: detect candidate files by head scan
files = sorted(glob.glob(os.path.join(HD, '*.json')))
if not files:
    sys.exit(f'no json files in {HD}')
cand = {v: [] for v in set(TARGETS.values())}
for f in files:
    with open(f, 'rb') as fh:
        head = fh.read(60000).decode('utf-8', errors='ignore')
    for key, tag in TARGETS.items():
        if f'"{key}"' in head:
            cand[tag].append((key, f))
            break
print(f'export dir: {HD}')
print('candidate files:')
for tag, lst in cand.items():
    print(f'  {tag}: {len(lst)} files')

rhr = {}        # date -> (version, bpm)
stress = {}     # date -> [scores]
spo2 = {}       # date -> [values]
sleep = {}      # wake-date -> [session minutes]
sleepsegs = []  # raw (start, end, tz) for session aggregation
seg_seen = set()  # (st, en, key) exact-duplicate guard across device lines

NIGHT_KEYS = {'PROFESSIONAL_SLEEP_DEEP', 'PROFESSIONAL_SLEEP_DREAM',
              'PROFESSIONAL_SLEEP_SHALLOW', 'PROFESSIONAL_SLEEP_WAKE'}

def add_rhr(date, ver, bpm):
    if date not in rhr or ver >= rhr[date][0]:
        rhr[date] = (ver, bpm)

dup_dropped = 0
for tag, lst in cand.items():
    for key, f in lst:
        with open(f, encoding='utf-8') as fh:
            data = json.load(fh)
        for rec in data:
            tz = rec.get('timeZone', '+0000')
            ver = rec.get('version', 0)
            for sp in rec.get('samplePoints', []):
                spk = sp.get('key')
                if tag == 'sleepseg':
                    if spk not in NIGHT_KEYS:
                        continue
                elif spk != key:
                    continue
                val = sp.get('value') or ''
                try:
                    vj = json.loads(val) if val else {}
                except Exception:
                    continue
                if tag == 'rhr':
                    bpm = vj.get('oldRestBpm') or vj.get('restBpm')
                    if bpm:
                        add_rhr(local_date(rec['startTime'], tz), ver, int(bpm))
                elif tag == 'stress':
                    score = vj.get('score') or vj.get('stressScore')
                    if score is None:
                        fm = sp.get('fieldsMetadata', '{}')
                        try:
                            sd = json.loads(fm).get('stressDetail')
                            if sd:
                                score = json.loads(sd).get('stressScore')
                        except Exception:
                            pass
                    if score is not None:
                        d = local_date(rec['startTime'], tz)
                        stress.setdefault(d, []).append(int(score))
                elif tag == 'spo2':
                    v = vj.get('spo2')
                    if v:
                        d = local_date(rec['startTime'], tz)
                        spo2.setdefault(d, []).append(float(v))
                elif tag == 'sleepseg':
                    st, en = rec['startTime'], rec.get('endTime') or rec['startTime']
                    sig = (st, en, spk)
                    if sig in seg_seen:
                        dup_dropped += 1
                        continue
                    seg_seen.add(sig)
                    if en > st:
                        sleepsegs.append((st, en, tz))

if dup_dropped:
    print(f'  [sleep] dropped {dup_dropped} exact-duplicate segments (device-line overlap)')

# --- session-based nightly sleep aggregation ---
# contiguous segments (<=90min gap) = one session; only sessions touching
# 18:00-06:00 count as night sleep; attributed to local WAKE date.
sleepsegs.sort()
sessions, cur, prev_end = [], [], None
for st, en, tz in sleepsegs:
    if prev_end is not None and st - prev_end > 90 * 60 * 1000:
        sessions.append(cur)
        cur = []
    cur.append((st, en, tz))
    prev_end = max(prev_end or 0, en)
if cur:
    sessions.append(cur)

dropped = 0
for sess in sessions:
    durs, qualifies = [], False
    end_ldt = None
    for st, en, tz in sess:
        ldt = local_dt(st, tz)
        if ldt.hour >= 18 or ldt.hour < 6:
            qualifies = True
        end_ldt = local_dt(en, tz)
        durs.append((en - st) / 60000)
    if not qualifies:
        continue  # daytime nap -> excluded from nightly sleep_min
    total = sum(durs)
    if total > 900:  # >15h single session -> bad merge, drop & report
        dropped += 1
        continue
    sleep.setdefault(end_ldt.date().isoformat(), []).append(total)
if dropped:
    print(f'  [sleep] dropped {dropped} sessions >900min (bad merge)')

# merge
all_dates = sorted(set(rhr) | set(stress) | set(spo2) | set(sleep))
rows = []
capped = 0
for d in all_dates:
    smin = round(sum(sleep[d])) if d in sleep else ''
    flag = 0
    if smin != '' and smin > SLEEP_CAP_MIN:
        smin = SLEEP_CAP_MIN
        flag = 1
        capped += 1
    rows.append({
        'date': d,
        'resting_hr': rhr[d][1] if d in rhr else '',
        'sleep_min': smin,
        'spo2': round(statistics.mean(spo2[d]), 1) if d in spo2 else '',
        'stress': round(statistics.mean(stress[d])) if d in stress else '',
        'sleep_capped': flag if d in sleep else '',
    })
if capped:
    print(f'  [sleep] capped {capped} days >{SLEEP_CAP_MIN}min (flagged sleep_capped=1)')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['date', 'resting_hr', 'sleep_min', 'spo2', 'stress', 'sleep_capped'])
    w.writeheader()
    w.writerows(rows)

# 可视化窗口切片：最近 30 个日历日 -> viz/data/huawei_daily.csv
VIZ_OUT = os.path.join(PILOT_DIR, 'viz', 'data', 'huawei_daily.csv')
if rows:
    end_d = datetime.date.fromisoformat(rows[-1]['date'])
    start_d = end_d - datetime.timedelta(days=29)
    slice_rows = [r for r in rows if start_d <= datetime.date.fromisoformat(r['date']) <= end_d]
    os.makedirs(os.path.dirname(VIZ_OUT), exist_ok=True)
    with open(VIZ_OUT, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=['date', 'resting_hr', 'sleep_min', 'spo2', 'stress', 'sleep_capped'])
        w.writeheader()
        w.writerows(slice_rows)
    print(f'viz slice -> {VIZ_OUT}  ({slice_rows[0]["date"]} ~ {slice_rows[-1]["date"]}, {len(slice_rows)} days)')
    # 全量副本（demo 全数据模式用）
    VIZ_FULL = os.path.join(PILOT_DIR, 'viz', 'data', 'huawei_daily_full.csv')
    with open(VIZ_FULL, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=['date', 'resting_hr', 'sleep_min', 'spo2', 'stress', 'sleep_capped'])
        w.writeheader()
        w.writerows(rows)
    print(f'viz full  -> {VIZ_FULL}  ({rows[0]["date"]} ~ {rows[-1]["date"]}, {len(rows)} days)')

# stats
def rng(dic):
    ks = sorted(dic)
    return f'{ks[0]} ~ {ks[-1]}' if ks else '-'
print()
print(f'total dates: {len(rows)}')
print(f'  resting_hr : {len(rhr):5d} days  {rng(rhr)}')
print(f'  sleep      : {len(sleep):5d} days  {rng(sleep)}')
print(f'  spo2       : {len(spo2):5d} days  {rng(spo2)}')
print(f'  stress     : {len(stress):5d} days  {rng(stress)}')
# recent window coverage (last 120 days of export)
recent = [r for r in rows if r['date'] >= '2026-05-20']
print(f'\nwindow 2026-05-20 onward: {len(recent)} days')
for m in ['resting_hr', 'sleep_min', 'spo2', 'stress']:
    n = sum(1 for r in recent if r[m] != '')
    print(f'  {m}: {n}/{len(recent)} days')
print('\nlast 10 rows:')
for r in rows[-10:]:
    print(' ', r)
print(f'\nwritten -> {OUT}')
