import * as THREE from 'three'
import { REPLAY_DURATION, sampleRoute } from './replay-route.js'

const STANDARD_TIMES = {
  R1: [0, 3, 5, 10, 16, 21, 25, 34, 36, 44, 45.5, 50],
  R2: [0, 3, 5, 10, 16, 36, 44, 45.5, 50],
  R3: [0, 3, 5, 21, 25, 34, 36, 44, 45.5, 50],
  R4: [0, 3, 5, 10, 16, 21, 25, 44, 45.5, 50],
}

const CONNECTORS = {
  R3: {
    segmentIndex: 2,
    phase: 'To C · Alternative Sequence',
    keys: [
      [5, -4.8, 3.9, 'dwell'],
      [9, -4.2, -0.3, 'move'],
      [14, 0.2, -4.4, 'move'],
      [18, 3.8, -3.7, 'move'],
      [21, 4.8, -0.65, 'detour', true],
    ],
  },
  R4: {
    segmentIndex: 6,
    phase: 'To D · No Return to B',
    keys: [
      [25, 6.15, -2.9, 'detour', true],
      [29, 4.8, -4.25, 'move'],
      [35, 0.4, -4.35, 'move'],
      [40, -2.4, -3.8, 'move'],
      [44, -2.8, -2.95, 'dwell'],
    ],
  },
}

const mix = (a, b, t) => a + (b - a) * t

export function createVisitorRoute(visitor) {
  const actualTimes = [
    visitor.entryDelay,
    ...visitor.visits.flatMap((visit) => [visit.arrival, visit.departure]),
    visitor.exitTime,
  ]
  if (visitor.routeId === 'R2') {
    // B's dwell ends at standard time 16; the next segment reuses B → D from 36.
    // Repeat the actual departure to avoid interpolating C and the return to B.
    actualTimes.splice(5, 0, actualTimes[4])
  }
  const standardTimes = STANDARD_TIMES[visitor.routeId]
  if (!standardTimes || standardTimes.length !== actualTimes.length) {
    throw new Error(`Incomplete public-pool route timing: ${visitor.id} / ${visitor.routeId}`)
  }
  return { actualTimes, standardTimes }
}

function sampleConnector(connector, time, out) {
  const keys = connector.keys
  const elapsed = THREE.MathUtils.clamp(time, keys[0][0], keys[keys.length - 1][0])
  out.point ??= new THREE.Vector3()
  out.tangent ??= new THREE.Vector3(0, 0, -1)
  out.heading ??= new THREE.Vector3(0, 0, -1)
  let index = keys.length - 2
  for (let i = 0; i < keys.length - 1; i++) {
    if (elapsed < keys[i + 1][0]) { index = i; break }
  }
  const from = keys[index]
  const to = keys[index + 1]
  const previous = keys[Math.max(0, index - 1)]
  const next = keys[Math.min(keys.length - 1, index + 2)]
  const duration = to[0] - from[0]
  const alpha = THREE.MathUtils.clamp((elapsed - from[0]) / duration, 0, 1)
  const m1Scale = from[3] === 'dwell' ? 0 : from[4] ? 0.28 : 1
  const m2Scale = to[3] === 'dwell' ? 0 : to[4] ? 0.28 : 1
  const m1x = (to[1] - previous[1]) * duration / Math.max(0.001, to[0] - previous[0]) * m1Scale
  const m1z = (to[2] - previous[2]) * duration / Math.max(0.001, to[0] - previous[0]) * m1Scale
  const m2x = (next[1] - from[1]) * duration / Math.max(0.001, next[0] - from[0]) * m2Scale
  const m2z = (next[2] - from[2]) * duration / Math.max(0.001, next[0] - from[0]) * m2Scale
  const t2 = alpha * alpha
  const t3 = t2 * alpha
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + alpha
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const x = h00 * from[1] + h10 * m1x + h01 * to[1] + h11 * m2x
  const z = h00 * from[2] + h10 * m1z + h01 * to[2] + h11 * m2z
  out.point.set(x, 0.02, z)
  const dh00 = 6 * t2 - 6 * alpha
  const dh10 = 3 * t2 - 4 * alpha + 1
  const dh01 = -6 * t2 + 6 * alpha
  const dh11 = 3 * t2 - 2 * alpha
  const dx = dh00 * from[1] + dh10 * m1x + dh01 * to[1] + dh11 * m2x
  const dz = dh00 * from[2] + dh10 * m1z + dh01 * to[2] + dh11 * m2z
  out.speed = Math.hypot(dx, dz) / duration
  if (out.speed > 0.005) out.tangent.set(dx, 0, dz).normalize()
  out.heading.copy(out.tangent)
  out.kind = 'move'
  out.phase = connector.phase
  out.dwellWeight = 0
  out.segmentIndex = index
}

export function sampleVisitorRoute(visitor, time, out = {}) {
  const clamped = THREE.MathUtils.clamp(time, 0, REPLAY_DURATION)
  if (visitor.isSelf) {
    // The self layer is the exact personal-replay route used by the first-person camera.
    sampleRoute(clamped, out)
    out.elapsed = clamped
    out.progress = clamped / REPLAY_DURATION
    out.standardTime = clamped
    return out
  }
  let standardTime = 0
  let segmentIndex = 0
  if (clamped >= visitor.exitTime) {
    standardTime = REPLAY_DURATION
    segmentIndex = visitor.actualTimes.length - 2
  } else if (clamped > visitor.entryDelay) {
    for (let index = 0; index < visitor.actualTimes.length - 1; index++) {
      const from = visitor.actualTimes[index]
      const to = visitor.actualTimes[index + 1]
      if (clamped <= to) {
        const alpha = (clamped - from) / Math.max(0.0001, to - from)
        standardTime = mix(visitor.standardTimes[index], visitor.standardTimes[index + 1], alpha)
        segmentIndex = index
        break
      }
    }
  }
  const connector = CONNECTORS[visitor.routeId]
  if (connector?.segmentIndex === segmentIndex
    && standardTime > visitor.standardTimes[segmentIndex]
    && standardTime < visitor.standardTimes[segmentIndex + 1]) {
    sampleConnector(connector, standardTime, out)
  } else {
    sampleRoute(standardTime, out)
  }
  const laneEnvelope = Math.sin(standardTime / REPLAY_DURATION * Math.PI)
  const lane = visitor.lane * (0.35 + laneEnvelope * 0.65)
  out.point.x += -out.tangent.z * lane
  out.point.z += out.tangent.x * lane
  out.elapsed = clamped
  out.progress = clamped / REPLAY_DURATION
  out.standardTime = standardTime
  return out
}
