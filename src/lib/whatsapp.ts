type BuildApprovalWhatsappMessageInput = {
  clientName: string;
  monthLabel: string;
  approvalUrl: string;
};

type BuildWhatsappLinkInput = {
  message: string;
  phone?: string | null;
};

export function buildApprovalWhatsappMessage({
  clientName,
  monthLabel,
  approvalUrl,
}: BuildApprovalWhatsappMessageInput): string {
  return [
    '🚨 APROVAÇÃO NECESSÁRIA',
    '',
    `Seu conteúdo de ${monthLabel} está pronto e precisa da sua validação agora, ${clientName}.`,
    '',
    'Acesse o portal para revisar e aprovar:',
    `👉 ${approvalUrl}`,
    '',
    '⚠️ A publicação depende da sua aprovação.',
  ].join('\n');
}

export function buildWhatsAppLink({ message, phone }: BuildWhatsappLinkInput): string {
  const cleanedPhone = String(phone || '').replace(/\D/g, '');
  const base = cleanedPhone ? `https://wa.me/${cleanedPhone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}
