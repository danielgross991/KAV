import { Card, CardContent } from "@/components/ui/card";

export default function TeamLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 h-24 animate-pulse rounded-lg bg-muted" />
      <div className="mb-4 h-16 animate-pulse rounded-lg bg-muted" />
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-4 border-b p-4 last:border-b-0">
            {Array.from({ length: 5 }).map((__, cell) => (
              <div key={cell} className="h-5 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="grid gap-3 p-4">
              <div className="h-6 animate-pulse rounded bg-muted" />
              <div className="h-5 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
