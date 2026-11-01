import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectRoot, 'src', 'data')
const SEED = 20261101
const DURATION = 50

const routes = [
  {
    id: 'R1', label: '主路线', visitorCount: 21,
    steps: [
      { node: 'A', travel: 3, dwell: 2 },
      { node: 'B', travel: 5, dwell: 6 },
      { node: 'C', travel: 5, dwell: 4 },
      { node: 'B', travel: 9, dwell: 2 },
      { node: 'D', travel: 8, dwell: 1.5 },
      { node: 'EXIT', travel: 4.5, dwell: 0 },
    ],
  },
  {
    id: 'R2', label: '缩短路线', visitorCount: 7,
    steps: [
      { node: 'A', travel: 3, dwell: 2 },
      { node: 'B', travel: 5, dwell: 6 },
      { node: 'D', travel: 20, dwell: 2 },
      { node: 'EXIT', travel: 6, dwell: 0 },
    ],
  },
  {
    id: 'R3', label: '顺序偏离', visitorCount: 5,
    steps: [
      { node: 'A', travel: 3, dwell: 2 },
      { node: 'C', travel: 9, dwell: 4 },
      { node: 'B', travel: 8, dwell: 6 },
      { node: 'D', travel: 8, dwell: 2 },
      { node: 'EXIT', travel: 6, dwell: 0 },
    ],
  },
  {
    id: 'R4', label: '不返回 B', visitorCount: 3,
    steps: [
      { node: 'A', travel: 3, dwell: 2 },
      { node: 'B', travel: 5, dwell: 6 },
      { node: 'C', travel: 8, dwell: 4 },
      { node: 'D', travel: 12, dwell: 2 },
      { node: 'EXIT', travel: 6, dwell: 0 },
    ],
  },
]

let randomState = SEED
const random = () => ((randomState = (randomState * 1664525 + 1013904223) >>> 0) / 4294967296)
const round = (value, digits = 3) => +value.toFixed(digits)
const between = ([min, max]) => min + random() * (max - min)
const provenance = 'visitor-simulated'

const visitors = []
let visitorIndex = 0
for (const route of routes) {
  for (let routeIndex = 0; routeIndex < route.visitorCount; routeIndex++) {
    visitorIndex++
    const id = `V${String(visitorIndex).padStart(3, '0')}`
    const entryDelay = round(random() * 6)
    const paceScale = round(between([0.85, 1.2]), 4)
    const dwellFactors = route.steps.map((step) => {
      if (step.node === 'EXIT') return 0
      const variation = step.node === 'B' ? [0.75, 1.5] : [0.7, 1.45]
      return between(variation)
    })
    const rawDuration = route.steps.reduce((total, step, index) => (
      total + step.travel / paceScale + step.dwell * dwellFactors[index]
    ), 0)
    const scheduleScale = Math.min(1, (DURATION - entryDelay) / rawDuration)
    const visits = []
    const traversedEdges = []
    const visitNumbers = { A: 0, B: 0, C: 0, D: 0 }
    let cursor = entryDelay
    let previousNode = 'START'
    let exitTime = null

    route.steps.forEach((step, index) => {
      cursor += step.travel / paceScale * scheduleScale
      const arrival = cursor
      traversedEdges.push(`${previousNode}>${step.node}`)
      if (step.node === 'EXIT') {
        exitTime = arrival
        return
      }
      const dwellSeconds = step.dwell * dwellFactors[index] * scheduleScale
      const departure = arrival + dwellSeconds
      visitNumbers[step.node]++
      visits.push({
        node: step.node,
        visitIndex: visitNumbers[step.node],
        arrival: round(arrival),
        departure: round(departure),
        dwellSeconds: round(dwellSeconds),
      })
      previousNode = step.node
      cursor = departure
    })

    visitors.push({
      id,
      dataProvenance: provenance,
      routeId: route.id,
      entryDelay,
      exitTime: round(exitTime),
      paceScale,
      scheduleScale: round(scheduleScale, 5),
      randomSeed: Math.floor(random() * 4294967295),
      body: {
        dataProvenance: provenance,
        restingHr: round(between([51, 68]), 2),
        spo2: round(between([92.3, 96]), 2),
        stress: round(between([48, 75]), 2),
        restingHrAmplitude: round(between([0.4, 2.4]), 2),
        spo2Amplitude: round(between([0.1, 0.6]), 2),
        stressAmplitude: round(between([1.5, 6]), 2),
        wavePhase: round(random() * Math.PI * 2, 5),
      },
      visits,
      traversedEdges,
    })
  }
}

