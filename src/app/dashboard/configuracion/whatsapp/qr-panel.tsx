'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Estado = 'desconectado' | 'esperando_qr' | 'conectado' | 'error';

type StatusResponse = { estado: Estado; numero: string | null; qr: string | null; error: string | null };

export function QrPanel({ inicial }: { inicial: StatusResponse }) {
  const router = useRouter();
  const [estado, setEstado] = useState(inicial);
  const [cargando, setCargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (estado.estado !== 'esperando_qr') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(async () => {
      const res = await fetch('/api/whatsapp/status');
      const data: StatusResponse = await res.json();
      setEstado(data);
      if (data.estado === 'conectado') router.refresh();
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [estado.estado, router]);

  async function conectar() {
    setCargando(true);
    setErrorLocal(null);
    const res = await fetch('/api/whatsapp/start', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      setCargando(false);
      setErrorLocal(data.error);
      return;
    }
    // El servicio todavía puede no haber escrito el QR — arranca el poll ya
    // mismo en vez de esperar esta primera consulta.
    setEstado({ estado: 'esperando_qr', numero: null, qr: null, error: null });
    setCargando(false);
  }

  async function desconectar() {
    setCargando(true);
    await fetch('/api/whatsapp/logout', { method: 'POST' });
    setEstado({ estado: 'desconectado', numero: null, qr: null, error: null });
    setCargando(false);
    router.refresh();
  }

  if (estado.estado === 'conectado') {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Conectado: <span className="font-medium">{estado.numero}</span>
        </p>
        <button
          onClick={desconectar}
          disabled={cargando}
          className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-red hover:border-jab-red disabled:opacity-50"
        >
          Desconectar
        </button>
      </div>
    );
  }

  if (estado.estado === 'esperando_qr' && estado.qr) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-jab-muted">
          Escaneá este código desde el celular del cliente: WhatsApp → Configuración →
          Dispositivos vinculados → Vincular un dispositivo.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={estado.qr}
          alt="Código QR de WhatsApp"
          className="w-56 h-56 rounded-lg border border-jab-border"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(errorLocal || estado.error) && (
        <p className="text-sm text-jab-red">{errorLocal ?? estado.error}</p>
      )}
      <button
        onClick={conectar}
        disabled={cargando}
        className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {cargando ? 'Generando código…' : 'Conectar WhatsApp'}
      </button>
    </div>
  );
}
