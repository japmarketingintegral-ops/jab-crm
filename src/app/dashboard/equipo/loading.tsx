import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoEquipo() {
  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <SidebarSkeleton />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <Skeleton className="h-16 rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
