import { Card, CardContent } from "@/components/ui/card";

export default function PersonLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-5 h-28 animate-pulse rounded-lg bg-muted" />
      <div className="mb-4 h-12 animate-pulse rounded-lg bg-muted" />
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
