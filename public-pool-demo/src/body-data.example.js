import { REPLAY_DURATION } from './replay-route.js'

// Synthetic daily summaries for a fresh clone. Copy this file to body-data.js.
// Sleep is excluded. Interpolation between days creates simulated visual
// parameters, not second-by-second measurements inside an exhibition.
export const BODY_MONTH = Object.freeze([
  ['2026-08-20', 58, 95.0, 52],
  ['2026-08-21', 57, 95.4, 50],
  ['2026-08-22', 60, 94.8, 58],
  ['2026-08-23', 59, 95.2, 55],
  ['2026-08-24', 56, 95.7, 49],
  ['2026-08-25', 61, 95.1, 60],
  ['2026-08-26', 62, 94.9, 63],
  ['2026-08-27', 60, 95.3, 57],
  ['2026-08-28', 58, 95.6, 54],
  ['2026-08-29', 59, 95.2, 56],
  ['2026-08-30', 63, 94.7, 65],
  ['2026-08-31', 64, 94.9, 66],
  ['2026-09-01', 61, 95.4, 60],
  ['2026-09-02', 60, 95.5, 58],
  ['2026-09-03', 62, 95.0, 62],
  ['2026-09-04', 65, 94.6, 68],
  ['2026-09-05', 63, 95.1, 64],
  ['2026-09-06', 60, 95.6, 57],
  ['2026-09-07', 58, 95.8, 53],
  ['2026-09-08', 57, 95.5, 51],
  ['2026-09-09', 59, 95.2, 56],
  ['2026-09-10', 61, 94.9, 61],
  ['2026-09-11', 60, 95.3, 59],
  ['2026-09-12', 58, 95.7, 54],
  ['2026-09-13', 56, 95.9, 50],
  ['2026-09-14', 57, 95.6, 52],
  ['2026-09-15', 59, 95.2, 57],
  ['2026-09-16', 62, 94.8, 64],
  ['2026-09-17', 61, 95.0, 61],
  ['2026-09-18', 58, 95.5, 55],
].map(([date, restingHr, spo2, stress]) => Object.freeze({ date, restingHr, spo2, stress })))

export const BODY_DATA_WINDOW = Object.freeze({
  start: BODY_MONTH[0].date,
  end: BODY_MONTH.at(-1).date,
  days: BODY_MONTH.length,
})

const mix = (a, b, t) => a + (b - a) * t
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const smoothstep = (value) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  return mix(sorted[lower], sorted[Math.min(lower + 1, sorted.length - 1)], position - lower)
}

const ranges = Object.fromEntries(['restingHr', 'spo2', 'stress'].map((key) => {
  const values = BODY_MONTH.map((day) => day[key])
  return [key, Object.freeze([quantile(values, 0.1), quantile(values, 0.9)])]
}))

export const BODY_MAPPING_RULES = Object.freeze({
  ranges,
  emissionRate: Object.freeze([20, 50]),
  flowSpeed: Object.freeze([0.08, 0.32]),
  particleLife: Object.freeze([6, 12]),
  spread: Object.freeze([0.05, 0.24]),
  hue: Object.freeze([190, 20]),
  memoryEmissionRate: 16,
  memoryAlpha: Object.freeze([0.3, 0.65]),
})

const normalize = (value, [min, max]) => clamp01((value - min) / (max - min || 1))

export function sampleBodyData(time, out = {}) {
  const dayPosition = clamp01(time / REPLAY_DURATION) * (BODY_MONTH.length - 1)
  const index = Math.min(Math.floor(dayPosition), BODY_MONTH.length - 2)
  const alpha = smoothstep(dayPosition - index)
  const from = BODY_MONTH[index]
  const to = BODY_MONTH[index + 1]
  out.date = alpha < 0.5 ? from.date : to.date
  out.dayPosition = dayPosition
  out.restingHr = mix(from.restingHr, to.restingHr, alpha)
  out.spo2 = mix(from.spo2, to.spo2, alpha)
  out.stress = mix(from.stress, to.stress, alpha)
  out.hrNorm = normalize(out.restingHr, ranges.restingHr)
  out.spo2Norm = normalize(out.spo2, ranges.spo2)
  out.stressNorm = normalize(out.stress, ranges.stress)
  out.emissionRate = mix(...BODY_MAPPING_RULES.emissionRate, out.hrNorm)
  out.flowSpeed = mix(...BODY_MAPPING_RULES.flowSpeed, out.hrNorm)
  out.particleLife = mix(...BODY_MAPPING_RULES.particleLife, out.spo2Norm)
  out.spread = mix(...BODY_MAPPING_RULES.spread, out.stressNorm)
  out.hue = mix(...BODY_MAPPING_RULES.hue, out.stressNorm)
  out.memoryAlpha = mix(...BODY_MAPPING_RULES.memoryAlpha, out.spo2Norm)
  return out
}
