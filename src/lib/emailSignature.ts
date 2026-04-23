export interface EmailSignatureProfile {
  full_name: string;
  email: string;
  avatar_url?: string | null;
  signature_role?: string | null;
  bio_hook?: string | null;
  phone_display?: string | null;
  linkedin_url?: string | null;
}

export interface EmailSignatureBranding {
  agency_name?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
}

interface EmailSignatureTheme {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSurface: string;
  accentBorder: string;
  textPrimary: string;
  textMuted: string;
  textSoft: string;
  divider: string;
  surface: string;
  surfaceMuted: string;
  canvas: string;
  dark: string;
  companyName: string;
  logoUrl: string;
}

const DEFAULT_ACCENT = '#C6A35B';
const DEFAULT_COMPANY_NAME = 'Cromia';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeUrl = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|data:|blob:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizeHexColor = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return DEFAULT_ACCENT;

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return DEFAULT_ACCENT;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHexColor(value).replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const toRgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
};

const shiftHex = (hex: string, amount: number) => {
  const { r, g, b } = hexToRgb(hex);
  const apply = (channel: number) => clamp(channel + amount, 0, 255);
  const next = [apply(r), apply(g), apply(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');
  return `#${next}`.toUpperCase();
};

export const extractPhoneDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');

export const buildWhatsAppUrl = (value?: string | null) => {
  const digits = extractPhoneDigits(value);
  return digits ? `https://wa.me/${digits}` : '';
};

export const normalizeLinkedInUrl = (value?: string | null) => normalizeUrl(value);

export const getInitials = (value?: string | null) => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'CO';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

export const resolveEmailSignatureTheme = (branding?: EmailSignatureBranding): EmailSignatureTheme => {
  const accent = normalizeHexColor(branding?.primary_color);
  const companyName = String(branding?.agency_name || '').trim() || DEFAULT_COMPANY_NAME;
  const logoUrl = normalizeUrl(branding?.logo_url);

  return {
    accent,
    accentStrong: shiftHex(accent, -24),
    accentSoft: toRgba(accent, 0.12),
    accentSurface: toRgba(accent, 0.08),
    accentBorder: toRgba(accent, 0.24),
    textPrimary: '#0F172A',
    textMuted: '#475467',
    textSoft: '#98A2B3',
    divider: '#E4E7EC',
    surface: '#FFFFFF',
    surfaceMuted: '#FCFAF7',
    canvas: '#F5F7FA',
    dark: '#111318',
    companyName,
    logoUrl,
  };
};

export const buildEmailSignaturePlainText = (
  profile: EmailSignatureProfile,
  branding?: EmailSignatureBranding
) => {
  const theme = resolveEmailSignatureTheme(branding);

  const lines = [
    profile.full_name?.trim() || 'Nome da equipe Cromia',
    profile.signature_role?.trim() || 'Equipe Cromia',
    profile.bio_hook?.trim() || '',
    profile.email?.trim() || '',
    profile.phone_display?.trim() || '',
    normalizeLinkedInUrl(profile.linkedin_url),
    theme.companyName,
  ].filter(Boolean);

  return lines.join('\n');
};

export const buildEmailSignatureHtml = (
  profile: EmailSignatureProfile,
  branding?: EmailSignatureBranding
) => {
  const theme = resolveEmailSignatureTheme(branding);
  const fullName = escapeHtml(String(profile.full_name || '').trim() || 'Nome da equipe Cromia');
  const role = escapeHtml(String(profile.signature_role || '').trim() || 'Equipe Cromia');
  const bioHook = escapeHtml(String(profile.bio_hook || '').trim());
  const email = escapeHtml(String(profile.email || '').trim());
  const phoneDisplay = escapeHtml(String(profile.phone_display || '').trim());
  const linkedinUrl = normalizeLinkedInUrl(profile.linkedin_url);
  const linkedInLabel = linkedinUrl ? linkedinUrl.replace(/^https?:\/\//i, '') : '';
  const whatsappUrl = buildWhatsAppUrl(profile.phone_display);
  const avatarUrl = normalizeUrl(profile.avatar_url);
  const avatarFallback = escapeHtml(getInitials(profile.full_name));
  const companyName = escapeHtml(theme.companyName);

  const logoMarkup = theme.logoUrl
    ? `
      <img
        src="${escapeHtml(theme.logoUrl)}"
        alt="${companyName}"
        style="display:block;max-width:148px;max-height:44px;width:auto;height:auto;border:0;outline:none;text-decoration:none;"
      />
    `
    : `
      <div style="display:inline-block;padding:12px 16px;border-radius:16px;background:${theme.dark};color:#FFFFFF;font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
        ${companyName}
      </div>
    `;

  const avatarMarkup = avatarUrl
    ? `
      <img
        src="${escapeHtml(avatarUrl)}"
        alt="${fullName}"
        width="60"
        height="60"
        style="display:block;width:60px;height:60px;border-radius:999px;border:2px solid ${theme.accentBorder};object-fit:cover;background:#E5E7EB;"
      />
    `
    : `
      <div
        style="width:60px;height:60px;border-radius:999px;border:2px solid ${theme.accentBorder};background:${theme.surfaceMuted};color:${theme.accentStrong};font-size:21px;font-weight:700;line-height:60px;text-align:center;"
      >
        ${avatarFallback}
      </div>
    `;

  const contactRows = [
    email
      ? `
        <tr>
          <td style="padding:0 0 8px 0;">
            <span style="display:inline-block;min-width:38px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${theme.textSoft};">mail</span>
            <a href="mailto:${email}" style="color:${theme.textPrimary};font-size:13px;line-height:20px;text-decoration:none;">${email}</a>
          </td>
        </tr>
      `
      : '',
    phoneDisplay
      ? `
        <tr>
          <td style="padding:0 0 8px 0;">
            <span style="display:inline-block;min-width:38px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${theme.textSoft};">wa</span>
            ${
              whatsappUrl
                ? `<a href="${escapeHtml(whatsappUrl)}" style="color:${theme.textPrimary};font-size:13px;line-height:20px;text-decoration:none;">${phoneDisplay}</a>`
                : `<span style="color:${theme.textPrimary};font-size:13px;line-height:20px;">${phoneDisplay}</span>`
            }
          </td>
        </tr>
      `
      : '',
    linkedinUrl
      ? `
        <tr>
          <td style="padding:0;">
            <span style="display:inline-block;min-width:38px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${theme.textSoft};">in</span>
            <a href="${escapeHtml(linkedinUrl)}" style="color:${theme.textPrimary};font-size:13px;line-height:20px;text-decoration:none;">${escapeHtml(linkedInLabel)}</a>
          </td>
        </tr>
      `
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:680px;font-family:Inter,Montserrat,Arial,sans-serif;color:${theme.textPrimary};">
  <tr>
    <td style="padding:0;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;background:${theme.surface};border:1px solid ${theme.divider};border-radius:28px;">
        <tr>
          <td colspan="3" style="height:4px;line-height:0;font-size:0;background:${theme.accent};border-radius:28px 28px 0 0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:24px 22px;background:${theme.surfaceMuted};vertical-align:top;width:184px;">
            ${logoMarkup}
            <div style="padding-top:16px;">
              <div style="font-size:10px;line-height:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${theme.textSoft};">
                identidade conectada
              </div>
              <div style="padding-top:6px;font-size:13px;line-height:20px;font-weight:600;color:${theme.textPrimary};">
                ${companyName}
              </div>
            </div>
          </td>
          <td style="width:1px;background:${theme.divider};font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:26px 28px;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="vertical-align:top;width:76px;padding:0 16px 0 0;">
                  ${avatarMarkup}
                </td>
                <td style="vertical-align:top;">
                  <div style="font-size:24px;line-height:26px;font-weight:800;letter-spacing:-0.03em;color:${theme.textPrimary};">
                    ${fullName}
                  </div>
                  <div style="padding-top:6px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${theme.accentStrong};">
                    ${role}
                  </div>
                  ${
                    bioHook
                      ? `
                        <div style="padding-top:10px;max-width:360px;font-size:13px;line-height:21px;font-style:italic;color:${theme.textMuted};">
                          ${bioHook}
                        </div>
                      `
                      : ''
                  }
                  ${
                    contactRows
                      ? `
                        <div style="padding-top:14px;margin-top:14px;border-top:1px solid ${theme.divider};">
                          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                            ${contactRows}
                          </table>
                        </div>
                      `
                      : ''
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
};
