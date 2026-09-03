'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarWhatsappCloud } from './actions';

export function WhatsappCloudConfigForm({
  phoneNumberIdInicial,
  tieneTokenGuardado,
  autoResponderInicial,
}: {
  phoneNumberIdInicial: string;
  /** No mandamos el token guardado al cliente — solo si hay uno cargado, para no pedirlo de nuevo sin querer. */
  tieneTokenGuardado: boolean;
  autoResponderInicial: boolean;
}) {
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState(phoneNumberIdInicial);
  const [accessToken, setAccessToken] = useState('');
  const [autoResponder, setAutoResponder] = useState(autoResponderInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setGuardado(false);
    startTransition(async () => {
      const res = await actualizarWhatsappCloud(phoneNumberId, accessToken, autoResponder);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setGuardado(true);
      setAccessToken('');
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 space-y-3">
      <div>
        <label className="text-xs text-jab-muted block mb-1" htmlFor="wa-phone-id">
          Phone Number ID (de Meta Developers → WhatsApp → Configuración de la API)
        </label>
        <input
          id="wa-phone-id"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="Ej: 109876543210987"
          className="w-full rounded-lg bg-jab-bg-deep border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
        />
      </div>
      <div>
        <label className="text-xs text-jab-muted block mb-1" htmlFor="wa-token">
          Token de acceso permanente
        </label>
        <input
          id="wa-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={tieneTokenGuardado ? 'Ya hay uno guardado — dejalo vacío para no cambiarlo' : 'Pegar el token'}
          className="w-full rounded-lg bg-jab-bg-deep border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-medium">Respuestas automáticas</p>
          <p className="text-xs text-jab-muted">
            El agente responde solo, sin que nadie revise el mensaje antes de mandarlo. Sin esto
            activado, solo sugiere borradores en Bandeja como hasta ahora.
          </p>
        </div>
        <button
          onClick={() => setAutoResponder((v) => !v)}
          aria-pressed={autoResponder}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            autoResponder ? 'bg-jab-lime' : 'bg-jab-bg-deep border border-jab-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              autoResponder ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          Guardar
        </button>
        {guardado && <p className="text-xs text-jab-lime">Guardado.</p>}
        {error && <p className="text-xs text-jab-red">{error}</p>}
      </div>
    </div>
  );
}
