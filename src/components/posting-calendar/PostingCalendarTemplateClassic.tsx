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

type PostingCalendarTemplateClassicProps = {
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
  panel: '#F7F7F7',
  text: '#4A3E3E',
  muted: '#B8AEA6',
  cell: '#F8F8F8',
  cellBorder: '#E7E0D8',
  shellBorder: '#E6E0D8',
};
const DEFAULT_LOGO_PATH = '/calendario.png';

const withPx = (value: string | number | undefined, fallback: string) => {
  if (value == null) return fallback;
  if (typeof value === 'number') return `${value}px`;
  if (/^\d+$/.test(String(value))) return `${value}px`;
  return String(value);
};

export const PostingCalendarTemplateClassic = React.forwardRef<
  HTMLDivElement,
  PostingCalendarTemplateClassicProps
>(function PostingCalendarTemplateClassic(
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

  const primaryLogo = brandLogoUrl || DEFAULT_LOGO_PATH;
  const clientLogo = client?.logo_url || '';

  const outerPadding = withPx(template.layout?.outer_padding, '16px');
  const sidebarWidth = withPx(template.layout?.sidebar_width, '264px');
  const sidebarHeight = withPx(
    (template.layout as unknown as Record<string, string | number | undefined>)?.sidebar_height,
    '640px'
  );
  const cellHeight = withPx(template.layout?.day_cell_min_height, '112px');
  const monthSize = withPx(template.layout?.month_font_size, '72px');
  const panelRadius = withPx(template.layout?.panel_radius, '24px');
  const outerRadius = withPx(template.layout?.outer_radius, '24px');
  const cellRadius = withPx(template.layout?.day_cell_radius, '18px');
  const gridGap = withPx(template.layout?.legend_spacing, '14px');

  const visibleLegendItems = (template.legend_items || []).filter(
    (item) => item.visible !== false
  );

  const getLegendByType = (postType: string) =>
    visibleLegendItems.find((item) => item.id === postType);

  const getItemsByDay = (day: number | null) => {
    if (!day) return [];
    return (calendarItems || []).filter((item) => Number(item.day_number) === day);
  };

  return (
    <div
      ref={ref}
      className={cn('w-full select-none', className)}
      style={{
        backgroundColor: template.theme?.canvas_background || COLORS.canvas,
        padding: `var(--outer-padding, ${outerPadding})`,
        borderRadius: outerRadius,
      }}
    >
      <div
        className="w-full overflow-hidden border"
        style={{
          backgroundColor: template.theme?.shell_background || COLORS.shell,
          borderColor: COLORS.shellBorder,
          borderRadius: '30px',
          padding: '18px 18px 22px',
        }}
      >
        <div
          className="flex items-start justify-between"
          style={{
            padding: '2px 8px 8px 8px',
            marginBottom: '10px',
          }}
        >
          <h2
            className="uppercase leading-none"
            style={{
              fontSize: `var(--month-size, ${monthSize})`,
              lineHeight: 0.9,
              fontWeight: 900,
              letterSpacing: '-0.055em',
              color: template.theme?.text_color || COLORS.text,
              margin: 0,
            }}
          >
            {monthLabel.toUpperCase()}
          </h2>

          <div
            style={{
              fontSize: '56px',
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: template.theme?.text_color || COLORS.text,
              marginTop: '2px',
            }}
          >
            {year}
          </div>
        </div>

        <div
          className="grid items-start"
          style={{
            gridTemplateColumns: showSidebar
              ? `44px var(--sidebar-width, ${sidebarWidth}) minmax(0, 1fr)`
              : '1fr',
            columnGap: '22px',
          }}
        >
          {showSidebar && (
            <>
              {/* TEXTO VERTICAL AGORA ACOMPANHA A ALTURA DA LATERAL */}
              <div
                className="relative"
                style={{
                  height: `var(--sidebar-height, ${sidebarHeight})`,
                }}
              >
                <span
                  className="absolute left-0 text-xs tracking-[0.3em]"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    color: template.theme?.text_color || COLORS.text,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {template.sidebar_title || 'CALENDÁRIO DE CONTEÚDO'}
                </span>
              </div>

              <aside
                className="flex flex-col"
                style={{
                  height: `var(--sidebar-height, ${sidebarHeight})`,
                  border: `3px solid ${template.theme?.text_color || COLORS.text}`,
                  borderRadius: `var(--panel-radius, ${panelRadius})`,
                  backgroundColor: template.theme?.sidebar_background || COLORS.panel,
                  padding: '20px 20px 16px',
                }}
              >
                <div className="flex flex-col" style={{ gap: '12px' }}>
                  {visibleLegendItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-center rounded-full text-center uppercase"
                      style={{
                        minHeight: '42px',
                        backgroundColor: item.color,
                        color: item.textColor || COLORS.text,
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        padding: '8px 14px',
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex flex-col items-center justify-end pt-6">
                  {primaryLogo ? (
                    <img
                      src={primaryLogo}
                      alt="Marca"
                      crossOrigin="anonymous"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src.endsWith(DEFAULT_LOGO_PATH)) return;
                        target.src = DEFAULT_LOGO_PATH;
                        target.removeAttribute('crossorigin');
                      }}
                      className="object-contain"
                      style={{
                        maxWidth: '190px',
                        maxHeight: '92px',
                      }}
                    />
                  ) : null}

                  {clientLogo ? (
                    <img
                      src={clientLogo}
                      alt={client?.name || 'Cliente'}
                      crossOrigin="anonymous"
                      onError={(event) => {
                        const target = event.currentTarget;
                        target.src = DEFAULT_LOGO_PATH;
                        target.removeAttribute('crossorigin');
                      }}
                      className="object-contain"
                      style={{
                        maxWidth: '150px',
                        maxHeight: '88px',
                        marginTop: '12px',
                      }}
                    />
                  ) : client?.name ? (
                    <div
                      style={{
                        marginTop: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: template.theme?.text_color || COLORS.text,
                        textAlign: 'center',
                      }}
                    >
                      {client.name}
                    </div>
                  ) : null}
                </div>
              </aside>
            </>
          )}

          <section className="min-w-0">
            <div
              className="grid grid-cols-7"
              style={{
                gap: '12px',
                marginBottom: '12px',
                paddingTop: '14px',
              }}
            >
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center uppercase"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: template.theme?.text_color || COLORS.text,
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7"
              style={{
                gap: `var(--legend-gap, ${gridGap})`,
              }}
            >
              {calendarCells.map((cell, index) => {
                const dayItems = getItemsByDay(cell.day);
                const isSelected =
                  Boolean(cell.day) &&
                  selectedDay != null &&
                  selectedDay === cell.day;

                return (
                  <div
                    key={`${cell.day ?? 'empty'}-${index}`}
                    onClick={() => {
                      if (cell.day && onDayClick) onDayClick(cell.day);
                    }}
                    className={cn(cell.day && onDayClick ? 'cursor-pointer' : '')}
                    style={{
                      minHeight: `var(--cell-height, ${cellHeight})`,
                      borderRadius: cellRadius,
                      backgroundColor: cell.day ? COLORS.cell : '#F5F3EF',
                      border: `1px solid ${
                        template.theme?.day_cell_border_color || COLORS.cellBorder
                      }`,
                      padding: '10px 12px',
                      opacity: cell.day ? 1 : 0.8,
                      boxShadow: isSelected ? '0 0 0 2px #4A3E3E inset' : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        lineHeight: 1,
                        fontWeight: 600,
                        color:
                          cell.isCurrentMonth === false
                            ? COLORS.muted
                            : template.theme?.text_color || COLORS.text,
                      }}
                    >
                      {cell.day ?? ''}
                    </div>

                    <div className="mt-2 flex flex-col gap-1.5">
                      {dayItems.slice(0, 3).map((item) => {
                        const legend = getLegendByType(item.post_type);

                        return (
                          <div
                            key={item.id}
                            className="truncate rounded-full px-2 py-1 text-center uppercase"
                            style={{
                              backgroundColor:
                                item.label_color || legend?.color || '#DDD',
                              color: legend?.textColor || COLORS.text,
                              fontSize: '9px',
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                            }}
                            title={item.title || legend?.label || item.post_type}
                          >
                            {item.title || legend?.label || item.post_type}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

PostingCalendarTemplateClassic.displayName = 'PostingCalendarTemplateClassic';

export default PostingCalendarTemplateClassic;
