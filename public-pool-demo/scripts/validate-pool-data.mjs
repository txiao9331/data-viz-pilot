import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readJson = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'))
const [{ visitors }, { routes }, aggregate] = await Promise.all([
  readJson('pool-visitors.json'),
  readJson('pool-routes.json'),
  readJson('pool-aggregate.json'),
])
const close = (a, b, tolerance = 0.003) => Math.abs(a - b) <= tolerance

assert.equal(visitors.length, 36)
assert.equal(new Set(visitors.map((visitor) => visitor.id)).size, 36)
assert.equal(routes.reduce((sum, route) => sum + route.visitorCount, 0), 36)

for (const visitor of visitors) {
  assert.equal(visitor.dataProvenance, 'visitor-simulated')
  assert.equal(visitor.body.dataProvenance, 'visitor-simulated')
  assert.ok(visitor.entryDelay >= 0 && visitor.entryDelay <= 6)
  assert.ok(visitor.exitTime <= 50 && visitor.exitTime > visitor.entryDelay)
  const route = routes.find((item) => item.id === visitor.routeId)
  assert.ok(route, `${visitor.id}: missing route`)
  assert.deepEqual(visitor.visits.map((visit) => visit.node), route.steps.slice(0, -1).map((step) => step.node))
  let previousDeparture = visitor.entryDelay
  for (const visit of visitor.visits) {
    assert.ok(visit.arrival >= previousDeparture, `${visitor.id}: non-monotonic schedule`)
    assert.ok(visit.departure > visit.arrival, `${visitor.id}: invalid dwell`)
    assert.ok(close(visit.departure - visit.arrival, visit.dwellSeconds), `${visitor.id}: dwell mismatch`)
    previousDeparture = visit.departure
  }
  assert.ok(visitor.exitTime >= previousDeparture)
}

const routeCounts = Object.fromEntries(routes.map((route) => [
  route.id,
  visitors.filter((visitor) => visitor.routeId === route.id).length,
]))
assert.equal(routeCounts.R1, 21)
assert.equal(routeCounts.R2, 7)
assert.equal(routeCounts.R3, 5)
assert.equal(routeCounts.R4, 3)
assert.equal(aggregate.majorityRoute.routeId, 'R1')
assert.equal(aggregate.majorityRoute.visitorCount, 21)
assert.equal(aggregate.majorityRoute.absoluteMajority, true)
assert.equal(aggregate.minorityVisitorCount, 15)

const expectedEdges = new Map()
for (const visitor of visitors) {
  for (const edgeId of new Set(visitor.traversedEdges)) {
    expectedEdges.set(edgeId, (expectedEdges.get(edgeId) ?? 0) + 1)
  }
}
assert.equal(aggregate.edges.length, expectedEdges.size)
for (const edge of aggregate.edges) {
  assert.equal(edge.visitorCount, expectedEdges.get(edge.edgeId), `${edge.edgeId}: edge count mismatch`)
  assert.equal(edge.visitorIds.length, edge.visitorCount)
}

for (const node of aggregate.nodes) {
  const visits = visitors.flatMap((visitor) => visitor.visits
    .filter((visit) => visit.node === node.node)
    .map((visit) => ({ ...visit, visitorId: visitor.id })))
  const total = visits.reduce((sum, visit) => sum + visit.dwellSeconds, 0)
  assert.equal(node.visitCount, visits.length)
  assert.equal(node.uniqueVisitors, new Set(visits.map((visit) => visit.visitorId)).size)
  assert.ok(close(node.totalDwellSeconds, total, 0.01), `${node.node}: dwell total mismatch`)
}
assert.equal(aggregate.nodes[0].node, 'B')
assert.equal(aggregate.nodes[0].heatRank, 1)
assert.equal(aggregate.nodes[0].heatWeight, 1)

console.log(JSON.stringify({
  status: 'passed',
  visitors: visitors.length,
  routeCounts,
  majorityShare: aggregate.majorityRoute.share,
  minorityVisitorCount: aggregate.minorityVisitorCount,
  dwellRanking: aggregate.nodes.map((node) => `${node.node}:${node.totalDwellSeconds}s`),
  edgeCount: aggregate.edges.length,
  checks: [
    'anonymous simulated provenance',
    'route membership and totals',
    'monotonic schedules within 50 seconds',
    'unique-person edge counts',
    'node dwell totals and heat ranking',
  ],
}, null, 2))
