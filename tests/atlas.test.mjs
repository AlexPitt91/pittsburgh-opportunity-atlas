import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { metrics, colors, missing, mapColor, difference, exportCsv } from '../dist/model.mjs';

const atlas = JSON.parse(readFileSync(new URL('../dist/atlas.json', import.meta.url)));

test('all 90 boundaries link to 65 unique reporting areas or explicit missing coverage', () => {
  const ids = new Set(atlas.areas.map(area => area.id));
  assert.equal(ids.size, 65);
  assert.equal(new Set(atlas.shapes.map(shape => shape.name)).size, 90);
  assert.deepEqual(atlas.shapes.filter(shape => !shape.area).map(shape => shape.name).sort(), ['Chateau', 'South Shore']);
  for (const shape of atlas.shapes) {
    assert.match(shape.path, /^M[-\d.,LMZ]+Z$/);
    if (shape.area) assert.ok(ids.has(shape.area));
  }
  for (const area of atlas.areas) {
    assert.deepEqual(atlas.shapes.filter(shape => shape.area === area.id).map(shape => shape.name).sort(), [...area.names].sort());
  }
});

test('snapshot values are percentages and representative report rows match', () => {
  for (const values of [atlas.city, ...atlas.areas.map(area => area.values)]) {
    assert.deepEqual(Object.keys(values), Object.keys(metrics));
    for (const pair of Object.values(values)) {
      assert.equal(pair.length, 2);
      assert.ok(pair.every(value => Number.isFinite(value) && value >= 0 && value <= 100));
    }
  }
  assert.deepEqual(atlas.city.poverty, [22.8, 20.1]);
  assert.deepEqual(atlas.areas.find(area => area.id === 'Hazelwood').values.transit, [12.7, 18.5]);
});

test('color bins handle missing values, zero and inclusive upper limit', () => {
  assert.equal(mapColor(null), missing);
  assert.equal(mapColor(0), colors[0]);
  assert.equal(mapColor(19.9), colors[0]);
  assert.equal(mapColor(20), colors[1]);
  assert.equal(mapColor(100), colors[4]);
});

test('differences and exports preserve reporting area granularity', () => {
  assert.equal(difference(20.1, 22.8), -2.7);
  const rows = exportCsv(atlas, 'transit').trim().split('\r\n');
  assert.equal(rows.length, 67);
  assert.ok(rows.includes('"Hazelwood / Glen Hazel / New Homestead / Hays","Commute by public transit","12.7","18.5","5.8"'));
});
