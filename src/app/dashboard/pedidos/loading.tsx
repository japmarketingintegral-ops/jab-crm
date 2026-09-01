import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoPedidos() {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarSkeleton />
      <main className="flex-1 p-6 flex flex-col min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto flex gap-4">
          {Array.from({ length: 4 }).map((_, col) => (
            <div key={col} className="w-64 shrink-0 flex flex-col">
              <Skeleton className="h-7 w-full mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, card) => (
                  <div key={card} className="rounded-lg bg-jab-panel border border-jab-border p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
