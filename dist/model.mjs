export const metrics = {
  poverty: { label: 'Below poverty threshold', denominator: 'Residents with poverty status determined' },
  transit: { label: 'Commute by public transit', denominator: 'Workers age 16 and older' },
  renters: { label: 'Renter-occupied housing', denominator: 'Occupied housing units' },
  education: { label: 'Bachelor’s degree or higher', denominator: 'Residents age 25 and older' },
};
export const colors = ['#dff0da','#aad4b4','#68ad92','#337e70','#15564f'];
export const missing = '#c9cecc';
export const bands = [[0,20],[20,40],[40,60],[60,80],[80,100]];
export function mapColor(value) {
  return value == null ? missing : colors[Math.min(4, Math.floor(value / 20))];
}
export function difference(current, baseline) {
  return Math.round((current - baseline) * 10) / 10;
}
export function exportCsv(atlas, metric) {
  const escape = value => '"' + String(value).replaceAll('"', '""') + '"';
  const rows = [['Reporting area', 'Indicator', '2010–2014 (%)', '2020–2024 (%)', 'Change (percentage points)']];
  for (const area of [{ names: ['City of Pittsburgh'], values: atlas.city }, ...atlas.areas]) {
    const [older, current] = area.values[metric];
    rows.push([area.names.join(' / '), metrics[metric].label, older, current, difference(current, older)]);
  }
  return rows.map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}
