import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { metricUV } from './kit/textures.js'
import { createWalk, collidersFrom } from './kit/walk.js'
import { framingReport } from './kit/edit3d.js'
import { enableToneMapping } from './env/tonemap.js'
import { BODY_DATA_WINDOW, BODY_MAPPING_RULES, sampleBodyData } from './body-data.js'
import { REPLAY_DURATION, sampleRoute } from './replay-route.js'
import { sampleReplayFocus } from './replay-focus.js'
import { createPoolSystem } from './pool-scene.js'

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
}

function pixelText(text, material, pixel = 0.08) {
  const group = new THREE.Group()
  group.name = `Sign ${text}`
  const letters = [...text].map((letter) => GLYPHS[letter]).filter(Boolean)
  const count = letters.reduce((sum, glyph) => sum + glyph.join('').replaceAll('0', '').length, 0)
  const geometry = new THREE.BoxGeometry(pixel * 0.82, pixel * 0.82, 0.012)
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  const matrix = new THREE.Matrix4()
  const width = (letters.length * 6 - 1) * pixel
  let index = 0
  letters.forEach((glyph, letterIndex) => {
    glyph.forEach((row, y) => {
      ;[...row].forEach((cell, x) => {
        if (cell !== '1') return
        matrix.makeTranslation(
          (letterIndex * 6 + x) * pixel - width / 2,
          (3 - y) * pixel,
          0,
        )
        mesh.setMatrixAt(index++, matrix)
      })
    })
  })
  mesh.instanceMatrix.needsUpdate = true
  group.add(mesh)
  return group
}

