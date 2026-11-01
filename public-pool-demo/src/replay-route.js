import * as THREE from 'three'

export const REPLAY_DURATION = 50

// Absolute-time route. Every coordinate and dwell duration is simulated.
// Repeated B coordinates intentionally represent leaving and returning.
const keys = [
  [0, 0, 6.55, 'To A', 'move'],
  [3, -4.8, 3.9, 'A · Brief Dwell', 'dwell', 'A'],
  [5, -4.8, 3.9, 'Leaving A · To B', 'dwell'],
  [6, -4.0, 4.2, 'To B', 'move'],
  [8, -2.4, 3.9, 'To B', 'move'],
  [10, 0, 2.15, 'B · Extended Dwell', 'dwell', 'B'],
  [16, 0, 2.15, 'Leaving B · To C', 'dwell'],
  [17, 1.3, 2.15, 'Leaving B · To C', 'move'],
  [19, 2.8, 0.3, 'To C', 'move'],
  [21, 4.8, -0.65, 'C · Detour', 'detour', 'C'],
  [23, 6.15, -1.1, 'C · Detour', 'detour'],
  [25, 6.15, -2.9, 'C · Detour', 'detour'],
  [27, 4.8, -3.25, 'Returning to B', 'move'],
  [29, 3.1, -2.6, 'Returning to B', 'move'],
  [31, 2.4, -0.4, 'Returning to B', 'move'],
  [33, 1.3, 2.15, 'Returning to B', 'move'],
  [34, 0, 2.15, 'B · Second Viewing', 'dwell', 'B'],
  [36, 0, 2.15, 'Leaving B · To D', 'dwell'],
  [37, 1.3, 2.15, 'Leaving B · To D', 'move'],
  [38.5, 2.4, 0.3, 'To D', 'move'],
  [40, 2.4, -2.95, 'To D', 'move'],
  [44, -2.8, -2.95, 'D · Brief Dwell', 'dwell', 'D'],
  [45.5, -2.8, -2.95, 'To Exit', 'dwell'],
  [46.5, -1.2, -3.05, 'To Exit', 'move'],
  [48.3, -1.2, -5.45, 'To Exit', 'move'],
  [50, 0, -6.55, 'Exited', 'end', 'EXIT'],
].map(([time, x, z, phase, kind, target = null]) => ({ time, x, z, phase, kind, target }))

export const REPLAY_ROUTE_POINTS = keys
  .map((key) => new THREE.Vector3(key.x, 0.042, key.z))
  .filter((point, index, points) => index === 0 || point.distanceToSquared(points[index - 1]) > 1e-8)

const smoothstep = (value) => {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}
const samePosition = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-6
const previousHeading = new THREE.Vector3()
const nextHeading = new THREE.Vector3()

function segmentDirection(index, out) {
  const from = keys[index]
  const to = keys[index + 1]
  if (!from || !to || samePosition(from, to)) return false
  out.set(to.x - from.x, 0, to.z - from.z).normalize()
  return true
}

function nearestSegmentDirection(start, step, out) {
  for (let i = start; i >= 0 && i < keys.length - 1; i += step) {
    if (segmentDirection(i, out)) return true
  }
  return false
}

function blendHeading(from, to, amount, out) {
  const fromYaw = Math.atan2(from.x, from.z)
  const toYaw = Math.atan2(to.x, to.z)
  const delta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw))
  const yaw = fromYaw + delta * amount
  out.set(Math.sin(yaw), 0, Math.cos(yaw))
}

