/**
 * CromiaDocTemplate
 * Layout fixo com identidade visual da Cromia (verde oliva, logo, faixas, footer).
 * Os blocos de texto são editáveis inline via contentEditable.
 * Este componente é renderizado em tela E capturado pelo html2canvas para gerar o PDF.
 */
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ─── Brand constants ─────────────────────────────────────────────────────────
export const CROMIA_GREEN = '#4a5c28';
export const CROMIA_GREEN_LIGHT = '#6b7e3a';
export const CROMIA_BLACK = '#1a1a1a';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocSection {
  id: string;
  number?: string;         // "1.", "2." etc — null for unnumbered
  title: string;
  content: string;         // plain text, newlines become <br>
  isList?: boolean;        // render content as bullet list
  isHighlight?: boolean;   // render as investment highlight box
}

export interface CromiaDocData {
  date: string;            // "12 de março de 2026"
  clientName: string;
  sections: DocSection[];
  showBrand?: boolean;     // show "Cromia & ClientName" finale slide
}

interface CromiaDocTemplateProps {
  data: CromiaDocData;
  editable?: boolean;
  onSectionChange?: (id: string, field: 'title' | 'content', value: string) => void;
  className?: string;
}

// ─── Editable cell ───────────────────────────────────────────────────────────

const Editable: React.FC<{
  value: string;
  onChange?: (val: string) => void;
  tag?: keyof React.JSX.IntrinsicElements;
  className?: string;
  placeholder?: string;
  editable?: boolean;
}> = ({ value, onChange, tag: Tag = 'div', className, placeholder, editable = true }) => {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  if (!editable) {
    return (
      <Tag
        className={className}
        dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, '<br/>') }}
      />
    );
  }

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => onChange?.((e.target as HTMLElement).textContent ?? '')}
      className={cn(
        className,
        'outline-none focus:ring-2 focus:ring-offset-1 rounded',
        'focus:ring-[#4a5c28]/40 transition-shadow',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none'
      )}
    />
  );
};

// ─── Page shell ──────────────────────────────────────────────────────────────

const DocPage: React.FC<{ children: React.ReactNode; isLast?: boolean }> = ({ children, isLast }) => (
  <div
    className="relative bg-white overflow-hidden"
    style={{
      width: '794px',         // A4 @ 96dpi
      minHeight: '1123px',
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      pageBreakAfter: isLast ? 'avoid' : 'always',
    }}
  >
    {children}
  </div>
);

// ─── Header ──────────────────────────────────────────────────────────────────

