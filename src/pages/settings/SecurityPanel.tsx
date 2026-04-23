import React, { useState } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SecurityPanelProps {
  email: string;
  username: string;
  saving: boolean;
  onSubmit: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<boolean>;
}

const inputClassName =
  'h-12 w-full rounded-[18px] border border-[#d8e3c9] bg-white px-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-all duration-200 hover:border-[#b9d28b] focus:border-[#9aca52] focus:ring-4 focus:ring-[#ddeaaf]/70';

const PasswordField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="space-y-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={label === 'Senha atual' ? 'current-password' : 'new-password'}
          className={cn(inputClassName, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
};

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  email,
  username,
  saving,
  onSubmit,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Preencha os três campos para trocar a senha.');
      return;
    }

    if (newPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação não bate com a nova senha.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('A nova senha precisa ser diferente da senha atual.');
      return;
    }

    setError('');
    const success = await onSubmit({ currentPassword, newPassword, confirmPassword });
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
      <div className="border-b border-[#e2eacb] bg-[radial-gradient(circle_at_top_left,_rgba(154,202,82,0.18),_transparent_38%),linear-gradient(135deg,#fbfdf5_0%,#ffffff_60%,#f2f8df_100%)] px-6 py-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce7c3] bg-white/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          <ShieldCheck size={14} className="text-lime-600" />
          Segurança da conta
        </div>
        <h3 className="mt-4 text-[26px] font-bold tracking-[-0.05em] text-slate-950">Troca de senha operacional</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Atualize a senha do usuário autenticado sem sair da área de Configurações.
        </p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Usuário</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{username || 'Sem username'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">E-mail</div>
              <div className="mt-2 truncate text-sm font-semibold text-slate-900">{email || 'Sem e-mail'}</div>
            </div>
          </div>

          <div className="grid gap-4">
            <PasswordField
              label="Senha atual"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Digite sua senha atual"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                label="Nova senha"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Mínimo de 8 caracteres"
              />
              <PasswordField
                label="Confirmar senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="inline-flex h-[52px] items-center justify-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,#1b1c15_0%,#9aca52_100%)] px-5 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(154,202,82,0.28)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <KeyRound size={16} />
              {saving ? 'Atualizando senha...' : 'Atualizar senha'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center gap-2">
              <LockKeyhole size={16} className="text-lime-600" />
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Política</div>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Use pelo menos 8 caracteres.</li>
              <li>Misture letras, números e símbolo quando possível.</li>
              <li>Evite repetir a mesma senha do e-mail corporativo.</li>
            </ul>
          </div>

          <div className="rounded-[24px] border border-lime-200 bg-lime-50/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-700">Fluxo</div>
            <p className="mt-3 text-sm leading-6 text-lime-900">
              A validação confere a senha atual no Supabase Auth antes de aplicar a nova senha no usuário logado.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
