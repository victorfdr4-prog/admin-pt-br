export const ACTIVITY_TYPES = [
  'Post Feed',
  'Stories',
  'Reels',
  'Carrossel',
  'Copy',
  'Design',
  'Vídeo',
  'Campanha',
  'Relatório',
  'Reunião',
  'Tráfego',
  'SEO',
  'E-mail',
  'Outro',
] as const;

export const CHANNELS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'LinkedIn',
  'YouTube',
  'Google Ads',
  'Meta Ads',
  'E-mail',
  'Site',
] as const;

export const PRIORITY_META = {
  low: {
    label: 'Baixa',
    tone: '#84cc16',
    description: 'Pode entrar na próxima janela operacional.',
    surface: 'border-lime-200 bg-lime-50 text-lime-700',
  },
  medium: {
    label: 'Média',
    tone: '#f59e0b',
    description: 'Precisa rodar dentro do ciclo atual.',
    surface: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  high: {
    label: 'Alta',
    tone: '#ef4444',
    description: 'Entrega crítica para operação ou cliente.',
    surface: 'border-rose-200 bg-rose-50 text-rose-700',
  },
} as const;

export type PriorityKey = keyof typeof PRIORITY_META;