const DocHeader: React.FC<{ date: string }> = ({ date }) => (
  <div className="flex items-start justify-between px-10 pt-6 pb-2">
    {/* Left: date + logo */}
    <div>
      <p style={{ color: CROMIA_GREEN, fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
        Data: {date}
      </p>
      {/* Logo mark */}
      <div style={{ lineHeight: 1 }}>
        <span style={{
          fontSize: '32px', fontWeight: 900, letterSpacing: '-1px',
          color: CROMIA_GREEN,
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}>
          cr◦m
          <span style={{ color: CROMIA_BLACK }}>/</span>
          ia
        </span>
        <p style={{ fontSize: '9px', letterSpacing: '4px', color: CROMIA_GREEN, marginTop: '-2px', textTransform: 'uppercase' }}>
          Comunicação operacional
        </p>
      </div>
    </div>

    {/* Right: decorative lines */}
    <div style={{ paddingTop: '18px' }}>
      <svg width="130" height="32" viewBox="0 0 130 32">
        {/* Circle */}
        <circle cx="8" cy="8" r="7" fill={CROMIA_GREEN} />
        {/* Long line */}
        <line x1="18" y1="8" x2="130" y2="8" stroke={CROMIA_BLACK} strokeWidth="3" />
        {/* Shorter line below */}
        <line x1="40" y1="20" x2="130" y2="20" stroke={CROMIA_GREEN} strokeWidth="2" />
        <line x1="60" y1="30" x2="130" y2="30" stroke={CROMIA_GREEN} strokeWidth="1.5" />
      </svg>
    </div>
  </div>
);

// ─── Side decorations ─────────────────────────────────────────────────────────

const LeftStripe: React.FC = () => (
  <div style={{
    position: 'absolute', left: 0, top: '120px',
    width: '18px', height: '220px',
    background: CROMIA_GREEN,
    clipPath: 'polygon(0 0, 100% 10%, 100% 90%, 0 100%)',
    opacity: 0.85,
  }} />
);

const RightStripe: React.FC = () => (
  <div style={{
    position: 'absolute', right: 0, top: '160px',
    width: '18px', height: '180px',
    background: CROMIA_BLACK,
    clipPath: 'polygon(0 10%, 100% 0, 100% 100%, 0 90%)',
  }} />
);

// ─── Footer ──────────────────────────────────────────────────────────────────

const DocFooter: React.FC = () => (
  <>
    {/* Contact bar */}
    <div style={{
      position: 'absolute', bottom: '28px', left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: '32px',
    }}>
      {/* Phone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke={CROMIA_BLACK} strokeWidth="1.5" />
          <path d="M8.5 10.5C9 11.5 10 13 12 14.5C14 16 15.5 16.5 16.5 16.5L17.5 14.5L15 13.5L14 15C14 15 12 14 11 13C10 12 9 10 9 10L10.5 9L9.5 6.5L7.5 7.5C7.5 8.5 8 9.5 8.5 10.5Z" fill={CROMIA_BLACK} />
        </svg>
        <div>
          <p style={{ fontSize: '9px', lineHeight: 1.4, color: CROMIA_BLACK, margin: 0 }}>+55 12 99165-9954</p>
          <p style={{ fontSize: '9px', lineHeight: 1.4, color: CROMIA_BLACK, margin: 0 }}>+55 47 9746-8859</p>
        </div>
      </div>
      {/* Web */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke={CROMIA_BLACK} strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="4" ry="11" stroke={CROMIA_BLACK} strokeWidth="1.5" />
          <line x1="1" y1="12" x2="23" y2="12" stroke={CROMIA_BLACK} strokeWidth="1.5" />
        </svg>
        <div>
          <p style={{ fontSize: '9px', lineHeight: 1.4, color: CROMIA_BLACK, margin: 0 }}>CromiaComunicação.com</p>
          <p style={{ fontSize: '9px', lineHeight: 1.4, color: CROMIA_BLACK, margin: 0 }}>contato@cromiacomunicação.com</p>
        </div>
      </div>
    </div>

    {/* Bottom black bar */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: '10px', background: CROMIA_BLACK,
    }} />
  </>
);

// ─── Section block ────────────────────────────────────────────────────────────

const SectionBlock: React.FC<{
  section: DocSection;
  editable?: boolean;
  onTitleChange?: (val: string) => void;
  onContentChange?: (val: string) => void;
}> = ({ section, editable, onTitleChange, onContentChange }) => {
  if (section.isHighlight) {
    // Investment / highlight box
    return (
      <div style={{ margin: '16px 0 8px' }}>
        <Editable
          tag="h2"
          value={section.number ? `${section.number} ${section.title}` : section.title}
          onChange={(v) => onTitleChange?.(v)}
          editable={editable}
          style={{
            fontSize: '28px', fontWeight: 900, color: CROMIA_BLACK,
            margin: '0 0 10px', lineHeight: 1.15,
          } as React.CSSProperties}
        />
        <div style={{
          background: '#f0f4e8',
          borderLeft: `5px solid ${CROMIA_GREEN}`,
          padding: '14px 18px',
          borderRadius: '4px',
        }}>
          <Editable
            value={section.content}
            onChange={onContentChange}
            editable={editable}
            style={{ fontSize: '13px', color: CROMIA_BLACK, whiteSpace: 'pre-wrap', lineHeight: 1.6 } as React.CSSProperties}
          />
        </div>
      </div>
    );
  }

  const lines = section.content.split('\n').filter(Boolean);
  const isList = section.isList || lines.some((l) => l.startsWith('•') || l.startsWith('-'));

  return (
    <div style={{ margin: '16px 0 8px' }}>
      {/* Section title */}
      <Editable
        tag="h2"
        value={section.number ? `${section.number} ${section.title}` : section.title}
        onChange={onTitleChange}
        editable={editable}
        style={{
          fontSize: '28px', fontWeight: 900, color: CROMIA_BLACK,
          margin: '0 0 10px', lineHeight: 1.15,
        } as React.CSSProperties}
      />

      {/* Content */}
      {isList ? (
        <div>
          {lines.map((line, i) => {
            const clean = line.replace(/^[•\-]\s*/, '');
            const isBold = clean.startsWith('**') && clean.endsWith('**');
            const text = isBold ? clean.slice(2, -2) : clean;
            const isSubheader = line.startsWith('**') && !line.startsWith('•');

            if (isSubheader) {
              return (
                <p key={i} style={{ fontWeight: 700, fontSize: '13px', color: CROMIA_BLACK, margin: '8px 0 2px' }}>
                  {text}
                </p>
              );
            }

            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: CROMIA_GREEN, flexShrink: 0, marginTop: '5px',
                }} />
                <span style={{
                  fontSize: '13px', color: CROMIA_BLACK, lineHeight: 1.6,
                  fontWeight: isBold ? 700 : 400,
                }}>
                  {text}
                </span>
              </div>
            );
          })}
          {/* Hidden editable for list content */}
          {editable && (
            <textarea
              value={section.content}
              onChange={(e) => onContentChange?.(e.target.value)}
              rows={Math.max(3, lines.length + 1)}
              style={{
                width: '100%', marginTop: '8px', fontSize: '11px',
                border: '1px dashed #ccc', borderRadius: '4px', padding: '6px',
                color: '#666', background: '#fafafa', resize: 'vertical',
                fontFamily: 'monospace',
              }}
              placeholder="Edite os itens da lista (um por linha, comece com • ou - para bullet)"
            />
          )}
        </div>
      ) : (
        <Editable
          value={section.content}
          onChange={onContentChange}
          editable={editable}
          style={{
            fontSize: '13px', color: '#333', lineHeight: '1.75',
            textAlign: 'justify', whiteSpace: 'pre-wrap',
          } as React.CSSProperties}
        />
      )}
    </div>
  );
};

