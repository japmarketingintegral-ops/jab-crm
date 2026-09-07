import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoMiTrabajo() {
  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <SidebarSkeleton />
      <main className="flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
        <Skeleton className="h-6 w-56 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
