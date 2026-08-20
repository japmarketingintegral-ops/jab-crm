'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarConfigIA } from './actions';

export function IaConfigForm({
  habilitadaInicial,
  nombreInicial,
  personalidadInicial,
  iaConfigurada,
}: {
  habilitadaInicial: boolean;
  nombreInicial: string;
  personalidadInicial: string;
  /** false si falta ANTHROPIC_API_KEY en el servidor — la personalización
   * se puede dejar cargada igual, pero "Sugerir con IA" no va a andar. */
  iaConfigurada: boolean;
}) {
  const router = useRouter();
  const [habilitada, setHabilitada] = useState(habilitadaInicial);
  const [nombre, setNombre] = useState(nombreInicial);
  const [personalidad, setPersonalidad] = useState(personalidadInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setGuardado(false);
    startTransition(async () => {
      const res = await actualizarConfigIA(habilitada, nombre, personalidad);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setGuardado(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 space-y-3">
      {!iaConfigurada && (
        <p className="text-xs text-jab-amber bg-jab-amber/10 rounded-lg px-3 py-2">
          Todavía no se configuró la clave de IA del lado del servidor — podés dejar todo cargado,
          pero &quot;Sugerir con IA&quot; en Bandeja no va a funcionar hasta que se agregue.
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Sugerir respuestas con IA en Bandeja</p>
          <p className="text-xs text-jab-muted">
            Un botón para redactar un borrador de respuesta — la revisás y la mandás vos, nunca se
            envía sola.
          </p>
        </div>
        <button
          onClick={() => setHabilitada((v) => !v)}
          aria-pressed={habilitada}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            habilitada ? 'bg-jab-lime' : 'bg-jab-bg-deep border border-jab-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              habilitada ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {habilitada && (
        <>
          <div>
            <label className="text-xs text-jab-muted block mb-1" htmlFor="ia-nombre">
              Nombre del asistente (opcional)
            </label>
            <input
              id="ia-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Sofía"
              className="w-full rounded-lg bg-jab-bg-deep border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
            />
          </div>
          <div>
            <label className="text-xs text-jab-muted block mb-1" htmlFor="ia-personalidad">
              Cómo debe responder (tono, datos del negocio, promos vigentes, lo que no debe
              prometer)
            </label>
            <textarea
              id="ia-personalidad"
              value={personalidad}
              onChange={(e) => setPersonalidad(e.target.value)}
              rows={4}
              placeholder="Ej: Somos una inmobiliaria de Rosario. Trato cordial, tuteo. Nunca confirmar precios finales sin que un vendedor lo revise. Mencionar que hacemos tasaciones gratis si preguntan por vender."
              className="w-full rounded-lg bg-jab-bg-deep border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
            />
          </div>
        </>
      )}

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
