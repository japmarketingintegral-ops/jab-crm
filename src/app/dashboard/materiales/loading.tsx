import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoMateriales() {
  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <SidebarSkeleton />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 flex flex-col min-w-0 overflow-y-auto">
        <Skeleton className="h-6 w-36 mb-6" />
        <Skeleton className="h-24 rounded-lg mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
