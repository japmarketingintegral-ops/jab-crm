'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarBrief } from './actions';
import type { Database } from '@/lib/supabase/types';

type Brief = Database['public']['Tables']['onboarding_briefs']['Row'];

const CAMPOS: { name: keyof Brief; etiqueta: string; placeholder: string }[] = [
  {
    name: 'empresa_descripcion',
    etiqueta: 'La empresa',
    placeholder: 'A qué se dedican, hace cuánto operan, en qué zona o mercado...',
  },
  {
    name: 'que_vende',
    etiqueta: 'Qué vende',
    placeholder: 'Productos o servicios principales, precios de referencia, lo que más se vende...',
  },
  {
    name: 'cliente_ideal',
    etiqueta: 'Cliente ideal',
    placeholder: 'Edad, zona, poder adquisitivo, qué problema le resuelve el negocio...',
  },
  {
    name: 'objetivos',
    etiqueta: 'Objetivos con JAB',
    placeholder: 'Más leads, más ventas de un producto puntual, presencia de marca...',
  },
  {
    name: 'notas',
    etiqueta: 'Notas adicionales',
    placeholder: 'Cualquier otra cosa que el equipo tenga que saber para trabajar bien la cuenta.',
  },
];

export function BriefForm({ brief, soloLectura }: { brief: Brief | null; soloLectura: boolean }) {
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await guardarBrief(_prev, fd);
    if (res === undefined) router.refresh();
    return res;
  }, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {CAMPOS.map((campo) => (
        <div key={campo.name} className="space-y-1">
          <label
            htmlFor={campo.name}
            className="text-xs font-semibold tracking-widest text-jab-muted uppercase"
          >
            {campo.etiqueta}
          </label>
          <textarea
            id={campo.name}
            name={campo.name}
            rows={3}
            disabled={soloLectura}
            defaultValue={brief?.[campo.name] ?? ''}
            placeholder={campo.placeholder}
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent disabled:opacity-60"
          />
        </div>
      ))}

      {error && <p className="text-sm text-jab-red">{error}</p>}

      {!soloLectura && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar brief'}
        </button>
      )}
    </form>
  );
}
