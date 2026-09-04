'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarRolMiembro } from './actions';
import type { UserRole } from '@/lib/supabase/types';

const OPCIONES: { value: UserRole; label: string }[] = [
  { value: 'client_admin', label: 'Administrador' },
  { value: 'client_viewer', label: 'Solo lectura' },
];

export function RolSelect({
  userId,
  rolActual,
  nombre,
}: {
  userId: string;
  rolActual: string;
  nombre: string;
}) {
  const [rol, setRol] = useState(rolActual);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      value={rol}
      disabled={pending}
      onChange={(e) => {
        const nuevoRol = e.target.value as UserRole;
        const anterior = rol;
        const mensaje =
          nuevoRol === 'client_admin'
            ? `¿Convertir a ${nombre} en Administrador? Va a poder gestionar el equipo, integraciones y aprobar pedidos.`
            : `¿Pasar a ${nombre} a Solo lectura? Va a dejar de poder gestionar la cuenta, invitar gente o aprobar pedidos.`;
        if (!confirm(mensaje)) return;
        setRol(nuevoRol);
        startTransition(async () => {
          const res = await cambiarRolMiembro(userId, nuevoRol);
          if (res?.error) setRol(anterior);
          router.refresh();
        });
      }}
      className="text-xs rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1 outline-none focus:border-jab-accent disabled:opacity-50"
    >
      {OPCIONES.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
