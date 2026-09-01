export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-jab-panel-2 ${className}`} />;
}

/** Misma forma que <Sidebar>, para que loading.tsx no genere un salto de
 * layout mientras se resuelve la consulta real de tenant/perfil. */
export function SidebarSkeleton() {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-jab-bg-deep border-r border-jab-border">
      <div className="p-5">
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="px-5 pb-5 border-b border-jab-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex-1 px-3 py-4 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 mx-2" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 mx-2" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      </div>
      <div className="p-4 border-t border-jab-border flex items-center gap-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </aside>
  );
}
