import * as THREE from 'three'
import { BODY_MAPPING_RULES } from './body-data.js'
import { REPLAY_DURATION, sampleRoute } from './replay-route.js'
import { sampleReplayFocus } from './replay-focus.js'
import { createVisitorRoute, sampleVisitorRoute } from './pool-route.js'
import visitorData from './data/pool-visitors.json'
import aggregateData from './data/pool-aggregate.json'

const FLOW_RATE = 12
const MEMORY_RATE = 4
const HISTORY_STEPS = 24
const HISTORY_STEP = 0.12
const HISTORY_DURATION = HISTORY_STEPS * HISTORY_STEP
const NODE_HEAT = Object.fromEntries(aggregateData.nodes.map((node) => [node.node, node.heatWeight]))

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const mix = (a, b, t) => a + (b - a) * t
const normalize = (value, [min, max]) => clamp01((value - min) / (max - min || 1))

function visitorRandom(visitor) {
  let seed = visitor.randomSeed
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function createVisitorRuntime(visitor) {
  const random = visitorRandom(visitor)
  return {
    ...visitor,
    ...createVisitorRoute(visitor),
    lane: (random() - 0.5) * 1.05,
    phase: random() * Math.PI * 2,
  }
}

function sampleVisitorBody(visitor, time, out = {}) {
  const wave = Math.sin(time * 0.19 + visitor.body.wavePhase)
  out.restingHr = visitor.body.restingHr + wave * visitor.body.restingHrAmplitude
  out.spo2 = visitor.body.spo2 + Math.sin(time * 0.13 + visitor.body.wavePhase * 0.7) * visitor.body.spo2Amplitude
  out.stress = visitor.body.stress + Math.sin(time * 0.23 + visitor.body.wavePhase * 1.3) * visitor.body.stressAmplitude
  out.hrNorm = normalize(out.restingHr, BODY_MAPPING_RULES.ranges.restingHr)
  out.spo2Norm = normalize(out.spo2, BODY_MAPPING_RULES.ranges.spo2)
  out.stressNorm = normalize(out.stress, BODY_MAPPING_RULES.ranges.stress)
  out.hue = mix(...BODY_MAPPING_RULES.hue, out.stressNorm)
  out.spread = mix(...BODY_MAPPING_RULES.spread, out.stressNorm)
  return out
}

function createDiscTexture() {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1
    const dy = (y + 0.5) / size * 2 - 1
    const alpha = THREE.MathUtils.clamp(1 - Math.hypot(dx, dy), 0, 1)
    const index = (y * size + x) * 4
    data[index] = data[index + 1] = data[index + 2] = 255
    data[index + 3] = Math.pow(alpha, 0.65) * 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.needsUpdate = true
  return texture
}

function createLineGeometry(records) {
  const geometry = new THREE.BufferGeometry()
  const vertexCapacity = records.length * HISTORY_STEPS * 2
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(vertexCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(vertexCapacity), 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setDrawRange(0, 0)
  return geometry
}

function createLineMaterial(name) {
  return new THREE.ShaderMaterial({
    name,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        #include <logdepthbuf_fragment>
        if (vAlpha < 0.008) discard;
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
  })
}

function writeStreamPosition(record, age, out, offset) {
  const t = Math.max(0, age)
  const phase = record.phase
  let x
  let z
  if (record.orbit) {
    const angle = phase + t * record.angular + Math.sin(t * 0.43 + phase) * 0.38
    const radius = record.radius * (0.76 + Math.sin(t * 0.37 + phase * 1.3) * 0.24)
    const curl = record.spread * (0.65 + Math.min(t, 4) * 0.13)
    x = record.x + Math.cos(angle) * radius
      + (Math.sin(record.z * 1.3 + phase + t * 0.9) - Math.sin(record.z * 1.3 + phase)) * curl
    z = record.z + Math.sin(angle) * radius
      + (Math.cos(record.x * 1.5 + phase * 0.8 + t * 0.76) - Math.cos(record.x * 1.5 + phase * 0.8)) * curl
  } else {
    const curl = record.spread * (1.5 + Math.min(t, 5) * 0.26)
    x = record.x + record.vx * t
      + (Math.sin(record.z * 1.6 + phase + t * 0.95) - Math.sin(record.z * 1.6 + phase)) * curl
    z = record.z + record.vz * t
      + (Math.cos(record.x * 1.45 + phase * 0.72 + t * 0.78) - Math.cos(record.x * 1.45 + phase * 0.72)) * curl
  }
  out[offset] = x
  out[offset + 1] = Math.max(0.055, record.y + record.vy * t
    + (Math.sin(phase + t * 1.15) - Math.sin(phase)) * (record.type === 2 ? 0.075 : 0.11))
  out[offset + 2] = z
}

function writeLineHistory(records, geometry, elapsed, persistent) {
  const positions = geometry.attributes.position.array
  const colors = geometry.attributes.aColor.array
  const alphas = geometry.attributes.aAlpha.array
  let alive = 0
  let segments = 0
  for (const record of records) {
    const age = elapsed - record.birth
    if (age < 0 || age >= record.life) continue
    alive++
    const fadeIn = THREE.MathUtils.smoothstep(age, 0, 0.2)
    const fadeOut = persistent ? 1 : 1 - THREE.MathUtils.smoothstep(age / record.life, 0.62, 1)
    for (let step = 0; step < HISTORY_STEPS; step++) {
      const ageA = Math.max(0, age - (HISTORY_STEPS - step) * HISTORY_STEP)
      const ageB = age - (HISTORY_STEPS - step - 1) * HISTORY_STEP
      if (ageB <= 0) continue
      const vertex = segments * 2
      const positionOffset = vertex * 3
      writeStreamPosition(record, ageA, positions, positionOffset)
      writeStreamPosition(record, ageB, positions, positionOffset + 3)
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const colorOffset = positionOffset + endpoint * 3
        colors[colorOffset] = record.color[0]
        colors[colorOffset + 1] = record.color[1]
        colors[colorOffset + 2] = record.color[2]
      }
      const recentA = THREE.MathUtils.clamp(ageA / HISTORY_DURATION, 0, 1)
      const recentB = THREE.MathUtils.clamp(ageB / HISTORY_DURATION, 0, 1)
      const floor = persistent ? 0.28 : 0.05
      const heat = 0.72 + record.heat * 0.28
      alphas[vertex] = record.alpha * heat * fadeIn * fadeOut * (floor + (1 - floor) * recentA)
      alphas[vertex + 1] = record.alpha * heat * fadeIn * fadeOut * (floor + (1 - floor) * recentB)
      segments++
    }
  }
  geometry.setDrawRange(0, segments * 2)
  geometry.attributes.position.needsUpdate = true
  geometry.attributes.aColor.needsUpdate = true
  geometry.attributes.aAlpha.needsUpdate = true
  return { alive, segments }
}

export function createPoolSystem({ scene, camera, asset }) {
  const visitors = visitorData.visitors.map(createVisitorRuntime)
  const routeCounts = Object.fromEntries(['R1', 'R2', 'R3', 'R4'].map((routeId) => [
    routeId,
    visitors.filter((visitor) => visitor.routeId === routeId).length,
  ]))
  const flowRecords = []
  const memoryRecords = []
  const emitter = {}
  const body = {}
  const color = new THREE.Color()

  for (const visitor of visitors) {
    const random = visitorRandom(visitor)
    for (let index = 0; index < FLOW_RATE * REPLAY_DURATION; index++) {
      const birth = (index + 0.5) / FLOW_RATE
      if (birth < visitor.entryDelay || birth > visitor.exitTime) continue
      sampleVisitorBody(visitor, birth, body)
      if (random() > 0.72 + body.hrNorm * 0.28) continue
      sampleVisitorRoute(visitor, birth, emitter)
      if (emitter.kind === 'end') continue
      const orbit = emitter.kind === 'dwell' || emitter.kind === 'detour'
      const sideX = -emitter.tangent.z
      const sideZ = emitter.tangent.x
      const lateral = (random() - 0.5) * body.spread
      const speed = mix(0.06, 0.22, body.hrNorm) * (0.7 + random() * 0.6)
      const nodeId = ['A', 'B', 'C', 'D'].find((id) => emitter.phase.startsWith(id))
      color.setHSL(body.hue / 360, 0.62, 0.66)
      flowRecords.push({
        visitorId: visitor.id,
        type: 1,
        orbit,
        birth,
        life: mix(5, 9, body.spo2Norm) * (0.85 + random() * 0.3),
        x: emitter.point.x,
        y: 0.28 + random() * 1.2,
        z: emitter.point.z,
        vx: emitter.tangent.x * speed + sideX * lateral,
        vy: (random() - 0.5) * 0.025,
        vz: emitter.tangent.z * speed + sideZ * lateral,
        radius: 0.16 + random() * 0.72,
        phase: random() * Math.PI * 2,
        angular: (0.5 + body.stressNorm * 0.85) * (random() > 0.5 ? 1 : -1),
        spread: body.spread,
        alpha: 0.08 + random() * 0.08,
        heat: NODE_HEAT[nodeId] ?? 0.3,
        hue: body.hue + (random() - 0.5) * 8,
        lightness: 0.66,
        color: [color.r, color.g, color.b],
      })
    }
    for (let index = 0; index < MEMORY_RATE * REPLAY_DURATION; index++) {
      const birth = (index + 0.5) / MEMORY_RATE
      if (birth < visitor.entryDelay || birth > visitor.exitTime) continue
      sampleVisitorRoute(visitor, birth, emitter)
      if (emitter.kind === 'end') continue
      sampleVisitorBody(visitor, birth, body)
      const orbit = emitter.kind === 'dwell' || emitter.kind === 'detour'
      const sideX = -emitter.tangent.z
      const sideZ = emitter.tangent.x
      const lateral = (random() - 0.5) * (orbit ? body.spread * 1.5 : 0.24)
      const nodeId = ['A', 'B', 'C', 'D'].find((id) => emitter.phase.startsWith(id))
      color.setHSL(body.hue / 360, 0.62, 0.64)
      memoryRecords.push({
        visitorId: visitor.id,
        type: 2,
        orbit,
        birth,
        life: REPLAY_DURATION - birth + 0.5,
        x: emitter.point.x + (orbit ? 0 : sideX * lateral),
        y: 0.24 + random() * 1.08,
        z: emitter.point.z + (orbit ? 0 : sideZ * lateral),
        vx: orbit ? sideX * lateral * 0.08 : emitter.tangent.x * 0.018 + sideX * lateral * 0.03,
        vy: 0,
        vz: orbit ? sideZ * lateral * 0.08 : emitter.tangent.z * 0.018 + sideZ * lateral * 0.03,
        radius: 0.14 + random() * 0.64,
        phase: random() * Math.PI * 2,
        angular: (0.42 + body.stressNorm * 0.72) * (random() > 0.5 ? 1 : -1),
        spread: Math.max(0.075, body.spread * 0.82),
        alpha: 0.022 + body.spo2Norm * 0.03 + random() * 0.012,
        heat: NODE_HEAT[nodeId] ?? 0.3,
        hue: body.hue + (random() - 0.5) * 8,
        lightness: 0.64,
        color: [color.r, color.g, color.b],
      })
    }
  }

  const disc = createDiscTexture()
  const coreGeometry = new THREE.BufferGeometry()
  coreGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(visitors.length * 3), 3).setUsage(THREE.DynamicDrawUsage))
  coreGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(visitors.length * 3), 3).setUsage(THREE.DynamicDrawUsage))
  const coreMaterial = new THREE.PointsMaterial({
    name: 'Pool Cores · Simulated Stress Hue (36 Visitors)',
    size: 0.14,
    sizeAttenuation: true,
    map: disc,
    transparent: true,
    opacity: 0.95,
    alphaTest: 0.02,
    depthWrite: false,
    vertexColors: true,
    toneMapped: false,
  })
  const cores = new THREE.Points(coreGeometry, coreMaterial)
  cores.name = 'Public Pool · 36 Visitor Cores'
  cores.frustumCulled = false
  scene.add(cores)

  const emissionGeometry = new THREE.BufferGeometry()
  const emissionCapacity = flowRecords.length + memoryRecords.length
  emissionGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(emissionCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
  emissionGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(emissionCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
  emissionGeometry.setDrawRange(0, 0)
  const emissionMaterial = coreMaterial.clone()
  emissionMaterial.name = 'Pool Emission · Simulated Body Data & Hotspots'
  emissionMaterial.size = 0.055
  emissionMaterial.opacity = 0.76
  emissionMaterial.blending = THREE.AdditiveBlending
  const emission = new THREE.Points(emissionGeometry, emissionMaterial)
  emission.name = 'Public Pool · 36 Visitor Emissions'
  emission.frustumCulled = false
  emission.renderOrder = 4
  scene.add(emission)

  const flowGeometry = createLineGeometry(flowRecords)
  const flow = new THREE.LineSegments(flowGeometry, createLineMaterial('Pool Flow Traces · Simulated Stress Hue'))
  flow.name = 'Public Pool · 36 Visitor Flow Traces'
  flow.frustumCulled = false
  flow.renderOrder = 3
  scene.add(flow)

  const memoryGeometry = createLineGeometry(memoryRecords)
  const memory = new THREE.LineSegments(memoryGeometry, createLineMaterial('Pool Path Memory · Dwell-hotspot Weighted'))
  memory.name = 'Public Pool · 36 Visitor Path Memory'
  memory.frustumCulled = false
  memory.renderOrder = 2
  scene.add(memory)

  asset.register('pool_cores', cores, { name: 'Pool Cores · 36 Visitors' })
  asset.register('pool_emission', emission, { name: 'Pool Emission · Four Routes' })
  asset.register('pool_flow', flow, { name: 'Pool Flow Traces · Four Routes' })
  asset.register('pool_memory', memory, { name: 'Pool Path Memory · Four Routes' })

  const frame = { elapsed: 0, activeVisitors: 0, activeByRoute: {}, activeRecords: 0, emissionPoints: 0, flowLineSegments: 0, memoryLineSegments: 0 }
  const routeSamples = visitors.map(() => ({}))
  function writeEmission(records, elapsed, persistent, start) {
    const positions = emissionGeometry.attributes.position.array
    const colors = emissionGeometry.attributes.color.array
    let count = start
    for (const record of records) {
      const age = elapsed - record.birth
      if (age < 0 || age >= record.life) continue
      const fadeIn = THREE.MathUtils.smoothstep(age, 0, 0.2)
      const fadeOut = persistent ? 1 : 1 - THREE.MathUtils.smoothstep(age / record.life, 0.62, 1)
      const brightness = fadeIn * fadeOut * (persistent ? 0.055 : 0.5) * (0.75 + record.heat * 0.25)
      const ageShift = persistent
        ? THREE.MathUtils.smoothstep(age / 36, 0, 1) * 36
        : THREE.MathUtils.smoothstep(age / record.life, 0, 1) * 54
      color.setHSL((record.hue + ageShift) / 360, 0.62, record.lightness)
      writeStreamPosition(record, age, positions, count * 3)
      colors[count * 3] = color.r * brightness
      colors[count * 3 + 1] = color.g * brightness
      colors[count * 3 + 2] = color.b * brightness
      count++
    }
    return count
  }

  function samplePool(time) {
    const elapsed = THREE.MathUtils.clamp(time, 0, REPLAY_DURATION)
    const corePositions = coreGeometry.attributes.position.array
    const coreColors = coreGeometry.attributes.color.array
    let activeVisitors = 0
    const activeByRoute = Object.fromEntries(Object.keys(routeCounts).map((routeId) => [routeId, 0]))
    visitors.forEach((visitor, index) => {
      sampleVisitorRoute(visitor, elapsed, routeSamples[index])
      const point = routeSamples[index].point
      corePositions[index * 3] = point.x
      corePositions[index * 3 + 1] = 0.9
      corePositions[index * 3 + 2] = point.z
      sampleVisitorBody(visitor, elapsed, body)
      color.setHSL(body.hue / 360, 0.5, 0.66)
      const visible = elapsed >= visitor.entryDelay && elapsed <= visitor.exitTime ? 1 : 0.08
      coreColors[index * 3] = color.r * visible
      coreColors[index * 3 + 1] = color.g * visible
      coreColors[index * 3 + 2] = color.b * visible
      if (visible === 1) {
        activeVisitors++
        activeByRoute[visitor.routeId]++
      }
    })
    coreGeometry.attributes.position.needsUpdate = true
    coreGeometry.attributes.color.needsUpdate = true
    const flowFrame = writeLineHistory(flowRecords, flowGeometry, elapsed, false)
    const memoryFrame = writeLineHistory(memoryRecords, memoryGeometry, elapsed, true)
    flow.visible = flowFrame.segments > 0
    memory.visible = memoryFrame.segments > 0
    let emissionPoints = writeEmission(flowRecords, elapsed, false, 0)
    emissionPoints = writeEmission(memoryRecords, elapsed, true, emissionPoints)
    emissionGeometry.setDrawRange(0, emissionPoints)
    emissionGeometry.attributes.position.needsUpdate = true
    emissionGeometry.attributes.color.needsUpdate = true
    emission.visible = emissionPoints > 0
    Object.assign(frame, {
      elapsed,
      activeVisitors,
      activeByRoute,
      activeRecords: flowFrame.alive + memoryFrame.alive,
      emissionPoints,
      flowLineSegments: flowFrame.segments,
      memoryLineSegments: memoryFrame.segments,
    })
  }

  samplePool(23)
  camera.position.set(0, 16.8, 0.01)
  camera.lookAt(0, 0, 0)

  function createPlay(ctx) {
    let elapsed = 0
    let playing = true
    let view = 'overhead'
    let focusTarget = 'A'
    const routeSample = {}
    const firstPersonTarget = new THREE.Vector3()
    const hud = document.createElement('div')
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:13px system-ui,sans-serif;color:#e6e0d4'
    const title = document.createElement('div')
    title.textContent = 'Public Pool · 36-Visitor Route Comparison'
    title.style.cssText = 'position:absolute;left:18px;top:18px;padding:10px 13px;background:rgba(12,20,16,.78);border-left:2px solid #c68b48;letter-spacing:.06em'
    const note = document.createElement('div')
    note.textContent = '36/36 Simulated Visitors · Majority Routes, Deviations & Dwell Hotspots'
    note.style.cssText = 'position:absolute;left:18px;top:58px;padding:7px 13px;background:rgba(12,20,16,.64);color:#aebbb3;font-size:12px'
    const metrics = document.createElement('div')
    metrics.style.cssText = 'position:absolute;left:18px;top:92px;padding:7px 13px;background:rgba(12,20,16,.58);color:#c7d8d0;font-size:11px'
    const status = document.createElement('div')
    status.style.cssText = 'position:absolute;left:18px;bottom:18px;padding:8px 11px;background:rgba(12,20,16,.72);min-width:250px'
    const controls = document.createElement('div')
    controls.style.cssText = 'position:absolute;right:18px;bottom:18px;display:flex;gap:8px'
    const viewButton = document.createElement('button')
    viewButton.style.cssText = 'position:absolute;right:18px;top:18px;pointer-events:auto;padding:10px 14px;border:1px solid rgba(198,139,72,.7);border-radius:3px;background:rgba(12,20,16,.82);color:#e6e0d4;cursor:pointer;font:inherit'
    hud.append(title, note, metrics, status, controls, viewButton)
    ctx.container.append(hud)

    const makeButton = (label, handler) => {
      const button = document.createElement('button')
      button.textContent = label
      button.style.cssText = 'pointer-events:auto;padding:9px 12px;border:1px solid rgba(230,224,212,.24);border-radius:3px;background:rgba(12,20,16,.82);color:#e6e0d4;cursor:pointer;font:inherit'
      button.addEventListener('click', () => { handler(); ctx.canvas.focus() }, { signal: ctx.signal })
      controls.append(button)
      return button
    }
    const formatTime = (value) => `00:${Math.floor(value).toString().padStart(2, '0')}`
    const updateFirstPerson = () => {
      sampleRoute(elapsed, routeSample)
      camera.position.copy(routeSample.point).setY(1.54)
      focusTarget = sampleReplayFocus(elapsed, firstPersonTarget)
      camera.lookAt(firstPersonTarget)
    }
    const updateHUD = () => {
      metrics.textContent = `Present ${frame.activeVisitors}/36 · R1 ${frame.activeByRoute.R1 ?? 0} · R2 ${frame.activeByRoute.R2 ?? 0} · R3 ${frame.activeByRoute.R3 ?? 0} · R4 ${frame.activeByRoute.R4 ?? 0} · Traces ${frame.activeRecords}`
      const viewStatus = view === 'first' ? `My First-person View · Focus ${focusTarget}` : 'Public Pool Simulation'
      status.textContent = `${formatTime(elapsed)} / 00:50 · ${viewStatus}${playing ? '' : ' · Paused'}`
      title.textContent = view === 'first' ? 'Public Pool · My First-person View' : 'Public Pool · 36-Visitor Route Comparison'
      playButton.textContent = playing ? 'Pause Space' : 'Resume Space'
      viewButton.textContent = view === 'overhead' ? 'Entrance Low View V' : view === 'low' ? 'Enter My First-person View V' : 'Return to Pool Overhead V'
    }
    const setView = () => {
      if (view === 'overhead') {
        camera.position.set(0, 16.8, 0.01)
        camera.lookAt(0, 0, 0)
      } else if (view === 'low') {
        camera.position.set(0, 1.65, 6.25)
        camera.lookAt(0, 0.85, -1.8)
      } else updateFirstPerson()
      // The pool camera sits on the route itself, closer than personal follow.
      // A wider lens keeps the artwork and the surrounding data tide together.
      const fov = view === 'first' ? 58 : 52
      if (camera.fov !== fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    }
    const toggleView = () => {
      view = view === 'overhead' ? 'low' : view === 'low' ? 'first' : 'overhead'
      setView()
      updateHUD()
    }
    const togglePlay = () => {
      if (elapsed >= REPLAY_DURATION) elapsed = 0
      else playing = !playing
      if (elapsed === 0) playing = true
      samplePool(elapsed)
      setView()
      updateHUD()
    }
    const restart = () => {
      elapsed = 0
      playing = true
      samplePool(0)
      setView()
      updateHUD()
    }
    const playButton = makeButton('Pause Space', togglePlay)
    makeButton('Restart R', restart)
    viewButton.addEventListener('click', () => { toggleView(); ctx.canvas.focus() }, { signal: ctx.signal })
    ctx.canvas.addEventListener('keydown', (event) => {
      if (event.repeat) return
      if (event.code === 'KeyV') toggleView()
      if (event.code === 'KeyR') restart()
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
    }, { signal: ctx.signal })
    const seek = (time) => {
      elapsed = THREE.MathUtils.clamp(time, 0, REPLAY_DURATION)
      samplePool(elapsed)
      setView()
      updateHUD()
    }
    const update = (dt) => {
      if (playing && elapsed < REPLAY_DURATION) {
        elapsed = Math.min(REPLAY_DURATION, elapsed + dt)
        if (elapsed >= REPLAY_DURATION - 1e-6) {
          elapsed = REPLAY_DURATION
          playing = false
        }
        samplePool(elapsed)
      }
      if (view === 'first') updateFirstPerson()
      updateHUD()
    }
    ctx.container.__publicPool = {
      seek,
      step: update,
      togglePlay,
      toggleView,
      restart,
      probeVisitor: (id, time) => {
        const visitor = visitors.find((item) => item.id === id)
        if (!visitor) return null
        const sample = sampleVisitorRoute(visitor, time, {})
        return {
          id,
          routeId: visitor.routeId,
          point: [sample.point.x, sample.point.z],
          standardTime: sample.standardTime,
          phase: sample.phase,
        }
      },
      getState: () => ({
        ...frame,
        elapsed: +frame.elapsed.toFixed(2),
        playing,
        view,
        visitorCount: visitors.length,
        routeId: 'ALL',
        routeCounts: { ...routeCounts },
        heatWeightB: NODE_HEAT.B,
        flowRecordCount: flowRecords.length,
        memoryRecordCount: memoryRecords.length,
        cameraPosition: camera.position.toArray().map((value) => +value.toFixed(3)),
        cameraTarget: view === 'first' ? firstPersonTarget.toArray().map((value) => +value.toFixed(3)) : null,
        cameraFov: camera.fov,
        focusTarget: view === 'first' ? focusTarget : null,
        personalPhase: view === 'first' ? routeSample.phase : null,
        personalKind: view === 'first' ? routeSample.kind : null,
      }),
    }
    samplePool(0)
    setView()
    updateHUD()
    ctx.canvas.focus()
    return {
      update,
      dispose() {
        hud.remove()
        delete ctx.container.__publicPool
      },
    }
  }

  return { createPlay, samplePool }
}
