const escape = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const lines = (value, limit) => {
  const result = []; let line = '';
  for (const word of String(value).split(/\s+/).flatMap(word => word.match(new RegExp('.{1,' + limit + '}', 'gu')) || [])) {
    if (line && (line + ' ' + word).length > limit) { result.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) result.push(line);
  return result;
};
const textBlock = (value, y, size, limit, attributes = '') => `<text x="561.5" y="${y}" text-anchor="middle" font-size="${size}" ${attributes}>${lines(value, limit).map((line, index) => `<tspan x="561.5" dy="${index ? size * 1.3 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
const formatDate = value => new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });

export function certificateSvg(certificate) {
  const nameSize = certificate.recipientName.length > 120 ? 24 : certificate.recipientName.length > 80 ? 28 : 40;
  const titleSize = certificate.title.length > 150 ? 22 : 27;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1123" height="794" viewBox="0 0 1123 794" role="img" aria-label="Certificate of participation">
  <rect width="1123" height="794" fill="#fff"/>
  <rect x="24" y="24" width="1075" height="746" fill="none" stroke="#163c2d" stroke-width="5"/>
  <rect x="36" y="36" width="1051" height="722" fill="none" stroke="#c6ab64" stroke-width="1"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#1f2937">
  <text x="561.5" y="103" text-anchor="middle" fill="#163c2d" font-size="22" letter-spacing="5" font-weight="700">SIELALUMNI</text>
  <text x="561.5" y="155" text-anchor="middle" font-size="39" font-family="Georgia, serif" fill="#163c2d">Certificate of Participation</text>
  <line x1="420" y1="180" x2="703" y2="180" stroke="#c6ab64" stroke-width="2"/>
  <text x="561.5" y="222" text-anchor="middle" font-size="17" fill="#64748b">This certificate is presented to</text>
  ${textBlock(certificate.recipientName, 280, nameSize, 60, 'font-family="Georgia, serif" font-weight="700"')}
  <text x="561.5" y="393" text-anchor="middle" font-size="17" fill="#64748b">for participating in the ${escape(certificate.activityType)}</text>
  ${textBlock(certificate.title, 440, titleSize, 80, 'font-weight="700"')}
  <text x="561.5" y="566" text-anchor="middle" font-size="17">Held on ${escape(formatDate(certificate.participationDate + 'T00:00:00+08:00'))}</text>
  ${textBlock('Organized by ' + certificate.organizer, 599, 16, 98)}
  <line x1="170" y1="670" x2="953" y2="670" stroke="#e2e8f0"/>
  <text x="170" y="697" font-size="12" fill="#64748b">Issued from confirmed participation | ${escape(formatDate(certificate.issuedAt))}</text>
  <text x="170" y="721" font-size="12" fill="#64748b">Certificate ID: ${escape(certificate.certificateNumber)}</text>
  </g></svg>`;
}
