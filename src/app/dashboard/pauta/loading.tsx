import { Skeleton, SidebarSkeleton } from '@/components/skeleton';

export default function CargandoPauta() {
  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <SidebarSkeleton />
      <main className="flex-1 p-4 pb-24 lg:p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-52 rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-3">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </main>
    </div>
  );
}