const routeCounts = routes.map((route) => ({
  routeId: route.id,
  label: route.label,
  visitorCount: visitors.filter((visitor) => visitor.routeId === route.id).length,
  share: round(visitors.filter((visitor) => visitor.routeId === route.id).length / visitors.length, 4),
}))
const majority = routeCounts.toSorted((a, b) => b.visitorCount - a.visitorCount)[0]

const edgeMap = new Map()
for (const visitor of visitors) {
  for (const edgeId of new Set(visitor.traversedEdges)) {
    if (!edgeMap.has(edgeId)) {
      const [from, to] = edgeId.split('>')
      edgeMap.set(edgeId, { edgeId, from, to, visitorIds: [] })
    }
    edgeMap.get(edgeId).visitorIds.push(visitor.id)
  }
}
const edges = [...edgeMap.values()].map((edge) => ({
  edgeId: edge.edgeId,
  from: edge.from,
  to: edge.to,
  visitorCount: edge.visitorIds.length,
  share: round(edge.visitorIds.length / visitors.length, 4),
  visitorIds: edge.visitorIds,
})).sort((a, b) => b.visitorCount - a.visitorCount || a.edgeId.localeCompare(b.edgeId))

const nodes = ['A', 'B', 'C', 'D'].map((node) => {
  const visits = visitors.flatMap((visitor) => visitor.visits
    .filter((visit) => visit.node === node)
    .map((visit) => ({ ...visit, visitorId: visitor.id })))
  const totalDwellSeconds = visits.reduce((sum, visit) => sum + visit.dwellSeconds, 0)
  return {
    node,
    visitCount: visits.length,
    uniqueVisitors: new Set(visits.map((visit) => visit.visitorId)).size,
    totalDwellSeconds: round(totalDwellSeconds),
    averageDwellPerVisit: round(totalDwellSeconds / visits.length),
    averageDwellPerVisitor: round(totalDwellSeconds / new Set(visits.map((visit) => visit.visitorId)).size),
  }
}).sort((a, b) => b.totalDwellSeconds - a.totalDwellSeconds)
const maxDwell = nodes[0].totalDwellSeconds
nodes.forEach((node, index) => {
  node.heatRank = index + 1
  node.heatWeight = round(node.totalDwellSeconds / maxDwell, 4)
})

const metadata = {
  schemaVersion: 1,
  generatedBy: 'scripts/generate-pool-data.mjs',
  seed: SEED,
  durationSeconds: DURATION,
  visitorCount: visitors.length,
  dataProvenance: provenance,
  routeProvenance: 'route-simulated',
  aggregateProvenance: 'aggregate-simulated',
  note: 'All visitors, body parameters, routes and dwell schedules are simulated for concept demonstration; no new human data was collected.',
}

await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, 'pool-routes.json'), JSON.stringify({ metadata, routes }, null, 2) + '\n')
await writeFile(path.join(outputDir, 'pool-visitors.json'), JSON.stringify({ metadata, visitors }, null, 2) + '\n')
await writeFile(path.join(outputDir, 'pool-aggregate.json'), JSON.stringify({
  metadata,
  routeCounts,
  majorityRoute: {
    routeId: majority.routeId,
    visitorCount: majority.visitorCount,
    share: majority.share,
    absoluteMajority: majority.visitorCount > visitors.length / 2,
  },
  minorityVisitorCount: visitors.length - majority.visitorCount,
  edges,
  nodes,
  bodyRanges: Object.fromEntries(['restingHr', 'spo2', 'stress'].map((key) => [key, {
    min: Math.min(...visitors.map((visitor) => visitor.body[key])),
    max: Math.max(...visitors.map((visitor) => visitor.body[key])),
  }])),
}, null, 2) + '\n')

console.log(JSON.stringify({
  visitors: visitors.length,
  routeCounts,
  majorityRoute: majority,
  minorityVisitorCount: visitors.length - majority.visitorCount,
  dwellRanking: nodes,
  latestExit: Math.max(...visitors.map((visitor) => visitor.exitTime)),
}, null, 2))
