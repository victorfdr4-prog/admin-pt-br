import React from 'react';
import {
  DEFAULT_POSTING_CALENDAR_TEMPLATE,
  normalizePostingCalendarTemplateConfig,
  type PostingCalendarTemplateConfig,
} from '@/domain/agencyPlatform';
import { cn } from '@/lib/utils';

type ClientTemplateData = {
  id?: string;
  name: string;
  logo_url?: string | null;
};

type CalendarItemTemplateData = {
  id: string;
  day_number: number;
  post_type: string;
  title: string | null;
  status: string;
  label_color?: string | null;
};

type CalendarCell = {
  day: number | null;
  isCurrentMonth?: boolean;
};

type PostingCalendarTemplateRendererProps = {
  client: ClientTemplateData | null;
  brandLogoUrl?: string | null;
  monthLabel: string;
  year: number;
  weekDays: string[];
  calendarCells: CalendarCell[];
  calendarItems: CalendarItemTemplateData[];
  config?: PostingCalendarTemplateConfig;
  className?: string;
  hideSidebar?: boolean;
  selectedDay?: number | null;
  onDayClick?: (day: number) => void;
};

const COLORS = {
  canvas: '#F3F2EF',
  shell: '#E9E5DF',
  sidebar: '#F7F7F7',
  text: '#493C3C',
  muted: '#B9B0A7',
  cell: '#FAFAFA',
  cellBorder: '#E6E0D9',
};

const withPx = (value: string | number | undefined, fallback: string) => {
  if (!value) return fallback;
  if (typeof value === 'number') return `${value}px`;
  if (/^\d+$/.test(value)) return `${value}px`;
  return value;
};

export const PostingCalendarTemplateRenderer = React.forwardRef<
  HTMLDivElement,
  PostingCalendarTemplateRendererProps
>(function PostingCalendarTemplateRenderer(
  {
    client,
    brandLogoUrl,
    monthLabel,
    year,
    weekDays,
    calendarCells,
    calendarItems,
    config,
    className,
    hideSidebar = false,
    selectedDay,
    onDayClick,
  },
  ref
) {
  const template = normalizePostingCalendarTemplateConfig(
    config || DEFAULT_POSTING_CALENDAR_TEMPLATE
  );

  const showSidebar = (template?.visibility?.show_sidebar ?? true) && !hideSidebar;

  const sidebarWidth = withPx(template.layout?.sidebar_width, '264px');
  const sidebarHeight = withPx(
    (template.layout as any)?.sidebar_height,
    '640px'
  );

  const monthFontSize = withPx(template.layout?.month_font_size, '72px');

  return (
    <div
      ref={ref}
      className={cn('w-full select-none', className)}
      style={{
        backgroundColor: template.theme?.canvas_background || COLORS.canvas,
        padding: '16px',
        borderRadius: '24px',
      }}
    >
      <div
        className="w-full overflow-hidden border"
        style={{
          backgroundColor: template.theme?.shell_background || COLORS.shell,
          borderRadius: '30px',
          padding: '20px 26px 28px',
        }}
      >

        {/* HEADER ALINHADO COM A BARRA */}
        <div className="mb-4 flex items-start justify-between">
          <h2
            className="uppercase leading-none"
            style={{
              fontSize: monthFontSize,
              fontWeight: 900,
              letterSpacing: '-0.05em',
              color: template.theme?.text_color || COLORS.text,
              marginLeft: showSidebar ? '66px' : '0px',
            }}
          >
            {monthLabel.toUpperCase()}
          </h2>

          <div
            style={{
              fontSize: '56px',
              fontWeight: 800,
              color: template.theme?.text_color || COLORS.text,
            }}
          >
            {year}
          </div>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: showSidebar
              ? `44px ${sidebarWidth} 1fr`
              : '1fr',
            gap: '22px',
          }}
        >
          {showSidebar && (
            <>
              {/* TEXTO VERTICAL PERFEITO */}
              <div
                style={{
                  height: sidebarHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    fontSize: '18px',
                    letterSpacing: '0.08em',
                    color: template.theme?.text_color || COLORS.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  {template.sidebar_title || 'CALENDÁRIO DE CONTEÚDO'}
                </span>
              </div>

              {/* CARD */}
              <aside
                style={{
                  height: sidebarHeight,
                  border: `3px solid ${template.theme?.text_color || COLORS.text}`,
                  borderRadius: '24px',
                  background: template.theme?.sidebar_background || COLORS.sidebar,
                  padding: '20px',
                }}
              >
                {/* conteúdo */}
              </aside>
            </>
          )}

          {/* GRID (mantive simples pra foco no layout) */}
          <section />
        </div>
      </div>
    </div>
  );
});

export default PostingCalendarTemplateRenderer;