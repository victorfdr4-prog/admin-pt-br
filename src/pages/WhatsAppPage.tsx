import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Loader2, Send, Smartphone, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

type WaStatus = 'READY' | 'CONNECTING' | 'QR_READY' | 'AUTH_FAILURE' | 'DISCONNECTED';

const WA_API = import.meta.env.VITE_WHATSAPP_API_URL || "https://cromia-os-production.up.railway.app";

const WhatsAppPage: React.FC = () => {
  const [status, setStatus] = useState<WaStatus>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sendResult, setSendResult] = useState<{ success: boolean; msg: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WA_API, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket conectado');
      setBackendOffline(false);
    });

    socket.on('connect_error', () => setBackendOffline(true));

    socket.on('wa:status', ({ status }: { status: WaStatus }) => {
      setStatus(status);
      if (status === 'READY') setQrCode(null);
    });

    socket.on('wa:qr', ({ qr }: { qr: string }) => {
      setQrCode(qr);
      setStatus('QR_READY');
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${WA_API}/api/whatsapp/send`, {
        phone: phone.replace(/\D/g, ''),
        message
      });
      setSendResult({ success: true, msg: 'Enviada com sucesso!' });
      setMessage('');
    } catch (error: any) {
      setSendResult({ success: false, msg: 'Erro ao enviar.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* HEADER DE STATUS */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cromia Engine V2</h1>
          <p className="text-slate-500 text-sm">Status: {status}</p>
        </div>
        <div className={`px-4 py-2 rounded-full font-medium flex items-center gap-2 ${
          status === 'READY' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
        }`}>
          {status === 'READY' ? <CheckCircle2 size={18} /> : <Loader2 className="animate-spin" size={18} />}
          {status === 'READY' ? 'Conectado' : 'Processando'}
        </div>
      </div>

      {/* ÁREA CENTRAL */}
      {status !== 'READY' && (
        <div className="bg-white p-10 rounded-2xl shadow-lg border border-slate-100 text-center">
          
          {/* AVISO DE VALIDAÇÃO / GERAÇÃO */}
          {(status === 'CONNECTING' || (status === 'DISCONNECTED' && !qrCode)) && (
            <div className="space-y-6 py-10">
              <div className="relative flex justify-center">
                <RefreshCw className="animate-spin text-blue-600 opacity-20" size={120} />
                <Loader2 className="animate-spin text-blue-500 absolute top-1/3" size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-800 animate-pulse uppercase tracking-tighter">
                  {status === 'CONNECTING' ? 'Validando Sessão...' : 'Gerando QR Code...'}
                </h2>
                <p className="text-slate-500 max-w-xs mx-auto">
                  Aguarde enquanto o sistema prepara os motores de conexão.
                </p>
              </div>
            </div>
          )}

          {/* QR CODE PRONTO */}
          {qrCode && status === 'QR_READY' && (
            <div className="space-y-6">
              <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-sm font-bold border border-amber-100">
                ⚠️ NENHUMA SESSÃO ATIVA. ESCANEIE AGORA:
              </div>
              <div className="inline-block p-4 bg-slate-50 rounded-3xl border-4 border-white shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`}
                  alt="QR Code"
                  className="rounded-xl shadow-sm"
                />
              </div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">
                Aparelhos Conectados {'>'} Conectar um Aparelho
              </p>
            </div>
          )}
        </div>
      )}

      {/* FORMULÁRIO DE ENVIO (SÓ READY) */}
      {status === 'READY' && (
        <form onSubmit={handleSendMessage} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <Smartphone size={16} /> WhatsApp do Destinatário
              </label>
              <input
                type="text"
                placeholder="5547991234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none transition-all min-h-[150px]"
                placeholder="Digite sua mensagem de agência aqui..."
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            ENVIAR AGORA
          </button>
        </form>
      )}

      {backendOffline && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center justify-center gap-2 font-bold border border-red-100">
          <AlertCircle size={20} /> ENGINE OFFLINE - VERIFIQUE A RAILWAY
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;