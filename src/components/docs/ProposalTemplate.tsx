/**
 * ProposalTemplate — preview React fiel ao PNG de referência
 *
 * Medidas em pixels equivalentes a mm para a tela:
 *   1mm ≈ 3.78px @ 96dpi
 * Decorações todas em position:absolute com SVG puro.
 * Texto NOT justified (alinhado à esquerda, como no ref).
 */
import React, { forwardRef } from 'react';

const OLIVE  = '#4a5c28';
const BLACK  = '#111111';
const DGRAY  = '#2a2a2a';
const PAGE_W = 794;   // 210mm @ 96dpi
const PAGE_H = 1123;  // 297mm @ 96dpi
// 1mm = ~3.78px
const PH = 53;   // padding-top header  (14mm)
const PL = 68;   // padding-left/right  (18mm)
const SECS_PER_PAGE = 2;

export interface TemplateSection {
  id: string;
  number?: string;
  title: string;
  content: RichContentNode;
  meta?: {
    locked?: boolean;
    style?: string;
  };
}

export type RichContentMark = {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';
};

export type RichContentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichContentNode[];
  text?: string;
  marks?: RichContentMark[];
};

export type Block = {
  id: string;
  type: 'title' | 'text' | 'list' | 'image' | 'section';
  content: RichContentNode | string | string[] | null;
  meta?: {
    locked?: boolean;
    style?: string;
  };
};

export interface TemplateVars {
  date: string;
  clientName: string;
  docType: string;
  logoUrl?: string | null;
  phone1?: string;
  phone2?: string;
  website?: string;
  email?: string;
}

export interface ProposalTemplateData {
  vars: TemplateVars;
  sections: TemplateSection[];
}

function interpolate(text: string, v: TemplateVars): string {
  const map: Record<string, string> = {
    client_name: v.clientName ?? '', doc_type: v.docType ?? '',
    date: v.date ?? '', phone1: v.phone1 ?? '', phone2: v.phone2 ?? '',
    website: v.website ?? '', email: v.email ?? '',
    total_value: '', payment_schedule: '', start_date: '',
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
}

function esc(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textNode(text: string, marks: RichContentMark[] = []): RichContentNode {
  return { type: 'text', text, marks: marks.length > 0 ? marks : undefined };
}

function paragraphNode(...content: RichContentNode[]): RichContentNode {
  return { type: 'paragraph', content };
}

function headingNode(level: 1 | 2 | 3, ...content: RichContentNode[]): RichContentNode {
  return { type: 'heading', attrs: { level }, content };
}

function listItemNode(...content: RichContentNode[]): RichContentNode {
  return { type: 'listItem', content: [paragraphNode(...content)] };
}

function bulletListNode(...items: RichContentNode[][]): RichContentNode {
  return { type: 'bulletList', content: items.map((item) => listItemNode(...item)) };
}

function docNode(...content: RichContentNode[]): RichContentNode {
  return { type: 'doc', content };
}

export function htmlToRichContent(html: string): RichContentNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const nodes: RichContentNode[] = [];

  const parseInlineNodes = (parent: Element): RichContentNode[] => {
    const content: RichContentNode[] = [];
    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text.trim()) content.push({ type: 'text', text: text.replace(/\s+/g, ' ') });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        content.push({ type: 'hardBreak' });
        return;
      }
      const marks: RichContentMark[] = [];
      if (tag === 'strong' || tag === 'b') marks.push({ type: 'bold' });
      if (tag === 'em' || tag === 'i') marks.push({ type: 'italic' });
      if (tag === 'u') marks.push({ type: 'underline' });
      if (tag === 's' || tag === 'strike' || tag === 'del') marks.push({ type: 'strike' });
      if (tag === 'mark') marks.push({ type: 'highlight' });
      const children = parseInlineNodes(el);
      children.forEach((node) => {
        if (node.type === 'text') {
          node.marks = [...(node.marks ?? []), ...marks];
        }
        content.push(node);
      });
    });
    return content;
  };

  body.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) nodes.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'p') {
      nodes.push({ type: 'paragraph', content: parseInlineNodes(el) });
      return;
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const level = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3;
      nodes.push({ type: 'heading', attrs: { level }, content: parseInlineNodes(el) });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const listType = tag === 'ul' ? 'bulletList' : 'orderedList';
      const items: RichContentNode[] = [];
      el.querySelectorAll(':scope > li').forEach((li) => {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInlineNodes(li) }] });
      });
      nodes.push({ type: listType, content: items });
      return;
    }
    if (tag === 'hr') {
      nodes.push({ type: 'horizontalRule' });
      return;
    }
    nodes.push({ type: 'paragraph', content: parseInlineNodes(el) });
  });

  return { type: 'doc', content: nodes };
}

