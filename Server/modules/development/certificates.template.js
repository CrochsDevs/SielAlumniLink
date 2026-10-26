import { readFileSync } from 'node:fs';

// Embed the artwork supplied in Certificate of Appreciation.html so downloads
// and printed copies work without access to the application or its assets.
const artwork = readFileSync(new URL('./assets/certificate-appreciation.png', import.meta.url)).toString('base64');
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const lines = (value, limit) => {
  const result = []; let line = '';
  for (const word of String(value).split(/\s+/).flatMap(word => word.match(new RegExp('.{1,' + limit + '}', 'gu')) || [])) {
    if (line && (line + ' ' + word).length > limit) { result.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) result.push(line);
  return result;
};
const center = 722;
// Bound long lines to the available width, including names made of wide glyphs.
const textBlock = (value, y, size, limit, attributes = '') => `<text x="${center}" y="${y}" text-anchor="middle" font-size="${size}" ${attributes}>${lines(value, limit).map((line, index) => `<tspan x="${center}" dy="${index ? size * 1.25 : 0}"${Array.from(line).length * size > 700 ? ' textLength="700" lengthAdjust="spacingAndGlyphs"' : ''}>${escape(line)}</tspan>`).join('')}</text>`;
const formatDate = value => new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });

export function certificateSvg(certificate) {
  // Wrap even maximum accepted values and long unbroken words inside the
  // template's text area, leaving the supplied heading and signatory intact.
  const preferredNameSize = certificate.recipientName.length > 100 ? 16 : certificate.recipientName.length > 55 ? 23 : certificate.recipientName.length > 32 ? 29 : 38;
  const nameLimit = preferredNameSize === 16 ? 70 : preferredNameSize === 23 ? 52 : preferredNameSize === 29 ? 40 : 32;
  const nameLines = lines(certificate.recipientName, nameLimit).length;
  const nameSize = Math.min(preferredNameSize, 50 / (1.2 + (nameLines - 1) * 1.25));
  const nameY = 448 + nameSize * 0.35 - (nameLines - 1) * nameSize * 0.625;
  const titleLimit = certificate.title.length > 150 ? 80 : 65;
  const titleLines = lines(certificate.title, titleLimit).length;
  const organizerLines = lines('Organized by ' + certificate.organizer, 90).length;
  const lineHeight = Math.min(24, 124 / (titleLines + organizerLines + 2));
  const titleSize = Math.min(18, lineHeight / 1.25);
  const bodySize = Math.min(13, lineHeight / 1.25);
  const titleY = 499 + lineHeight;
  const organizerY = titleY + titleLines * lineHeight;
  const activityY = organizerY + organizerLines * lineHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1148" height="794" viewBox="0 0 1148 794" role="img" aria-labelledby="certificate-title certificate-description">
  <title id="certificate-title">Certificate of Appreciation</title>
  <desc id="certificate-description">Awarded to ${escape(certificate.recipientName)} for participation in ${escape(certificate.title)}. Organized by ${escape(certificate.organizer)}. Certificate ID: ${escape(certificate.certificateNumber)}.</desc>
  <defs>
    <image id="template-artwork" width="1148" height="794" xlink:href="data:image/png;base64,${artwork}"/>
    <clipPath id="static-artwork"><path d="M0 0H1148V794H0Z M350 420V635H1095V420Z" clip-rule="evenodd"/></clipPath>
    <clipPath id="personalized-details"><rect x="350" y="420" width="745" height="215"/></clipPath>
  </defs>
  <rect width="1148" height="794" fill="#fff"/>
  <use xlink:href="#template-artwork" clip-path="url(#static-artwork)"/>
  <!-- Reuse a blank portion of the supplied paper texture, excluding all sample
       recipient, event and date text rather than drawing over those details. -->
  <svg x="350" y="420" width="745" height="215" viewBox="350 632 745 65" preserveAspectRatio="none">
    <use xlink:href="#template-artwork"/>
  </svg>
  <g font-family="Arial, Helvetica, sans-serif" fill="#111" clip-path="url(#personalized-details)">
    <rect x="360" y="421" width="725" height="55" fill="#fff"/>
    ${textBlock(certificate.recipientName, nameY, nameSize, nameLimit)}
    <line x1="360" y1="477" x2="1085" y2="477" stroke="#aaa"/>
    <text x="${center}" y="499" text-anchor="middle" font-size="14">for their participation in the ${escape(certificate.activityType)}</text>
    ${textBlock(certificate.title, titleY, titleSize, titleLimit, 'font-weight="700" fill="#009b72"')}
    ${textBlock('Organized by ' + certificate.organizer, organizerY, bodySize, 90)}
    <text x="${center}" y="${activityY}" text-anchor="middle" font-size="${bodySize}">Held on ${escape(formatDate(certificate.participationDate + 'T00:00:00+08:00'))}</text>
    <text x="${center}" y="${Math.max(608, activityY + lineHeight)}" text-anchor="middle" font-size="${bodySize}" font-weight="700">Given on ${escape(formatDate(certificate.issuedAt))}.</text>
  </g>
  <text x="${center}" y="770" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#555">Certificate ID: ${escape(certificate.certificateNumber)} | Issued from confirmed participation</text>
  </svg>`;
}