export function sampleRoute(time, out = {}) {
  const elapsed = THREE.MathUtils.clamp(time, 0, REPLAY_DURATION)
  out.point ??= new THREE.Vector3()
  out.tangent ??= new THREE.Vector3(0, 0, -1)
  out.heading ??= new THREE.Vector3(0, 0, -1)
  let index = keys.length - 2
  for (let i = 0; i < keys.length - 1; i++) {
    if (elapsed < keys[i + 1].time || i === keys.length - 2) {
      index = i
      break
    }
  }
  const from = keys[index]
  const to = keys[index + 1]
  const previous = keys[Math.max(0, index - 1)]
  const next = keys[Math.min(keys.length - 1, index + 2)]
  const duration = to.time - from.time
  const localTime = THREE.MathUtils.clamp(elapsed - from.time, 0, duration)
  const alpha = duration > 0 ? localTime / duration : 1
  const moving = !samePosition(from, to)

  if (moving) {
    const fromStationary = from.kind === 'dwell' || from.kind === 'end' || samePosition(from, previous)
    const toStationary = to.kind === 'dwell' || to.kind === 'end' || samePosition(to, next)
    // Non-stop arrivals (C) keep a continuous path but enter and leave the
    // target tangent slowly; dwell arrivals still ease all the way to zero.
    const m1Scale = fromStationary ? 0 : from.target ? 0.28 : 1
    const m2Scale = toStationary ? 0 : to.target ? 0.28 : 1
    const m1x = (to.x - previous.x) * duration / Math.max(0.001, to.time - previous.time) * m1Scale
    const m1z = (to.z - previous.z) * duration / Math.max(0.001, to.time - previous.time) * m1Scale
    const m2x = (next.x - from.x) * duration / Math.max(0.001, next.time - from.time) * m2Scale
    const m2z = (next.z - from.z) * duration / Math.max(0.001, next.time - from.time) * m2Scale
    const t2 = alpha * alpha
    const t3 = t2 * alpha
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + alpha
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    const x = h00 * from.x + h10 * m1x + h01 * to.x + h11 * m2x
    const z = h00 * from.z + h10 * m1z + h01 * to.z + h11 * m2z
    out.point.set(x, 0.02, z)

    const dh00 = 6 * t2 - 6 * alpha
    const dh10 = 3 * t2 - 4 * alpha + 1
    const dh01 = -6 * t2 + 6 * alpha
    const dh11 = 3 * t2 - 2 * alpha
    const dx = dh00 * from.x + dh10 * m1x + dh01 * to.x + dh11 * m2x
    const dz = dh00 * from.z + dh10 * m1z + dh01 * to.z + dh11 * m2z
    out.speed = Math.hypot(dx, dz) / duration
    if (out.speed > 0.005) out.tangent.set(dx, 0, dz).normalize()

    // Heading is a gaze direction, not a zero-speed derivative. Blend segment
    // chords around joins so the camera never snaps when Hermite speed is zero.
    segmentDirection(index, out.heading)
    if (alpha > 0.45 && segmentDirection(index + 1, nextHeading)) {
      blendHeading(out.heading, nextHeading, smoothstep((alpha - 0.45) / 0.55), out.heading)
    }
  } else {
    out.point.set(from.x, 0.02, from.z)
    out.speed = 0
    const hasPrevious = nearestSegmentDirection(index - 1, -1, previousHeading)
    const hasNext = nearestSegmentDirection(index, 1, nextHeading)
    if (hasPrevious && hasNext) {
      // Finish turning while the visitor is still at the work. In particular,
      // A turns toward B before departure instead of snapping on first motion.
      const turn = smoothstep(localTime / Math.max(0.001, duration))
      blendHeading(previousHeading, nextHeading, turn, out.heading)
    } else if (hasPrevious) out.heading.copy(previousHeading)
    else if (hasNext) out.heading.copy(nextHeading)
  }

  if (out.speed <= 0.005) {
    for (let i = index - 1; i >= 0; i--) {
      const dx = keys[i + 1].x - keys[i].x
      const dz = keys[i + 1].z - keys[i].z
      if (Math.hypot(dx, dz) > 1e-6) {
        out.tangent.set(dx, 0, dz).normalize()
        break
      }
    }
  }

  out.elapsed = elapsed
  out.progress = elapsed / REPLAY_DURATION
  out.phase = from.phase
  out.kind = from.kind
  out.segmentIndex = index
  out.dwellWeight = from.kind === 'dwell'
    ? smoothstep(localTime / 0.45) * smoothstep((duration - localTime) / 0.45)
    : 0
  return out
}
