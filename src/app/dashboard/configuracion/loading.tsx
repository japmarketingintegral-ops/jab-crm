import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoConfiguracion() {
  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <SidebarSkeleton />
      <main className="flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
        <div className="max-w-2xl space-y-8">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}
