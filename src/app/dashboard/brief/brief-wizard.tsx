'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarBrief, generarReporte } from './actions';
import { tiempoRelativo } from '@/lib/format';
import type { Database } from '@/lib/supabase/types';

type Brief = Database['public']['Tables']['onboarding_briefs']['Row'];
type CampoKey =
  | 'empresa_descripcion'
  | 'que_vende'
  | 'cliente_ideal'
  | 'competencia_diferencial'
  | 'objetivos'
  | 'notas';

const PASOS: { campo: CampoKey; emoji: string; titulo: string; placeholder: string; opcional?: boolean }[] = [
  {
    campo: 'empresa_descripcion',
    emoji: '🏢',
    titulo: '¿De qué se trata tu negocio?',
    placeholder: 'A qué se dedican, hace cuánto operan, en qué zona o mercado...',
  },
  {
    campo: 'que_vende',
    emoji: '🛍️',
    titulo: '¿Qué vende exactamente?',
    placeholder: 'Productos o servicios principales, precios de referencia, lo que más se vende...',
  },
  {
    campo: 'cliente_ideal',
    emoji: '🎯',
    titulo: '¿A quién le vende?',
    placeholder: 'Edad, zona, poder adquisitivo, qué problema le resuelve el negocio...',
  },
  {
    campo: 'competencia_diferencial',
    emoji: '⚔️',
    titulo: '¿Con quién compite y por qué te eligen a vos?',
    placeholder: 'Competidores directos, qué te hace diferente...',
  },
  {
    campo: 'objetivos',
    emoji: '🚀',
    titulo: '¿Qué querés lograr con JAB?',
    placeholder: 'Más leads, más ventas de un producto puntual, presencia de marca...',
  },
  {
    campo: 'notas',
    emoji: '📝',
    titulo: 'Algo más que debamos saber',
    placeholder: 'Cualquier otra cosa que el equipo tenga que saber para trabajar bien la cuenta.',
    opcional: true,
  },
];

function briefCompleto(brief: Brief | null): boolean {
  if (!brief) return false;
  return PASOS.filter((p) => !p.opcional).every((p) => (brief[p.campo] ?? '').trim().length > 0);
}

function ReporteBox({
  reporte,
  reporteGeneradoEn,
  iaConfigurada,
  soloLectura,
  onGenerar,
  generando,
  error,
}: {
  reporte: string | null;
  reporteGeneradoEn: string | null;
  iaConfigurada: boolean;
  soloLectura: boolean;
  onGenerar?: () => void;
  generando?: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Reporte de la cuenta</p>
        {!soloLectura && onGenerar && (
          <button
            type="button"
            disabled={generando || !iaConfigurada}
            onClick={onGenerar}
            className="rounded-full bg-jab-lime text-jab-lime-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40"
          >
            {generando ? 'Generando…' : reporte ? 'Regenerar' : 'Generar reporte'}
          </button>
        )}
      </div>
      {!iaConfigurada && !reporte && (
        <p className="text-xs text-jab-muted">La IA todavía no está configurada para esta cuenta.</p>
      )}
      {error && <p className="text-xs text-jab-red mb-2">{error}</p>}
      {reporte ? (
        <>
          <p className="text-sm whitespace-pre-wrap">{reporte}</p>
          {reporteGeneradoEn && (
            <p className="text-[11px] text-jab-muted mt-3">Generado {tiempoRelativo(reporteGeneradoEn)}</p>
          )}
        </>
      ) : (
        iaConfigurada &&
        !soloLectura && (
          <p className="text-xs text-jab-muted">
            Todavía no se generó. Tocá &quot;Generar reporte&quot; para armar un resumen automático a partir de
            las respuestas.
          </p>
        )
      )}
    </div>
  );
}

