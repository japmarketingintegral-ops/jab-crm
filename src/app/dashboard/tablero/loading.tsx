import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoTablero() {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarSkeleton />
      <main className="flex-1 p-6 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="flex-1 overflow-x-auto flex gap-4">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="w-64 shrink-0 flex flex-col">
              <Skeleton className="h-7 w-full mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, card) => (
                  <div key={card} className="rounded-lg bg-jab-panel border border-jab-border p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
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