function environmentTexture() {
  const width = 64
  const height = 32
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const vertical = y / (height - 1)
      const warmPanel = Math.max(0, 1 - Math.abs(x / width - 0.32) * 9) * Math.max(0, 1 - Math.abs(vertical - 0.28) * 8)
      const value = 38 + vertical * 70 + warmPanel * 95
      const i = (y * width + x) * 4
      data[i] = value * 1.03
      data[i + 1] = value
      data[i + 2] = value * 0.93
      data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, width, height)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function createGalleryScene({ asset, mode = 'tour' }) {
  enableToneMapping({ curve: 'aces' })

  const scene = new THREE.Scene()
  scene.name = 'Public Pool · Abstract Gallery'
  scene.background = new THREE.Color(0x060807)
  scene.fog = new THREE.Fog(0x060807, 20, 46)
  scene.environment = environmentTexture()
  scene.environmentIntensity = 0.12

  const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 120)
  camera.name = 'Gallery Main Camera'
  camera.position.set(0, 1.65, 6)
  camera.lookAt(0, 1.05, -2)
  scene.add(camera)

  const gallery = new THREE.Group()
  gallery.name = 'Gallery Architecture & Fixtures'
  scene.add(gallery)

  // Explicitly flat white materials keep the architecture and works quiet;
  // roughness and the four local spotlights provide form without visual noise.
  const floorMaterial = new THREE.MeshStandardMaterial({
    name: 'Gallery Floor · Neutral White Matte',
    color: 0xbdbdb8,
    roughness: 0.94,
    metalness: 0,
  })
  const wallMaterial = new THREE.MeshStandardMaterial({
    name: 'Gallery Walls · Warm White Matte',
    color: 0xd8d8d2,
    roughness: 0.96,
    metalness: 0,
  })
  const plinthMaterial = new THREE.MeshStandardMaterial({
    name: 'Exhibit Plinths · Warm White Stone',
    color: 0xe2e0da,
    roughness: 0.76,
    metalness: 0,
  })
  const greenMaterial = new THREE.MeshStandardMaterial({
    name: 'Spatial Markers · White Matte',
    color: 0xd8d8d2,
    roughness: 0.62,
    metalness: 0,
  })
  const darkGreenMaterial = new THREE.MeshStandardMaterial({
    name: 'Artwork Body · White Satin',
    color: 0xe6e4de,
    roughness: 0.42,
    metalness: 0,
  })
  const amberMaterial = new THREE.MeshStandardMaterial({
    name: 'Artwork & Exit · Warm White Matte',
    color: 0xe2e0da,
    roughness: 0.58,
    metalness: 0,
  })
  const routeMaterial = new THREE.MeshStandardMaterial({
    name: 'Simulated Gallery Route · White Guide',
    color: 0xd8d8d2,
    roughness: 0.72,
    metalness: 0,
  })
  const labelMaterial = new THREE.MeshStandardMaterial({
    name: 'Spatial Signs · Non-emissive White',
    color: 0xe6e4de,
    roughness: 0.82,
    metalness: 0,
  })
  const frameMaterial = new THREE.MeshStandardMaterial({
    name: 'Door Frames & Fixtures · White Matte',
    color: 0xc8c8c2,
    roughness: 0.68,
    metalness: 0,
  })
  const stripMaterial = new THREE.MeshStandardMaterial({
    name: 'Track Lights · Non-emissive White Housing',
    color: 0xe2e0da,
    roughness: 0.62,
    metalness: 0,
  })

  function box(name, size, position, material, rounded = false) {
    const geometry = rounded
      ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(0.06, ...size.map((v) => v * 0.12)))
      : new THREE.BoxGeometry(...size)
    metricUV(geometry, rounded ? 1 : 2)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const floor = box('Floor', [18, 0.18, 14], [0, -0.09, 0], floorMaterial)
  floor.castShadow = false
  gallery.add(floor)

  const walls = []
  function wall(name, size, position) {
    const mesh = box(name, size, position, wallMaterial)
    walls.push(mesh)
    gallery.add(mesh)
    return mesh
  }
  wall('West Wall', [0.25, 3.6, 14.25], [-9.125, 1.8, 0])
  wall('East Wall', [0.25, 3.6, 14.25], [9.125, 1.8, 0])
  for (const z of [-7.125, 7.125]) {
    const side = z > 0 ? 'Entrance' : 'Exit'
    wall(`${side} Left Wall`, [7.75, 3.6, 0.25], [-5.125, 1.8, z])
    wall(`${side} Right Wall`, [7.75, 3.6, 0.25], [5.125, 1.8, z])
    gallery.add(box(`${side} Lintel`, [2.75, 0.42, 0.32], [0, 3.39, z], frameMaterial))
    for (const x of [-1.39, 1.39]) {
      gallery.add(box(`${side} Door Frame`, [0.12, 3.2, 0.34], [x, 1.6, z], frameMaterial))
    }
  }

  const columns = []
  for (const x of [-7.4, 7.4]) {
    for (const z of [-4.9, 4.9]) {
      const column = box('Structural Column', [0.34, 3.6, 0.34], [x, 1.8, z], frameMaterial)
      columns.push(column)
      gallery.add(column)
    }
  }

  const entryLabel = pixelText('ENTRANCE', labelMaterial, 0.075)
  entryLabel.position.set(0, 2.85, 6.96)
  entryLabel.rotation.y = Math.PI
  gallery.add(entryLabel)
  const exitLabel = pixelText('EXIT', amberMaterial, 0.12)
  exitLabel.position.set(0, 2.55, -6.96)
  gallery.add(exitLabel)

  for (const [text, z] of [['IN', 6.15], ['OUT', -6.15]]) {
    const label = pixelText(text, text === 'OUT' ? amberMaterial : labelMaterial, 0.085)
    label.position.set(0, 0.025, z)
    label.rotation.x = -Math.PI / 2
    gallery.add(label)
  }

  const nodes = [
    { id: 'A', position: [-4.8, 0, 2.8] },
    { id: 'B', position: [0, 0, 1] },
    { id: 'C', position: [4.8, 0, -2] },
    { id: 'D', position: [-2.8, 0, -4.2] },
  ]
  const nodeGroups = new Map()
  const exhibitColliders = []

  for (const node of nodes) {
    const group = new THREE.Group()
    group.name = `Artwork Node ${node.id}`
    group.position.set(...node.position)
    const plinth = box(`Node ${node.id} Plinth`, [1.6, 0.18, 1.6], [0, 0.09, 0], plinthMaterial, true)
    group.add(plinth)
    exhibitColliders.push(plinth)

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.87, 0.91, 64), routeMaterial)
    ring.name = `Node ${node.id} Floor Ring`
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.014
    group.add(ring)

    const label = pixelText(node.id, labelMaterial, 0.085)
    label.position.set(0, 0.025, 1.18)
    label.rotation.x = -Math.PI / 2
    group.add(label)
    gallery.add(group)
    nodeGroups.set(node.id, group)
  }

  const a = nodeGroups.get('A')
  ;[-0.46, 0, 0.46].forEach((x, i) => {
    const slab = box(`Artwork A Slice ${i + 1}`, [0.18, 1.25 + i * 0.24, 0.86], [x, 0.83 + i * 0.12, 0], i === 1 ? amberMaterial : darkGreenMaterial, true)
    slab.rotation.y = -0.18 + i * 0.18
    a.add(slab)
    exhibitColliders.push(slab)
  })

  const b = nodeGroups.get('B')
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.095, 18, 72), amberMaterial)
  torus.name = 'Artwork B Ring'
  torus.position.y = 1.03
  torus.castShadow = true
  b.add(torus)
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 2), darkGreenMaterial)
  core.name = 'Artwork B Core'
  core.position.y = 1.03
  core.castShadow = true
  b.add(core)
  exhibitColliders.push(torus)

  const c = nodeGroups.get('C')
  ;[-0.43, 0, 0.43].forEach((x, i) => {
    const height = [0.9, 1.65, 1.25][i]
    const pillar = box(`Artwork C Pillar ${i + 1}`, [0.25, height, 0.58], [x, 0.18 + height / 2, 0], i === 1 ? amberMaterial : darkGreenMaterial, true)
    c.add(pillar)
    exhibitColliders.push(pillar)
  })

  const d = nodeGroups.get('D')
  for (let i = 0; i < 5; i++) {
    const layer = box(`Artwork D Layer ${i + 1}`, [1.25 - i * 0.09, 0.12, 0.88], [0, 0.32 + i * 0.2, 0], i === 3 ? amberMaterial : plinthMaterial, true)
    layer.rotation.y = (i - 2) * 0.12
    d.add(layer)
    exhibitColliders.push(layer)
  }

  // The guide is sampled from the same smooth absolute-time route used by Play.
  // It stays deliberately quiet so the emitted particles become the main trace.
  const routePoints = []
  const guideSample = {}
  for (let i = 0; i <= 500; i++) {
    sampleRoute(REPLAY_DURATION * i / 500, guideSample)
    routePoints.push(guideSample.point.clone().setY(0.042))
  }
  const routeCurve = new THREE.CurvePath()
  for (let i = 0; i < routePoints.length - 1; i++) {
    routeCurve.add(new THREE.LineCurve3(routePoints[i], routePoints[i + 1]))
  }
  const routeGuideMaterial = routeMaterial.clone()
  routeGuideMaterial.name = 'Simulated Route · Low-intensity Guide'
  routeGuideMaterial.transparent = true
  routeGuideMaterial.opacity = 0.06
  routeGuideMaterial.depthWrite = false
  const route = new THREE.Mesh(new THREE.TubeGeometry(routeCurve, 500, 0.022, 6, false), routeGuideMaterial)
  route.name = 'Simulated Route · Entrance to Exit'
  route.receiveShadow = true
  gallery.add(route)

  const track = box('Central Lighting Track', [0.07, 0.07, 12.4], [0, 3.38, 0], frameMaterial)
  gallery.add(track)
  for (const node of nodes) {
    const lamp = box(`Node ${node.id} Light Fixture`, [0.28, 0.08, 0.28], [node.position[0], 3.3, node.position[2]], stripMaterial, true)
    gallery.add(lamp)
    const spot = new THREE.SpotLight(0xffffff, 7, 7, Math.PI / 6, 0.75, 1.5)
    spot.name = `Node ${node.id} Soft Spotlight`
    spot.position.set(node.position[0], 3.25, node.position[2])
    spot.target.position.set(node.position[0], 0.5, node.position[2])
    gallery.add(spot, spot.target)
  }

  const hemisphere = new THREE.HemisphereLight(0xcfd4d2, 0x111312, 0.22)
  hemisphere.name = 'Low-intensity Gallery Ambient'
  scene.add(hemisphere)

  asset.register('gallery', gallery, { name: 'Abstract Gallery', type: 'building' })
  asset.register('floor', floor, { name: 'Gallery Floor', parent: 'gallery' })
  walls.forEach((item, index) => asset.register(`wall_${index + 1}`, item, { name: item.name, parent: 'gallery' }))
  nodeGroups.forEach((group, id) => asset.register(`node_${id}`, group, { name: `Artwork Node ${id}`, parent: 'gallery' }))
  asset.register('simulated_route', route, { name: 'Simulated Gallery Route', parent: 'gallery' })
  asset.register('camera_main', camera, { name: 'Gallery Main Camera' })
  asset.register('light_ambient', hemisphere, { name: 'Low-intensity Gallery Ambient' })

  const particleDuration = REPLAY_DURATION
  const particleColor = new THREE.Color()
  const routeSample = {}
  const bodySample = {}
  const FLOW_SLOTS = 60 * REPLAY_DURATION
  const MEMORY_SLOTS = BODY_MAPPING_RULES.memoryEmissionRate * REPLAY_DURATION
  const HISTORY_STEPS = 42
  const HISTORY_STEP = 0.085
  const HISTORY_DURATION = HISTORY_STEPS * HISTORY_STEP
  let particleBody = null
  let particleSingle = null
  let particleEmission = null
  let particleEmissionGeometry = null
  let particleGlow = null
  let particleTrail = null
  let particleTrailGeometry = null
  let particleMemory = null
  let particleMemoryGeometry = null
  let streamRecords = []
  let flowRecords = []
  let memoryRecords = []

  function buildStreamRecords() {
    let seed = 917
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const records = []
    const emitter = {}
    const colorFor = (data, lightness) => {
      const hue = data.hue + (random() - 0.5) * 8
      const color = new THREE.Color().setHSL(hue / 360, 0.62, lightness)
      return { hue, lightness, color: [color.r, color.g, color.b] }
    }

    for (let i = 0; i < FLOW_SLOTS; i++) {
      const birth = (i + 0.5) / 60
      const data = sampleBodyData(birth)
      if (random() > data.emissionRate / 60) continue
      sampleRoute(birth, emitter)
      if (emitter.kind === 'end') continue
      const orbit = emitter.kind === 'dwell'
      const sideX = -emitter.tangent.z
      const sideZ = emitter.tangent.x
      const lateral = (random() - 0.5) * data.spread
      const speed = data.flowSpeed * (0.7 + random() * 0.6)
      records.push({
        type: 1,
        orbit,
        birth,
        life: data.particleLife * (0.85 + random() * 0.3),
        x: emitter.point.x,
        y: 0.28 + random() * 1.2,
        z: emitter.point.z,
        vx: emitter.tangent.x * speed + sideX * lateral,
        vy: (random() - 0.5) * 0.025,
        vz: emitter.tangent.z * speed + sideZ * lateral,
        radius: 0.18 + random() * 0.82,
        phase: random() * Math.PI * 2,
        angular: (0.5 + data.stressNorm * 0.85) * (random() > 0.5 ? 1 : -1),
        spread: data.spread,
        alpha: 0.5 + random() * 0.38,
        ...colorFor(data, 0.66),
      })
    }

    for (let i = 0; i < MEMORY_SLOTS; i++) {
      const birth = (i + 0.5) / BODY_MAPPING_RULES.memoryEmissionRate
      sampleRoute(birth, emitter)
      if (emitter.kind === 'end') continue
      const data = sampleBodyData(birth)
      const orbit = emitter.kind === 'dwell'
      const sideX = -emitter.tangent.z
      const sideZ = emitter.tangent.x
      const lateral = (random() - 0.5) * (orbit ? data.spread * 1.5 : 0.24)
      records.push({
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
        radius: 0.16 + random() * 0.72,
        phase: random() * Math.PI * 2,
        angular: (0.42 + data.stressNorm * 0.72) * (random() > 0.5 ? 1 : -1),
        spread: Math.max(0.075, data.spread * 0.82),
        alpha: 0.48 + data.memoryAlpha * 0.62 + random() * 0.1,
        ...colorFor(data, 0.64),
      })
    }
    return records
  }

  function createLineGeometry(records) {
    const vertexCapacity = records.length * HISTORY_STEPS * 2
    const geometry = new THREE.BufferGeometry()
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

  function createParticleBody() {
    const size = 32
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1
      const dy = (y + 0.5) / size * 2 - 1
      const alpha = THREE.MathUtils.clamp(1 - Math.hypot(dx, dy), 0, 1)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.pow(alpha, 0.65) * 255
    }
    const disc = new THREE.DataTexture(data, size, size)
    disc.needsUpdate = true
    const material = new THREE.PointsMaterial({
      name: 'Moving Core · Simulated Monthly Stress Hue',
      color: particleColor,
      size: 0.05,
      sizeAttenuation: true,
      map: disc,
      transparent: true,
      opacity: 0.84,
      alphaTest: 0.02,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    })

    particleBody = new THREE.Group()
    particleBody.name = 'Personal Moving Core · Monthly Data Simulation'
    const singleMaterial = material.clone()
    singleMaterial.name = 'Single-point Core · Simulated Monthly Stress Hue'
    singleMaterial.size = 0.12
    singleMaterial.opacity = 0.95
    const singleGeometry = new THREE.BufferGeometry()
    singleGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.88, 0], 3))
    particleSingle = new THREE.Points(singleGeometry, singleMaterial)
    particleSingle.name = 'Single-point Position Anchor'
    particleSingle.frustumCulled = false
    particleBody.add(particleSingle)

    particleGlow = new THREE.PointLight(particleColor, 0.8, 3, 2)
    particleGlow.position.y = 0.9
    particleBody.add(particleGlow)
    scene.add(particleBody)

    streamRecords = buildStreamRecords()
    flowRecords = streamRecords.filter((record) => record.type === 1)
    memoryRecords = streamRecords.filter((record) => record.type === 2)

    particleEmissionGeometry = new THREE.BufferGeometry()
    particleEmissionGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(streamRecords.length * 3), 3).setUsage(THREE.DynamicDrawUsage))
    particleEmissionGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(streamRecords.length * 3), 3).setUsage(THREE.DynamicDrawUsage))
    particleEmissionGeometry.setDrawRange(0, 0)
    const emissionMaterial = singleMaterial.clone()
    emissionMaterial.name = 'Emitted Particles · Birth, Lifetime & Stress Hue'
    emissionMaterial.color.set(0xffffff)
    emissionMaterial.vertexColors = true
    emissionMaterial.size = 0.06
    emissionMaterial.opacity = 0.82
    emissionMaterial.blending = THREE.AdditiveBlending
    particleEmission = new THREE.Points(particleEmissionGeometry, emissionMaterial)
    particleEmission.name = 'Single-core Emission · Monthly Simulation'
    particleEmission.frustumCulled = false
    particleEmission.renderOrder = 4
    scene.add(particleEmission)

    particleTrailGeometry = createLineGeometry(flowRecords)
    particleTrail = new THREE.LineSegments(
      particleTrailGeometry,
      createLineMaterial('Flow Traces · Birth, Lifetime & Stress Hue'),
    )
    particleTrail.name = 'Continuous Flow Traces · Monthly Simulation'
    particleTrail.frustumCulled = false
    particleTrail.renderOrder = 3
    scene.add(particleTrail)

    particleMemoryGeometry = createLineGeometry(memoryRecords)
    particleMemory = new THREE.LineSegments(
      particleMemoryGeometry,
      createLineMaterial('Path Memory · Monthly SpO2 Brightness & Stress Hue'),
    )
    particleMemory.name = 'Persistent Path Traces · Monthly Simulation'
    particleMemory.frustumCulled = false
    particleMemory.renderOrder = 2
    scene.add(particleMemory)
  }

  // A deterministic local curl field. Each stroke joins only adjacent samples
  // from the same particle, so seeking reconstructs identical continuous lines.
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
        + (Math.sin(t * 2.1 + phase * 1.7) - Math.sin(phase * 1.7)) * record.spread * 0.38
      z = record.z + record.vz * t
        + (Math.cos(record.x * 1.45 + phase * 0.72 + t * 0.78) - Math.cos(record.x * 1.45 + phase * 0.72)) * curl
        + (Math.cos(t * 1.83 + phase * 1.25) - Math.cos(phase * 1.25)) * record.spread * 0.32
    }
    const verticalAmplitude = record.type === 2 ? 0.075 : 0.11
    out[offset] = x
    out[offset + 1] = Math.max(0.055, record.y + record.vy * t
      + (Math.sin(phase + t * 1.15) - Math.sin(phase)) * verticalAmplitude)
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
        const floor = persistent ? 0.32 : 0.06
        alphas[vertex] = record.alpha * fadeIn * fadeOut * (floor + (1 - floor) * recentA)
        alphas[vertex + 1] = record.alpha * fadeIn * fadeOut * (floor + (1 - floor) * recentB)
        segments++
      }
    }
    geometry.setDrawRange(0, segments * 2)
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
    return { alive, segments }
  }

  function writeEmissionPoints(records, elapsed, persistent, start, currentHue) {
    const positions = particleEmissionGeometry.attributes.position.array
    const colors = particleEmissionGeometry.attributes.color.array
    const color = new THREE.Color()
    let count = start
    for (const record of records) {
      const age = elapsed - record.birth
      if (age < 0 || age >= record.life) continue
      const fadeIn = THREE.MathUtils.smoothstep(age, 0, 0.2)
      const fadeOut = persistent ? 1 : 1 - THREE.MathUtils.smoothstep(age / record.life, 0.62, 1)
      const brightness = fadeIn * fadeOut * (persistent ? 0.34 : 0.92)
      const transition = persistent
        ? THREE.MathUtils.smoothstep(age / 24, 0, 1) * 0.72
        : THREE.MathUtils.smoothstep(age / record.life, 0, 1) * 0.9
      const hueDelta = ((currentHue - record.hue + 540) % 360) - 180
      const ageShift = persistent
        ? THREE.MathUtils.smoothstep(age / 36, 0, 1) * 36
        : THREE.MathUtils.smoothstep(age / record.life, 0, 1) * 54
      const hue = record.hue + hueDelta * transition + ageShift
      color.setHSL(hue / 360, 0.62, record.lightness)
      writeStreamPosition(record, age, positions, count * 3)
      colors[count * 3] = color.r * brightness
      colors[count * 3 + 1] = color.g * brightness
      colors[count * 3 + 2] = color.b * brightness
      count++
    }
    return count
  }

  function sampleParticles(time) {
    if (!particleBody) return
    sampleRoute(time, routeSample)
    const data = sampleBodyData(time, bodySample)
    const { elapsed, progress, point, tangent, heading, dwellWeight } = routeSample
    particleBody.position.copy(point)
    particleBody.rotation.y = Math.atan2(heading.x, heading.z)
    particleColor.setHSL(data.hue / 360, 0.5, 0.66)
    particleSingle.material.color.copy(particleColor)
    particleGlow.color.copy(particleColor)

    const flow = writeLineHistory(flowRecords, particleTrailGeometry, elapsed, false)
    const memory = writeLineHistory(memoryRecords, particleMemoryGeometry, elapsed, true)
    particleTrail.visible = flow.segments > 0
    particleMemory.visible = memory.segments > 0
    let emissionPoints = writeEmissionPoints(flowRecords, elapsed, false, 0, data.hue)
    emissionPoints = writeEmissionPoints(memoryRecords, elapsed, true, emissionPoints, data.hue)
    particleEmissionGeometry.setDrawRange(0, emissionPoints)
    particleEmissionGeometry.attributes.position.needsUpdate = true
    particleEmissionGeometry.attributes.color.needsUpdate = true
    particleEmission.visible = emissionPoints > 0

    Object.assign(particleBody.userData, {
      elapsed,
      progress,
      tangent: tangent.toArray(),
      heading: heading.toArray(),
      routeSpeed: routeSample.speed,
      phase: routeSample.phase,
      kind: routeSample.kind,
      segmentIndex: routeSample.segmentIndex,
      dwellWeight,
      bodyDataDate: data.date,
      bodyDataWindow: `${BODY_DATA_WINDOW.start}—${BODY_DATA_WINDOW.end}`,
      activeParticles: flow.alive + memory.alive + 1,
      memoryParticles: memory.alive,
      emissionPoints,
      flowLineSegments: flow.segments,
      memoryLineSegments: memory.segments,
      streamCapacity: streamRecords.length,
      historySteps: HISTORY_STEPS,
      historyDuration: HISTORY_DURATION,
      restingHr: data.restingHr,
      spo2: data.spo2,
      stress: data.stress,
      emissionRate: data.emissionRate,
      particleLife: data.particleLife,
    })
  }

  if (mode !== 'walk' && mode !== 'pool') {
    createParticleBody()
    sampleParticles(0)
    asset.register('particle_body', particleBody, { name: 'Personal Moving Core (Monthly Data Simulation)' })
    asset.register('particle_emission', particleEmission, { name: 'Single-core Emission (Monthly Simulation)' })
    asset.register('particle_trail', particleTrail, { name: 'Continuous Flow Traces (Monthly Simulation)' })
    asset.register('particle_memory', particleMemory, { name: 'Path Trace Memory (Monthly Simulation)' })
  }

  if (mode === 'tour') {
    const shots = [
      {
        id: 'entrance', name: 'Entrance Establishing', duration: 10,
        keyframes: [
          { time: 0, position: [0, 1.65, 6], lookAt: [0, 1.05, -2] },
          { time: 10, position: [0, 1.65, 3.8], lookAt: [0, 1.05, -2] },
        ],
      },
      {
        id: 'approach', name: 'Approaching the Artworks', duration: 14,
        keyframes: [
          { time: 0, position: [-3, 1.65, 3.8], lookAt: [-4.8, 1, 2.8] },
          { time: 7, position: [0, 2, 3.4], lookAt: [0, 1.05, 1] },
          { time: 14, position: [3.8, 1.65, -0.5], lookAt: [4.8, 1, -2] },
        ],
      },
      {
        id: 'overview', name: 'Spatial Overview', duration: 12,
        keyframes: [
          { time: 0, position: [8, 10, 8], lookAt: [0, 0, 0] },
          { time: 12, position: [-7, 11, 5], lookAt: [0, 0, 0] },
        ],
      },
      {
        id: 'detail', name: 'Artwork Details', duration: 14,
        keyframes: [
          { time: 0, position: [-1, 2.2, -2.4], lookAt: [-2.8, 0.8, -4.2] },
          { time: 14, position: [-4, 1.8, -3.2], lookAt: [-2.8, 0.8, -4.2] },
        ],
      },
    ]
    for (const shot of shots) asset.registerShot(shot.id, { camera: 'camera_main', ...shot })
    asset.registerTrack('shots', { clips: shots.map((shot) => ({ shotId: shot.id })) })
    asset.registerAnimation('personal_particle_route', {
      name: 'Personal Particle Route (Simulated)',
      objectId: 'particle_body',
      duration: particleDuration,
      sample: sampleParticles,
    })
  }

  const pool = mode === 'pool' ? createPoolSystem({ scene, camera, asset }) : null
  scene.userData.framing = framingReport(scene, gallery)

  const result = {
    scene,
    camera,
    dispose() {
      const geometries = new Set()
      const materials = new Set()
      const textures = new Set()
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry)
        for (const material of [object.material].flat()) {
          if (!material) continue
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      scene.environment?.dispose()
    },
  }

  if (mode === 'pool') result.play = (ctx) => pool.createPlay(ctx)

  if (mode === 'walk') {
    result.play = (ctx) => {
      scene.updateMatrixWorld(true)
      const walk = createWalk(ctx, camera, {
        colliders: collidersFrom([...walls, ...columns, ...exhibitColliders], 0.04),
        ground: [floor],
        eye: 1.65,
        speed: 2.35,
        spots: [{ label: 'Return to Entrance', position: [0, 0, 6], yaw: 0, pitch: -0.04 }],
        hint: 'WASD / Arrow Keys to Move · Drag to Look · V for Overhead · F to Fly',
      })

      const hud = document.createElement('div')
      hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:13px system-ui,sans-serif;color:#e6e0d4'
      const title = document.createElement('div')
      title.textContent = 'Public Pool / Spatial Prototype 01'
      title.style.cssText = 'position:absolute;left:18px;top:18px;padding:10px 13px;background:rgba(12,20,16,.76);border-left:2px solid #79c7a3;letter-spacing:.08em'
      const note = document.createElement('div')
      note.textContent = 'Simulated Route · No Body Data Connected'
      note.style.cssText = 'position:absolute;left:18px;top:58px;padding:7px 13px;background:rgba(12,20,16,.62);color:#aebbb3;font-size:12px'
      const viewButton = document.createElement('button')
      viewButton.style.cssText = 'position:absolute;right:18px;top:18px;pointer-events:auto;padding:10px 14px;border:1px solid rgba(121,199,163,.65);border-radius:3px;background:rgba(12,20,16,.82);color:#e6e0d4;cursor:pointer;font:inherit'
      hud.append(title, note, viewButton)
      ctx.container.append(hud)

      let overhead = false
      const savedPosition = new THREE.Vector3()
      const savedQuaternion = new THREE.Quaternion()
      const syncButton = () => { viewButton.textContent = overhead ? 'Return to Low View V' : 'Switch to Overhead V' }
      const toggleView = () => {
        if (!overhead) {
          savedPosition.copy(camera.position)
          savedQuaternion.copy(camera.quaternion)
          camera.position.set(0, 16.8, 0.01)
          camera.lookAt(0, 0, 0)
        } else {
          camera.position.copy(savedPosition)
          camera.quaternion.copy(savedQuaternion)
        }
        overhead = !overhead
        syncButton()
      }
      syncButton()
      ctx.canvas.addEventListener('keydown', (event) => {
        if (event.code === 'KeyV' && !event.repeat) toggleView()
      }, { signal: ctx.signal })
      viewButton.addEventListener('click', () => { toggleView(); ctx.canvas.focus() }, { signal: ctx.signal })
      ctx.container.__publicPool = { toggleView, getView: () => overhead ? 'overhead' : 'low', walk }

      return {
        update(dt) { if (!overhead) walk.update(dt) },
        dispose() {
          walk.dispose()
          hud.remove()
          delete ctx.container.__publicPool
        },
      }
    }
  }

  if (mode === 'replay') {
    result.play = (ctx) => {
      let elapsed = 0
      let playing = true
      let overhead = false
      const desired = new THREE.Vector3()
      const lookAt = new THREE.Vector3()
      const cameraTarget = new THREE.Vector3()
      const followTangent = new THREE.Vector3()
      const formatTime = (value) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`

      const hud = document.createElement('div')
      hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:13px system-ui,sans-serif;color:#e6e0d4'
      const title = document.createElement('div')
      title.textContent = 'Personal Replay'
      title.style.cssText = 'position:absolute;left:18px;top:18px;padding:10px 13px;background:rgba(12,20,16,.78);border-left:2px solid #79c7a3;letter-spacing:.06em'
      const note = document.createElement('div')
      note.textContent = 'Real Daily Summaries (Past Month) · Continuous Values & Route Simulated'
      note.style.cssText = 'position:absolute;left:18px;top:58px;padding:7px 13px;background:rgba(12,20,16,.64);color:#aebbb3;font-size:12px'
      const metrics = document.createElement('div')
      metrics.style.cssText = 'position:absolute;left:18px;top:92px;padding:7px 13px;background:rgba(12,20,16,.58);color:#c7d8d0;font-size:11px'
      const status = document.createElement('div')
      status.style.cssText = 'position:absolute;left:18px;bottom:24px;padding:8px 11px;background:rgba(12,20,16,.72);min-width:250px'
      const progressTrack = document.createElement('div')
      progressTrack.style.cssText = 'position:absolute;left:18px;bottom:18px;width:270px;height:2px;background:rgba(230,224,212,.2)'
      const progressFill = document.createElement('div')
      progressFill.style.cssText = 'width:0;height:100%;background:#79c7a3'
      progressTrack.append(progressFill)
      const controlsBar = document.createElement('div')
      controlsBar.style.cssText = 'position:absolute;right:18px;bottom:18px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end'
      const viewButton = document.createElement('button')
      viewButton.style.cssText = 'position:absolute;right:18px;top:18px;pointer-events:auto;padding:10px 14px;border:1px solid rgba(121,199,163,.65);border-radius:3px;background:rgba(12,20,16,.82);color:#e6e0d4;cursor:pointer;font:inherit'
      hud.append(title, note, metrics, status, progressTrack, controlsBar, viewButton)
      ctx.container.append(hud)

      const buttonStyle = 'pointer-events:auto;padding:9px 12px;border:1px solid rgba(230,224,212,.24);border-radius:3px;background:rgba(12,20,16,.82);color:#e6e0d4;cursor:pointer;font:inherit'
      const makeButton = (label, handler) => {
        const button = document.createElement('button')
        button.textContent = label
        button.style.cssText = buttonStyle
        button.addEventListener('click', () => { handler(); ctx.canvas.focus() }, { signal: ctx.signal })
        controlsBar.append(button)
        return button
      }

      const constrainCameraVector = (vector) => {
        vector.x = THREE.MathUtils.clamp(vector.x, -8.7, 8.7)
        vector.z = THREE.MathUtils.clamp(vector.z, -6.7, 6.7)
        for (const node of nodes) {
          const dx = vector.x - node.position[0]
          const dz = vector.z - node.position[2]
          const distance = Math.hypot(dx, dz)
          const padding = 1.18
          if (distance >= padding) continue
          // Radial clearance avoids the diagonal jump caused by switching
          // between the nearest sides of a square collision box.
          const nx = distance > 1e-6 ? dx / distance : 1
          const nz = distance > 1e-6 ? dz / distance : 0
          vector.x = node.position[0] + nx * padding
          vector.z = node.position[2] + nz * padding
        }
      }
      let focusTarget = 'A'
      const sampleFocus = (time, out) => {
        focusTarget = sampleReplayFocus(time, out)
        return out
      }
      const updateFollow = (immediate = false, dt = 1 / 60) => {
        followTangent.fromArray(particleBody.userData.heading ?? particleBody.userData.tangent ?? [0, 0, -1])
        const dwell = particleBody.userData.dwellWeight ?? 0
        const nearestExhibit = Math.min(...nodes.map((node) => Math.hypot(
          particleBody.position.x - node.position[0],
          particleBody.position.z - node.position[2],
        )))
        const proximity = 1 - THREE.MathUtils.smoothstep(nearestExhibit, 1.2, 5)
        const baseDistance = THREE.MathUtils.lerp(2.6, 2.15, dwell)
        const followDistance = baseDistance * THREE.MathUtils.lerp(1, 0.62, proximity)
        desired.copy(particleBody.position).addScaledVector(followTangent, -followDistance)
        constrainCameraVector(desired)
        desired.y = 1.54
        sampleFocus(elapsed, lookAt)
        if (immediate) {
          camera.position.copy(desired)
          cameraTarget.copy(lookAt)
        } else {
          camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2))
          constrainCameraVector(camera.position)
          cameraTarget.lerp(lookAt, 1 - Math.exp(-dt * 6))
        }
        if (camera.fov !== 48) {
          camera.fov = 48
          camera.updateProjectionMatrix()
        }
        camera.lookAt(cameraTarget)
      }
      const updateHUD = () => {
        const routePhase = elapsed >= particleDuration ? 'Exited' : particleBody.userData.phase
        const phase = !playing && elapsed < particleDuration ? `${routePhase} · Paused` : routePhase
        status.textContent = `${formatTime(elapsed)} / ${formatTime(particleDuration)} · ${phase}`
        metrics.textContent = `Resting HR ${particleBody.userData.restingHr.toFixed(1)} · SpO2 ${particleBody.userData.spo2.toFixed(1)} · Stress ${particleBody.userData.stress.toFixed(1)} · Active Particles ${particleBody.userData.activeParticles}`
        progressFill.style.width = `${(elapsed / particleDuration) * 100}%`
        playButton.textContent = playing ? 'Pause Space' : 'Resume Space'
        viewButton.textContent = overhead ? 'Return to Follow View V' : 'Switch to Overhead V'
      }
      const togglePlay = () => {
        if (elapsed >= particleDuration) {
          elapsed = 0
          playing = true
        } else playing = !playing
        sampleParticles(elapsed)
        if (!overhead) updateFollow(true)
        updateHUD()
      }
      const restart = () => {
        elapsed = 0
        playing = true
        sampleParticles(elapsed)
        if (!overhead) updateFollow(true)
        updateHUD()
      }
      const toggleView = () => {
        overhead = !overhead
        if (overhead) {
          camera.position.set(0, 16.8, 0.01)
          camera.lookAt(0, 0, 0)
        } else updateFollow(true)
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
        elapsed = THREE.MathUtils.clamp(time, 0, particleDuration)
        sampleParticles(elapsed)
        if (!overhead) updateFollow(true)
        updateHUD()
      }
      const update = (dt) => {
        if (playing && elapsed < particleDuration) {
          elapsed = Math.min(particleDuration, elapsed + dt)
          if (elapsed >= particleDuration - 1e-6) {
            elapsed = particleDuration
            playing = false
          }
          sampleParticles(elapsed)
        }
        if (!overhead) updateFollow(false, dt)
        updateHUD()
      }
      ctx.container.__publicPool = {
        toggleView,
        togglePlay,
        restart,
        seek,
        step: update,
        getView: () => overhead ? 'overhead' : 'follow',
        getEmissionColors: (start = 0, count = 8) => Array.from(particleEmissionGeometry.attributes.color.array.slice(start * 3, (start + count) * 3)),
        getState: () => ({
          elapsed: +elapsed.toFixed(2),
          playing,
          coreMode: 'single',
          view: overhead ? 'overhead' : 'follow',
          phase: particleBody.userData.phase,
          kind: particleBody.userData.kind,
          segmentIndex: particleBody.userData.segmentIndex,
          dwellWeight: +(particleBody.userData.dwellWeight ?? 0).toFixed(3),
          routeSpeed: +(particleBody.userData.routeSpeed ?? 0).toFixed(3),
          heading: (particleBody.userData.heading ?? [0, 0, -1]).map((value) => +value.toFixed(4)),
          bodyPosition: particleBody.position.toArray().map((value) => +value.toFixed(3)),
          cameraPosition: camera.position.toArray().map((value) => +value.toFixed(3)),
          cameraTarget: cameraTarget.toArray().map((value) => +value.toFixed(3)),
          focusTarget,
          cameraFov: camera.fov,
          cameraDistance: +camera.position.distanceTo(particleBody.position).toFixed(3),
          particleCount: particleBody.userData.activeParticles,
          memoryParticles: particleBody.userData.memoryParticles,
          emissionPoints: particleBody.userData.emissionPoints,
          emissionVisible: particleEmission.visible,
          flowLineSegments: particleBody.userData.flowLineSegments,
          memoryLineSegments: particleBody.userData.memoryLineSegments,
          historySteps: particleBody.userData.historySteps,
          historyDuration: particleBody.userData.historyDuration,
          streamCapacity: particleBody.userData.streamCapacity,
          restingHr: +particleBody.userData.restingHr.toFixed(3),
          spo2: +particleBody.userData.spo2.toFixed(3),
          stress: +particleBody.userData.stress.toFixed(3),
          emissionRate: +particleBody.userData.emissionRate.toFixed(3),
          particleLife: +particleBody.userData.particleLife.toFixed(3),
          bodyDataDate: particleBody.userData.bodyDataDate,
          bodyDataWindow: particleBody.userData.bodyDataWindow,
        }),
      }
      sampleParticles(0)
      updateFollow(true)
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
  }

  return result
}