export function BriefWizard({
  brief,
  soloLectura,
  iaConfigurada,
}: {
  brief: Brief | null;
  soloLectura: boolean;
  iaConfigurada: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<'resumen' | 'wizard'>(briefCompleto(brief) ? 'resumen' : 'wizard');
  const [paso, setPaso] = useState(0);
  const [valores, setValores] = useState<Record<CampoKey, string>>(() =>
    Object.fromEntries(PASOS.map((p) => [p.campo, brief?.[p.campo] ?? ''])) as Record<CampoKey, string>,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [reporte, setReporte] = useState(brief?.reporte_ia ?? null);
  const [reporteGeneradoEn, setReporteGeneradoEn] = useState(brief?.reporte_generado_en ?? null);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);
  const [generandoReporte, startGenerandoReporte] = useTransition();

  function generar() {
    setErrorReporte(null);
    startGenerandoReporte(async () => {
      const res = await generarReporte();
      if (!res.ok) {
        setErrorReporte(res.error);
        return;
      }
      setReporte(res.texto);
      setReporteGeneradoEn(new Date().toISOString());
      router.refresh();
    });
  }

  if (soloLectura) {
    return (
      <div className="space-y-5">
        <div className="space-y-4">
          {PASOS.map((p) => {
            const valor = brief?.[p.campo];
            if (!valor?.trim()) return null;
            return (
              <div key={p.campo}>
                <p className="text-xs font-semibold tracking-widest text-jab-muted uppercase mb-1">
                  {p.emoji} {p.titulo}
                </p>
                <p className="text-sm whitespace-pre-wrap">{valor}</p>
              </div>
            );
          })}
          {!briefCompleto(brief) && (
            <p className="text-sm text-jab-muted">Todavía no se completó el brief de esta cuenta.</p>
          )}
        </div>
        {reporte && (
          <ReporteBox reporte={reporte} reporteGeneradoEn={reporteGeneradoEn} iaConfigurada={iaConfigurada} soloLectura />
        )}
      </div>
    );
  }

  if (modo === 'resumen') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Brief completado ✅</p>
            {brief?.updated_at && (
              <p className="text-xs text-jab-muted">Actualizado {tiempoRelativo(brief.updated_at)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setPaso(0);
              setModo('wizard');
            }}
            className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent"
          >
            Editar respuestas
          </button>
        </div>

        <ReporteBox
          reporte={reporte}
          reporteGeneradoEn={reporteGeneradoEn}
          iaConfigurada={iaConfigurada}
          soloLectura={false}
          onGenerar={generar}
          generando={generandoReporte}
          error={errorReporte}
        />
      </div>
    );
  }

  const actual = PASOS[paso];
  const esUltimo = paso === PASOS.length - 1;

  function guardarYAvanzar(siguiente: number | 'resumen') {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const p of PASOS) fd.set(p.campo, valores[p.campo]);
      const res = await guardarBrief(undefined, fd);
      if (res) {
        setError(res);
        return;
      }
      router.refresh();
      if (siguiente === 'resumen') setModo('resumen');
      else setPaso(siguiente);
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-jab-muted">
            Paso {paso + 1} de {PASOS.length}
          </p>
          {briefCompleto(brief) && (
            <button
              type="button"
              onClick={() => setModo('resumen')}
              className="text-xs text-jab-muted hover:text-jab-text underline"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {PASOS.map((p, i) => (
            <button
              key={p.campo}
              type="button"
              onClick={() => setPaso(i)}
              aria-label={`Ir al paso ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= paso ? 'bg-jab-lime' : 'bg-jab-panel-2'
              }`}
            />
          ))}
        </div>
      </div>

      <div key={actual.campo} className="space-y-2">
        <p className="text-3xl leading-none">{actual.emoji}</p>
        <label htmlFor={actual.campo} className="block text-base font-semibold">
          {actual.titulo}{' '}
          {actual.opcional && <span className="text-xs font-normal text-jab-muted">(opcional)</span>}
        </label>
        <textarea
          id={actual.campo}
          rows={4}
          autoFocus
          value={valores[actual.campo]}
          onChange={(e) => setValores((v) => ({ ...v, [actual.campo]: e.target.value }))}
          placeholder={actual.placeholder}
          className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2.5 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
        />
      </div>

      {error && <p className="text-sm text-jab-red">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={paso === 0 || pending}
          onClick={() => setPaso((p) => p - 1)}
          className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium disabled:opacity-30"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => guardarYAvanzar(esUltimo ? 'resumen' : paso + 1)}
          className="rounded-full bg-jab-lime text-jab-lime-ink px-5 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? 'Guardando…' : esUltimo ? 'Terminar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}
