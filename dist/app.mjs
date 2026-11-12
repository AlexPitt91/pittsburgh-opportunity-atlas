import { metrics, bands, colors, missing, mapColor, difference, exportCsv } from './model.mjs';

const byId = id => document.getElementById(id);
const svg = byId('map');
const primary = byId('area');
const compare = byId('compare');
const metric = byId('metric');

function viewBox(shapes) {
  const points = shapes.flatMap(shape => [...shape.path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)]);
  const xs = points.map(point => Number(point[1]));
  const ys = points.map(point => Number(point[2]));
  const left = xs.reduce((a,b) => Math.min(a,b));
  const top = ys.reduce((a,b) => Math.min(a,b));
  return [left - 12, top - 12, xs.reduce((a,b) => Math.max(a,b)) - left + 24,
    ys.reduce((a,b) => Math.max(a,b)) - top + 24].join(' ');
}

async function start() {
  const response = await fetch('./atlas.json');
  if (!response.ok) throw new Error('Could not load the data');
  const data = await response.json();
  const areas = new Map(data.areas.map(area => [area.id, area]));
  const sorted = [...areas.values()].sort((a,b) => a.id.localeCompare(b.id));
  for (const select of [primary, compare]) {
    if (select === compare) select.add(new Option('None', ''));
    for (const area of sorted) select.add(new Option(area.names.join(' / '), area.id));
  }
  for (const [id, definition] of Object.entries(metrics)) metric.add(new Option(definition.label, id));
  const shapes = data.shapes.map(shape => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shape.path);
    path.setAttribute('fill-rule', 'evenodd');
    if (shape.area) {
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      const select = () => { primary.value = shape.area; render(); };
      path.addEventListener('click', select);
      path.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
    }
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    path.append(title);
    svg.append(path);
    return { ...shape, path, title };
  });
  svg.setAttribute('viewBox', viewBox(data.shapes));
  function render() {
    const key = metric.value;
    byId('map-title').textContent = metrics[key].label;
    for (const shape of shapes) {
      const value = areas.get(shape.area)?.values[key][1];
      const label = shape.name + (value == null ? ' · No published profile' : ' · ' + value.toFixed(1) + '%');
      shape.title.textContent = label;
      shape.path.setAttribute('aria-label', label);
      shape.path.setAttribute('fill', mapColor(value));
      shape.path.classList.toggle('primary', shape.area === primary.value);
      shape.path.classList.toggle('secondary', shape.area === compare.value && shape.area !== primary.value);
      if (shape.area) shape.path.setAttribute('aria-pressed', String(shape.area === primary.value));
    }
    const chosen = areas.get(primary.value);
    const other = areas.get(compare.value);
    const panels = [[chosen.names.join(' / '), chosen.values, 'primary']];
    if (other && chosen !== other) panels.push([other.names.join(' / '), other.values, 'compare']);
    panels.push(['City of Pittsburgh', data.city, 'city']);
    const container = byId('insights');
    const denominator = document.createElement('p');
    denominator.textContent = metrics[key].denominator;
    container.replaceChildren(denominator);
    for (const [name, values, type] of panels) {
      const [baseline, current] = values[key];
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.type = type;
      row.innerHTML = '<div class="row-head"><strong></strong><strong></strong></div><div class="bar" aria-hidden="true"><span></span></div><p></p>';
      const [title, number] = row.querySelectorAll('strong');
      title.textContent = name;
      number.textContent = current.toFixed(1) + '%';
      row.querySelector('span').style.width = current + '%';
      const delta = difference(current, baseline);
      row.querySelector('p').textContent = (delta > 0 ? '+' : '') + delta.toFixed(1) +
        ' percentage points from ' + baseline.toFixed(1) + '% in 2010–2014';
      container.append(row);
    }
  }
  for (const [index, label] of [...bands.map(([lo,hi]) => lo + '–' + (hi === 100 ? '100%' : '<' + hi + '%')), 'No profile'].entries()) {
    const item = document.createElement('span');
    item.className = 'key';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = colors[index] ?? missing;
    item.append(swatch, label);
    byId('legend').append(item);
  }
  function reset() { primary.value = 'Hazelwood'; compare.value = 'Central Oakland'; metric.value = 'poverty'; render(); }
  for (const select of [primary, compare, metric]) select.addEventListener('change', render);
  byId('reset').addEventListener('click', reset);
  byId('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportCsv(data, metric.value)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pittsburgh-' + metric.value + '.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  reset();
  byId('atlas').hidden = false;
  byId('status').hidden = true;
}

start().catch(error => {
  byId('status').textContent = 'The atlas data could not load. Refresh the page to try again.';
  console.error(error);
});