function renderInline(node: RichContentNode, v: TemplateVars): string {
  if (node.type === 'hardBreak') return '<br />';
  if (node.type !== 'text') return '';
  const text = interpolate(node.text ?? '', v);
  const marks = node.marks ?? [];
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold': return `<strong>${acc}</strong>`;
      case 'italic': return `<em>${acc}</em>`;
      case 'underline': return `<u>${acc}</u>`;
      case 'strike': return `<s>${acc}</s>`;
      case 'highlight': return `<mark>${acc}</mark>`;
      default: return acc;
    }
  }, esc(text));
}

export function richContentToHtml(node: RichContentNode | string | string[] | null | undefined, v: TemplateVars): string {
  if (!node) return '';
  if (typeof node === 'string') return interpolate(node, v);
  if (Array.isArray(node)) {
    return node.map((item) => `<li>${esc(interpolate(item, v))}</li>`).join('');
  }

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((child) => richContentToHtml(child, v)).join('');
    case 'paragraph':
      return `<p>${(node.content ?? []).map((child) => renderInline(child, v)).join('')}</p>`;
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const safe = Math.min(3, Math.max(1, level));
      return `<h${safe}>${(node.content ?? []).map((child) => renderInline(child, v)).join('')}</h${safe}>`;
    }
    case 'bulletList':
      return `<ul>${(node.content ?? []).map((child) => richContentToHtml(child, v)).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((child) => richContentToHtml(child, v)).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content ?? []).map((child) => richContentToHtml(child, v)).join('')}</li>`;
    case 'horizontalRule':
      return '<hr />';
    default:
      return '';
  }
}

function isRichContentNode(value: unknown): value is RichContentNode {
  return Boolean(value) && typeof value === 'object' && 'type' in (value as Record<string, unknown>);
}

export function normalizeSectionContent(
  section: Partial<TemplateSection> & { htmlContent?: string; content?: unknown },
): RichContentNode {
  if (isRichContentNode(section.content)) {
    return section.content;
  }
  if (section.htmlContent) return htmlToRichContent(section.htmlContent);
  return { type: 'doc', content: [] };
}

const TopRightDecor = () => (
  <svg
    style={{ position: 'absolute', top: 0, right: 0, display: 'block', zIndex: 0 }}
    width={356}
    height={64}
    viewBox="0 0 356 64"
  >
    <polygon points="356,0 224,0 256,24 356,24" fill={BLACK} />
    <polygon points="356,24 316,24 356,56" fill={BLACK} />
  </svg>
);

const LeftMidDecor = () => (
  <svg
    style={{ position: 'absolute', left: 0, top: '53%', transform: 'translateY(-50%)', display: 'block', zIndex: 0 }}
    width={62}
    height={112}
    viewBox="0 0 62 112"
  >
    <polygon points="0,112 62,78 62,112 0,112" fill={BLACK} />
    <polygon points="0,80 44,56 44,74 0,90" fill={DGRAY} />
    <polygon points="0,52 28,36 28,48 0,60" fill={OLIVE} />
  </svg>
);

const BottomDecor = () => (
  <>
    <svg
      style={{ position: 'absolute', bottom: 0, left: 0, display: 'block', zIndex: 0 }}
      width={196}
      height={34}
      viewBox="0 0 196 34"
    >
      <rect x={0} y={0} width={196} height={4} fill={OLIVE} />
      <polygon points="0,34 72,34 48,16 0,16" fill={BLACK} />
      <polygon points="72,34 118,34 90,16 48,16" fill={DGRAY} />
    </svg>
    <svg
      style={{ position: 'absolute', bottom: 0, right: 0, display: 'block', zIndex: 0 }}
      width={210}
      height={34}
      viewBox="0 0 210 34"
    >
      <rect x={0} y={0} width={210} height={4} fill={BLACK} />
      <polygon points="210,34 126,34 150,16 210,16" fill={BLACK} />
      <polygon points="150,34 108,34 126,16 168,16" fill={DGRAY} />
      <polygon points="108,34 78,34 98,16 126,16" fill={OLIVE} />
    </svg>
  </>
);

const HeaderLines = () => (
  <svg width={170} height={42} viewBox="0 0 170 42" style={{ display: 'block' }}>
    <circle cx={12} cy={14} r={9} fill={BLACK} />
    <line x1={24} y1={14} x2={170} y2={14} stroke={BLACK} strokeWidth={4.2} />
    <circle cx={51} cy={25} r={4} fill={BLACK} />
    <line x1={59} y1={25} x2={170} y2={25} stroke={BLACK} strokeWidth={2.8} />
    <line x1={71} y1={34} x2={170} y2={34} stroke={BLACK} strokeWidth={2.8} />
  </svg>
);

