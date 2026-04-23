/**
 * generateProposalHtml — motor Chromium-native (idêntico ao preview)
 *
 * Layout em camadas fixas, sem frame único.
 * Todas as medidas em mm para fidelidade editorial.
 */

import { richContentToHtml, type ProposalTemplateData, type TemplateSection } from '@/components/docs/ProposalTemplate';

const OLIVE = '#4a5c28';
const BLACK = '#111111';
const DGRAY = '#2a2a2a';
const PAGE_W = 210;
const PAGE_H = 297;
const SECS_PER_PAGE = 2;

function esc(s: string | undefined | null): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topRightDecor(): string {
  return `
    <svg class="decor decor-top-right" width="356" height="64" viewBox="0 0 356 64" aria-hidden="true">
      <polygon points="356,0 224,0 256,24 356,24" fill="${BLACK}"></polygon>
      <polygon points="356,24 316,24 356,56" fill="${BLACK}"></polygon>
    </svg>
  `;
}

function leftMidDecor(): string {
  return `
    <svg class="decor decor-left-mid" width="62" height="112" viewBox="0 0 62 112" aria-hidden="true">
      <polygon points="0,112 62,78 62,112 0,112" fill="${BLACK}"></polygon>
      <polygon points="0,80 44,56 44,74 0,90" fill="${DGRAY}"></polygon>
      <polygon points="0,52 28,36 28,48 0,60" fill="${OLIVE}"></polygon>
    </svg>
  `;
}

function bottomDecor(): string {
  return `
    <svg class="decor decor-bottom-left" width="196" height="34" viewBox="0 0 196 34" aria-hidden="true">
      <rect x="0" y="0" width="196" height="4" fill="${OLIVE}"></rect>
      <polygon points="0,34 72,34 48,16 0,16" fill="${BLACK}"></polygon>
      <polygon points="72,34 118,34 90,16 48,16" fill="${DGRAY}"></polygon>
    </svg>
    <svg class="decor decor-bottom-right" width="210" height="34" viewBox="0 0 210 34" aria-hidden="true">
      <rect x="0" y="0" width="210" height="4" fill="${BLACK}"></rect>
      <polygon points="210,34 126,34 150,16 210,16" fill="${BLACK}"></polygon>
      <polygon points="150,34 108,34 126,16 168,16" fill="${DGRAY}"></polygon>
      <polygon points="108,34 78,34 98,16 126,16" fill="${OLIVE}"></polygon>
    </svg>
  `;
}

function headerLines(): string {
  return `
    <svg width="170" height="42" viewBox="0 0 170 42" aria-hidden="true">
      <circle cx="12" cy="14" r="9" fill="${BLACK}"></circle>
      <line x1="24" y1="14" x2="170" y2="14" stroke="${BLACK}" stroke-width="4.2"></line>
      <circle cx="51" cy="25" r="4" fill="${BLACK}"></circle>
      <line x1="59" y1="25" x2="170" y2="25" stroke="${BLACK}" stroke-width="2.8"></line>
      <line x1="71" y1="34" x2="170" y2="34" stroke="${BLACK}" stroke-width="2.8"></line>
    </svg>
  `;
}

function renderPage(pageSections: TemplateSection[], vars: ProposalTemplateData['vars'], pageIdx: number): string {
  const logo = vars.logoUrl
    ? `<img src="${esc(vars.logoUrl)}" alt="Logo" style="max-height:16mm;max-width:60mm;object-fit:contain;display:block;">`
    : `<p class="logo-fallback">[MINHA LOGO]</p>`;

  const titleBlock = pageIdx === 0 ? `
    <div class="title-block">
      <p class="doc-type">${esc(vars.docType || 'PROPOSTA DE SERVIÇOS')}</p>
      <p class="doc-client">CLIENTE: ${esc((vars.clientName ?? '').toUpperCase())}</p>
    </div>
  ` : '';

  const sectionsHtml = pageSections.map((s, i) => `
    <div class="section" style="margin-top:${pageIdx === 0 && i === 0 ? '12mm' : '8mm'};">
      <p class="st">${s.number ? `${esc(s.number)} ` : ''}${esc(s.title.toUpperCase())}</p>
      <div class="sc">${richContentToHtml(s.content, vars)}</div>
    </div>
  `).join('');

  const phone2 = vars.phone2
    ? `<p>${esc(vars.phone2)}</p>`
    : '';

  return `
    <div class="page">
      ${topRightDecor()}
      ${leftMidDecor()}

      <div class="ph">
        <table class="header-grid">
          <tbody>
            <tr>
              <td class="header-left">
                <p class="date-line">Data: ${esc(vars.date)}</p>
                ${logo}
              </td>
              <td class="header-right">
                ${headerLines()}
              </td>
            </tr>
          </tbody>
        </table>
        ${titleBlock}
      </div>

      <div class="pc ${pageIdx === 0 ? 'first-page' : ''}">
        ${sectionsHtml}
        ${pageSections.length === 0 ? '<p class="empty-state">Adicione seções no painel esquerdo</p>' : ''}
      </div>

      <div class="footer">
        <table class="footer-grid">
          <tbody>
            <tr>
              <td class="footer-col">
                <p>${esc(vars.phone1 || '+55 47 99705-3732')}</p>
                ${phone2}
              </td>
              <td class="footer-col">
                <p>${esc(vars.website || 'CromiaComunicação.com')}</p>
                <p>${esc(vars.email || 'contato@cromiacomunicacao.com')}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      ${bottomDecor()}
    </div>
  `;
}