// ─── Main template ────────────────────────────────────────────────────────────

export const CromiaDocTemplate = forwardRef<HTMLDivElement, CromiaDocTemplateProps>(
  ({ data, editable = false, onSectionChange, className }, ref) => {
    // Split sections into pages (max 2 big sections per page)
    const SECTIONS_PER_PAGE = 2;
    const pages: DocSection[][] = [];
    for (let i = 0; i < data.sections.length; i += SECTIONS_PER_PAGE) {
      pages.push(data.sections.slice(i, i + SECTIONS_PER_PAGE));
    }

    // Add brand finale if requested
    const hasFinale = data.showBrand && data.clientName;

    return (
      <div ref={ref} className={cn('flex flex-col gap-0', className)}>
        {pages.map((pageSections, pageIdx) => (
          <DocPage key={pageIdx} isLast={pageIdx === pages.length - 1 && !hasFinale}>
            <LeftStripe />
            <RightStripe />
            <DocHeader date={data.date} />

            <div style={{ paddingLeft: '40px', paddingRight: '40px', paddingTop: '8px', paddingBottom: '80px' }}>
              {pageSections.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  editable={editable}
                  onTitleChange={(v) => onSectionChange?.(section.id, 'title', v)}
                  onContentChange={(v) => onSectionChange?.(section.id, 'content', v)}
                />
              ))}
            </div>

            <DocFooter />
          </DocPage>
        ))}

        {/* Brand finale page */}
        {hasFinale && (
          <DocPage isLast>
            <LeftStripe />
            <RightStripe />
            <DocHeader date={data.date} />

            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', paddingTop: '200px', paddingBottom: '100px',
            }}>
              <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
                <span style={{
                  fontSize: '72px', fontWeight: 900, letterSpacing: '-3px',
                  color: CROMIA_GREEN, fontFamily: '"Helvetica Neue", Arial, sans-serif',
                  display: 'block',
                }}>
                  cr◦m<span style={{ color: CROMIA_BLACK }}>/</span>ia &amp;
                </span>
                <span style={{
                  fontSize: '72px', fontWeight: 900, letterSpacing: '-3px',
                  color: CROMIA_GREEN, fontFamily: '"Helvetica Neue", Arial, sans-serif',
                  display: 'block',
                }}>
                  {data.clientName}
                </span>
              </div>
            </div>

            <DocFooter />
          </DocPage>
        )}
      </div>
    );
  }
);