// ── CABEÇALHO ─────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{ vars: TemplateVars; showTitle: boolean }> = ({ vars, showTitle }) => (
  <div style={{ position: 'relative', zIndex: 1, padding: `${PH}px ${PL}px 0` }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'top', width: '55%' }}>
            <p style={{
              margin: '0 0 9px', color: OLIVE, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.02em', fontFamily: 'Inter, system-ui, Arial, sans-serif',
            }}>
              Data: {vars.date}
            </p>
            {vars.logoUrl ? (
              <img src={vars.logoUrl} alt="Logo"
                   style={{ maxHeight: 60, maxWidth: 220, objectFit: 'contain', display: 'block' }} />
            ) : (
              <p style={{
                margin: 0, fontSize: 42, fontWeight: 900, color: OLIVE,
                lineHeight: 1, letterSpacing: '-0.03em',
                fontFamily: 'Inter, system-ui, Arial, sans-serif',
              }}>
                [MINHA LOGO]
              </p>
            )}
          </td>
          <td style={{ verticalAlign: 'top', paddingTop: 24, textAlign: 'right' }}>
            <HeaderLines />
          </td>
        </tr>
      </tbody>
    </table>

    {showTitle && (
      <div style={{ marginTop: 26 }}>
        <p style={{
          margin: '0 0 2px', fontSize: 28, fontWeight: 900, color: BLACK,
          letterSpacing: '-0.03em', lineHeight: 1.15, textTransform: 'uppercase',
          fontFamily: 'Inter, system-ui, Arial, sans-serif',
        }}>
          {vars.docType || 'PROPOSTA DE SERVIÇOS'}
        </p>
        <p style={{
          margin: 0, fontSize: 28, fontWeight: 900, color: BLACK,
          letterSpacing: '-0.03em', lineHeight: 1.15, textTransform: 'uppercase',
          fontFamily: 'Inter, system-ui, Arial, sans-serif',
        }}>
          CLIENTE: {(vars.clientName ?? '').toUpperCase()}
        </p>
      </div>
    )}
  </div>
);