const PAGE_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    font-family: 'Inter', system-ui, -apple-system, Arial, sans-serif;
    letter-spacing: -0.2px;
    background: #e0e0e0;
  }

  .page {
    position: relative;
    width: ${PAGE_W}mm;
    height: ${PAGE_H}mm;
    background: #ffffff;
    overflow: hidden;
    margin: 0 auto 8mm;
    box-shadow: none;
  }

  .decor {
    position: absolute;
    display: block;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  .decor-top-right { top: 0; right: 0; }
  .decor-left-mid { left: 0; top: 53%; transform: translateY(-50%); }
  .decor-bottom-left { bottom: 0; left: 0; }
  .decor-bottom-right { bottom: 0; right: 0; }

  .ph {
    position: relative;
    z-index: 1;
    padding: 14mm 18mm 0;
  }

  .header-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .header-left {
    vertical-align: top;
    width: 55%;
  }

  .header-right {
    vertical-align: top;
    padding-top: 6mm;
    text-align: right;
  }

  .date-line {
    margin: 0 0 2.5mm;
    color: ${OLIVE};
    font-size: 3.2mm;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .logo-fallback {
    margin: 0;
    font-size: 11mm;
    font-weight: 900;
    color: ${OLIVE};
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .title-block {
    margin-top: 7mm;
  }

  .doc-type,
  .doc-client {
    margin: 0;
    font-size: 7.5mm;
    font-weight: 900;
    color: ${BLACK};
    letter-spacing: -0.03em;
    line-height: 1.15;
    text-transform: uppercase;
  }

  .pc {
    position: relative;
    z-index: 1;
    padding-left: 18mm;
    padding-right: 18mm;
    padding-bottom: 30mm;
  }

  .first-page {
    padding-top: 0;
  }

  .section {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .st {
    font-size: 4.7mm;
    font-weight: 900;
    color: #111111;
    letter-spacing: 0.02em;
    margin-bottom: 2.5mm;
    line-height: 1.2;
  }

  .sc {
    font-size: 3.6mm;
    line-height: 1.8;
    color: #1a1a1a;
    text-align: left;
    letter-spacing: -0.1px;
  }
  .sc p { margin: 0 0 2.4mm; }
  .sc ul { margin: 0 0 2.4mm; padding-left: 5mm; list-style: disc; }
  .sc ol { margin: 0 0 2.4mm; padding-left: 5mm; }
  .sc li { margin-bottom: 1mm; }
  .sc strong { font-weight: 700; }
  .sc em { font-style: italic; }
  .sc u { text-decoration: underline; }
  .sc h1 { font-size: 5mm; font-weight: 900; margin: 0 0 2mm; }
  .sc h2 { font-size: 4.2mm; font-weight: 800; margin: 0 0 1.5mm; }
  .sc h3 { font-size: 3.8mm; font-weight: 700; margin: 0 0 1mm; }
  .sc hr { border: none; border-top: 0.3mm solid #ddd; margin: 3mm 0; }

  .footer {
    position: absolute;
    bottom: 7mm;
    left: 0;
    right: 0;
    z-index: 1;
  }

  .footer-grid {
    margin: 0 auto;
    border-collapse: collapse;
  }

  .footer-col {
    vertical-align: middle;
  }

  .footer-col:first-child {
    padding-right: 8mm;
  }

  .footer p {
    margin: 0;
    font-size: 3.1mm;
    line-height: 1.5;
    color: ${BLACK};
    white-space: nowrap;
  }

  .empty-state {
    margin-top: 14mm;
    color: #bbb;
    text-align: center;
    font-size: 3.5mm;
  }

  @media print {
    html, body { background: white; margin: 0; }
    .page {
      box-shadow: none;
      margin: 0;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }

  @page {
    size: A4 portrait;
    margin: 0;
  }
`;

export function generateProposalHtml(data: ProposalTemplateData, title = 'Proposta'): string {
  const { vars, sections } = data;

  const pages: TemplateSection[][] = [];
  for (let i = 0; i < sections.length; i += SECS_PER_PAGE) {
    pages.push(sections.slice(i, i + SECS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const pagesHtml = pages.map((p, idx) => renderPage(p, vars, idx)).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap" rel="stylesheet">
  <style>${PAGE_CSS}</style>
</head>
<body>
${pagesHtml}
<script>
  (function () {
    function allImagesReady() {
      return Array.from(document.images || []).every(function (img) {
        return img.complete;
      });
    }
    function doPrint() {
      window.focus();
      window.print();
    }
    function waitImagesThenPrint() {
      if (allImagesReady()) {
        setTimeout(doPrint, 250);
        return;
      }
      var pending = Array.from(document.images || []).filter(function (img) {
        return !img.complete;
      });
      if (!pending.length) {
        setTimeout(doPrint, 250);
        return;
      }
      var left = pending.length;
      pending.forEach(function (img) {
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
      });
      function onDone() {
        left -= 1;
        if (left <= 0) setTimeout(doPrint, 250);
      }
    }
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      waitImagesThenPrint();
    });
  })();
</script>
</body>
</html>`;
}
