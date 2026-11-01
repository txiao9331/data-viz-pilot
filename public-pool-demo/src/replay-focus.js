import * as THREE from 'three'

const FOCUS_STOPS = [
  { id: 'A', start: 0, target: new THREE.Vector3(-4.8, 1, 2.8) },
  { id: 'B', start: 5, target: new THREE.Vector3(0, 1, 1) },
  { id: 'C', start: 16, target: new THREE.Vector3(4.8, 1, -2) },
  { id: 'B', start: 27, target: new THREE.Vector3(0, 1, 1) },
  { id: 'D', start: 36, target: new THREE.Vector3(-2.8, 1, -4.2) },
  { id: 'EXIT', start: 45.5, target: new THREE.Vector3(0, 1.3, -6.9) },
]

// Both personal replay and the public-pool first-person view share this exact
// absolute-time gaze choreography, so seeking never depends on prior frames.
export function sampleReplayFocus(time, out) {
  const index = Math.max(0, FOCUS_STOPS.findLastIndex((stop) => time >= stop.start))
  const stop = FOCUS_STOPS[index]
  const previous = FOCUS_STOPS[Math.max(0, index - 1)]
  const blend = index === 0 ? 1 : THREE.MathUtils.smoothstep(time, stop.start, stop.start + 1.2)
  out.copy(previous.target).lerp(stop.target, blend)
  return index === 0 || blend >= 0.999 ? stop.id : `${previous.id}→${stop.id}`
}