// ── RODAPÉ ────────────────────────────────────────────────────────────────────
const PageFooter: React.FC<{ vars: TemplateVars }> = ({ vars }) => (
  <>
    <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, zIndex: 1 }}>
      <table style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', paddingRight: 30 }}>
              <p style={{ margin: 0, fontSize: 11.7, lineHeight: 1.5, color: BLACK, whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
                {vars.phone1 || '+55 47 99705-3732'}
              </p>
              {vars.phone2 && (
                <p style={{ margin: 0, fontSize: 11.7, lineHeight: 1.5, color: BLACK, whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
                  {vars.phone2}
                </p>
              )}
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <p style={{ margin: 0, fontSize: 11.7, lineHeight: 1.5, color: BLACK, whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
                {vars.website || 'CromiaComunicação.com'}
              </p>
              <p style={{ margin: 0, fontSize: 11.7, lineHeight: 1.5, color: BLACK, whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
                {vars.email || 'contato@cromiacomunicacao.com'}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <BottomDecor />
  </>
);

// ── CSS conteúdo TipTap ───────────────────────────────────────────────────────
const CONTENT_CSS = `
  .pc p  { margin: 0 0 9px; }
  .pc ul { margin: 0 0 9px; padding-left: 19px; list-style: disc; }
  .pc ol { margin: 0 0 9px; padding-left: 19px; }
  .pc li { margin-bottom: 4px; }
  .pc strong { font-weight: 700; }
  .pc em { font-style: italic; }
  .pc u  { text-decoration: underline; }
  .pc h1 { font-size: 16px; font-weight: 900; margin: 0 0 8px; }
  .pc h2 { font-size: 14px; font-weight: 800; margin: 0 0 6px; }
  .pc h3 { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
  .pc hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
`;

// ── BLOCO SEÇÃO ───────────────────────────────────────────────────────────────
const SectionBlock: React.FC<{ section: TemplateSection; vars: TemplateVars; isFirst: boolean }> = ({
  section, vars, isFirst,
}) => (
  <div style={{ marginTop: isFirst ? 45 : 30, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
    <p style={{
      margin: '0 0 9px',
      fontSize: 17.8,
      fontWeight: 900,
      color: BLACK,
      letterSpacing: '0.02em',
      fontFamily: 'Inter, system-ui, Arial, sans-serif',
      pageBreakAfter: 'avoid',
      breakAfter: 'avoid',
      lineHeight: 1.2,
    }}>
      {section.number && <span>{section.number} </span>}
      {section.title.toUpperCase()}
    </p>
    <div
      className="pc"
      style={{
        fontSize: 13.6,
        lineHeight: 1.8,
        color: '#1a1a1a',
        textAlign: 'left',
        letterSpacing: '-0.1px',
        fontFamily: 'Inter, system-ui, Arial, sans-serif',
      }}
      dangerouslySetInnerHTML={{ __html: richContentToHtml(section.content, vars) }}
    />
  </div>
);

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export const ProposalTemplate = forwardRef<HTMLDivElement, {
  data: ProposalTemplateData;
}>(({ data }, ref) => {
  const pages: TemplateSection[][] = [];
  for (let i = 0; i < data.sections.length; i += SECS_PER_PAGE) {
    pages.push(data.sections.slice(i, i + SECS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <div ref={ref}>
      <style>{CONTENT_CSS}</style>
      {pages.map((pageSections, pageIdx) => (
        <div
          key={pageIdx}
          data-doc-page
          style={{
            position: 'relative',
            width: PAGE_W,
            height: PAGE_H,
            overflow: 'hidden',
            background: '#ffffff',
            fontFamily: 'Inter, system-ui, Arial, sans-serif',
            boxShadow: 'none',
            marginBottom: 0,
          }}
        >
          <TopRightDecor />
          <LeftMidDecor />

          <PageHeader vars={data.vars} showTitle={pageIdx === 0} />

          <div style={{ padding: `${pageIdx === 0 ? 0 : PH}px ${PL}px 110px` }}>
            {pageSections.map((s, i) => (
              <SectionBlock key={s.id} section={s} vars={data.vars} isFirst={pageIdx === 0 && i === 0} />
            ))}
            {pageSections.length === 0 && (
              <p style={{ marginTop: 48, color: '#bbb', fontSize: 13, textAlign: 'center' }}>
                Adicione seções no painel esquerdo
              </p>
            )}
          </div>

          <PageFooter vars={data.vars} />
        </div>
      ))}
    </div>
  );
});

ProposalTemplate.displayName = 'ProposalTemplate';

// ── CONTEÚDO PADRÃO ───────────────────────────────────────────────────────────
export const DEFAULT_PROPOSAL_CONTENT: TemplateSection[] = [
  {
    id: 'objetivo', number: '1.', title: 'Objetivo',
    content: docNode(
      paragraphNode(
        textNode('Estruturar e fortalecer a presença digital de '),
        textNode('{{client_name}}', [{ type: 'bold' }]),
        textNode(' por meio de estratégia de conteúdo, criação de peças e gestão das publicações nas redes sociais.'),
      ),
    ),
  },
  {
    id: 'servicos', number: '2.', title: 'Serviços Inclusos',
    content: docNode(
      paragraphNode(
        textNode('A proposta contempla a gestão estratégica de conteúdo para os canais '),
        textNode('Instagram', [{ type: 'bold' }]),
        textNode(' e '),
        textNode('Facebook', [{ type: 'bold' }]),
        textNode(', incluindo:'),
      ),
      bulletListNode(
        [textNode('Planejamento estratégico mensal de conteúdo')],
        [textNode('Criação de até 3 postagens por semana')],
        [textNode('Desenvolvimento das artes e criativos')],
        [textNode('Criação de textos e legendas')],
        [textNode('Publicação dos conteúdos')],
        [textNode('Relatório mensal de desempenho')],
      ),
    ),
  },
  {
    id: 'cronograma', number: '3.', title: 'Cronograma',
    content: docNode(
      paragraphNode(
        textNode('As entregas serão distribuídas conforme calendário mensal aprovado em conjunto com o cliente, respeitando datas comemorativas e sazonalidade do negócio.'),
      ),
    ),
  },
  {
    id: 'investimento', number: '4.', title: 'Investimento',
    content: docNode(
      paragraphNode(textNode('Valor mensal: ', [{ type: 'bold' }]), textNode('{{total_value}}', [{ type: 'bold' }])),
      paragraphNode(textNode('Forma de pagamento: '), textNode('{{payment_schedule}}')),
    ),
  },
  {
    id: 'condicoes', number: '5.', title: 'Condições Gerais',
    content: docNode(
      bulletListNode(
        [textNode('Contrato mínimo de 3 meses')],
        [textNode('Pagamento via PIX, transferência ou cartão')],
        [textNode('Prazo estimado para início: '), textNode('{{start_date}}')],
        [textNode('Revisões incluídas: até 2 por peça')],
      ),
    ),
  },
];