CromiaDocTemplate.displayName = 'CromiaDocTemplate';

// ─── Default section templates ────────────────────────────────────────────────

export const DEFAULT_PROPOSAL_SECTIONS: DocSection[] = [
  {
    id: 'apresentacao',
    number: '1.',
    title: 'Apresentação',
    content: 'A {{client_name}} possui um trabalho visualmente muito atrativo e com grande potencial de crescimento no mercado.\n\nO objetivo desta proposta é estruturar e fortalecer a presença digital da marca, utilizando estratégia de conteúdo e anúncios para aumentar a visibilidade do perfil e gerar mais resultados.',
  },
  {
    id: 'diagnostico',
    number: '2.',
    title: 'Diagnóstico Inicial',
    content: '• Potencial visual pouco explorado nas redes sociais\n• Conteúdo ainda sem estratégia clara de crescimento\n• Falta de posicionamento mais forte da marca\n• Baixo aproveitamento do alcance para gerar novos clientes',
    isList: true,
  },
  {
    id: 'objetivo',
    number: '3.',
    title: 'Objetivo do Projeto',
    content: '• Aumentar o alcance do perfil\n• Fortalecer o posicionamento da marca\n• Atrair novos clientes\n• Gerar mais pedidos e orçamentos',
    isList: true,
  },
  {
    id: 'estrategia',
    number: '4.',
    title: 'Estratégia de Crescimento',
    content: 'O trabalho será baseado em duas frentes principais:\n\n**Conteúdo estratégico**\nProdução de conteúdo pensado para valorizar os produtos e gerar maior conexão com o público.\n\n**Anúncios direcionados**\nCriação e gestão de campanhas para alcançar novos clientes e ampliar a visibilidade da marca.',
  },
  {
    id: 'servicos',
    number: '5.',
    title: 'Serviços Inclusos',
    content: '• Planejamento estratégico de conteúdo\n• Análise e otimização do perfil\n• Criação de calendário editorial\n• Gestão de anúncios no Meta Ads\n• Monitoramento e otimização das campanhas\n• Relatório mensal de desempenho',
    isList: true,
  },
  {
    id: 'investimento',
    number: '6.',
    title: 'Investimento',
    content: 'Investimento mensal: {{total_value}}\n\nForma de pagamento: {{payment_schedule}}',
    isHighlight: true,
  },
  {
    id: 'condicoes',
    number: '7.',
    title: 'Condições',
    content: '• Contrato mínimo de 3 meses\n• Pagamento via PIX, transferência ou cartão de crédito\n• Prazo estimado para início: {{start_date}}\n• Reajuste anual: IGPM',
    isList: true,
  },
  {
    id: 'sobre',
    number: '8.',
    title: 'Sobre a Cromia',
    content: 'A Cromia Comunicação organiza a operação de marketing dos clientes com rotina, calendário, execução e acompanhamento contínuo.\n\nO foco deste trabalho é dar clareza de prioridades, consistência de entrega e visibilidade do que precisa ser produzido, aprovado e publicado.',
  },
];
