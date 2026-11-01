# Data-Viz Pilot

**Body data, painted as breathing fluid.** An experimental two-mode visualisation instrument for wearable health data: a generative abstract fluid alongside conventional small-multiple charts, with a built-in study flow (consent → pre-survey → viewing → post-survey) and an anonymised public pool simulation.

参与者用自己的可穿戴数据，在"抽象生成流体 / 常规图表"两种可视化之间对照观看，问卷测量理解、信任、情绪与公共池出让意愿。中英双语（默认中文，右上角切换 EN）。

## Quickstart

### Original two-mode pilot

The app reads `viz/data/huawei_daily.csv`. A synthetic `mock.csv` is included, so a fresh clone needs one copy step:

```bash
cd viz
cp data/mock.csv data/huawei_daily.csv
cp data/mock.csv data/huawei_daily_full.csv   # needed for ?days=all and ?mode=pool
python -m http.server 8000
# open http://localhost:8000
```

(Double-clicking `index.html` will not work: browsers block local file reads under `file://`.)

Useful URL parameters: `?lang=en` · `?mode=abstract|chart` · `?day=YYYY-MM-DD` (freeze one day) · `?days=all` (fast-run the full archive) · `?mode=pool` (public pool simulation) · `?view=layers` (researcher view) · `?step=pre|viewing|post|done` (skip ahead, testing only). In the pool, **R** toggles public/layered view; holding **SPACE** temporarily removes "my" layer.

### Current 3D portfolio demo

Requires Node.js 22.12 or later. The demo includes personal particle replay, a simulated 36-visitor public pool, overhead and first-person cameras, and a dark gallery with emissive traces.

```bash
cd public-pool-demo
cp src/body-data.example.js src/body-data.js   # fresh clone only; synthetic data
npm install
npm run dev
# open the local URL printed by the development server
```

If `src/body-data.js` already exists, do not overwrite it: the local file contains personal daily summaries and is gitignored. The example file uses synthetic values. **Space** pauses/continues, **V** changes the camera, and **R** restarts the replay.

Useful commands: `npm run check` validates the project; `npm run build` creates the gitignored `dist/` directory.

## Repository structure

```
data-viz-pilot/
├── viz/                         # original two-mode p5.js instrument
│   ├── index.html               # four-step study wizard
│   ├── sketch.js                # particle fluid, charts and pool simulation
│   ├── app.js                   # wizard flow, i18n, session log, JSON export
│   ├── lib/                     # localised p5.js
│   └── data/
│       ├── mock.csv             # synthetic sample data (tracked)
│       ├── huawei_daily.csv     # personal — gitignored
│       └── huawei_daily_full.csv # personal — gitignored
├── scripts/
│   └── huawei_to_daily.py       # raw Huawei export → daily CSV
├── public-pool-demo/            # current 3D demo (Edit3D / Three.js)
│   ├── src/                     # scenes, routes, particles and English UI
│   │   ├── body-data.example.js # synthetic monthly-data template
│   │   └── body-data.js         # real monthly summaries — local, gitignored
│   ├── docs/                    # mapping, design decisions and checkpoints
│   ├── scripts/                 # pool-data generation and validation
│   ├── .edit3d/                 # local runtime packages required by npm
│   └── data/                    # editor state — gitignored
├── portfolio-concept/           # application narrative and presentation assets
│   ├── Public Pool_ Particle Replay of Body–Space Trajectories.pptx
│   │                            # current English application deck
│   ├── public-pool-concept.pptx # earlier Chinese deck
│   ├── demo-development-workflow.md
│   ├── scripts/                 # contact-sheet and comparison-image utilities
│   ├── screenshots/             # development evidence and selected final views
│   └── media/                   # historical recordings and reference sheets
├── media/                       # recordings of the original pilot modes
├── docs/                        # private research documents — gitignored
├── consent/                     # consent form draft
├── questionnaire/               # questionnaire draft
├── sessions/                    # participant session exports — gitignored
├── working files/               # client-managed document copies — gitignored
└── data/                        # full-archive daily CSV — gitignored
```

## Data format

`date,resting_hr,sleep_min,spo2,stress,sleep_capped`

Daily granularity; `sleep_capped=1` marks days truncated at 960 min (bad-merge / extreme-day guard). To use your own records, export daily summaries from your wearable provider and shape them to this schema, then drop them in as `viz/data/huawei_daily.csv`.

The 3D demo uses 30 daily summaries of resting heart rate, SpO2 and stress; sleep is excluded. Gallery routes, dwell times and the 36 visitors are simulated. Interpolated values drive visual parameters and are not presented as second-by-second exhibition measurements.

## Demo recordings

**Personal view** — the abstract fluid evolving day by day, chart mode, and the post-viewing questionnaire flow:

![Personal view demo](media/demo_person.gif)

([full video via Pages](https://txiao9331.github.io/data-viz-pilot/media/demo_person.mp4) · [repo file](media/demo_person.mp4))

**Public pool simulation** — the merged fluid, the R-key toggle to the layered researcher view, and the space-bar probe that temporarily removes "my" layer:

![Public pool demo](media/demo_public_pool.gif)

([full video via Pages](https://txiao9331.github.io/data-viz-pilot/media/demo_public_pool.mp4) · [repo file](media/demo_public_pool.mp4))

## Privacy by design

Personal health data is **never committed**: raw exports, derived CSVs, the real 3D `body-data.js`, and session logs are all gitignored. Synthetic `mock.csv` and `body-data.example.js` files make fresh clones runnable without personal records. Open-text answers are exported separately from session metadata. Consent form and questionnaire drafts are included so the study flow is reviewable end to end.

Root-level `docs/` remains private, while `public-pool-demo/docs/` contains shareable technical and design notes. Client-managed `working files/`, local editor state, dependencies, builds and regenerable validation renders are excluded from Git.

## Status

- **Original pilot v0.5:** single-participant pipeline complete (data → visualisation → four-step flow → pool simulation → JSON export).
- **3D portfolio demo v0.1:** personal replay and simulated 36-visitor public pool implemented; current application deck is in English.
- **Next:** small-group participant runs and further refinement of the exhibition-replay experience.

## Acknowledgement

The abstract mode is an Anadol-style homage; the original *Unsupervised* runs on GPU-cluster ML models, this runs on four daily metrics.
