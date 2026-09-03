'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarRolMiembro } from './actions';
import type { UserRole } from '@/lib/supabase/types';

const OPCIONES: { value: UserRole; label: string }[] = [
  { value: 'client_admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
];

export function RolSelect({ userId, rolActual }: { userId: string; rolActual: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      defaultValue={rolActual}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await cambiarRolMiembro(userId, e.target.value as UserRole);
          router.refresh();
        })
      }
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
