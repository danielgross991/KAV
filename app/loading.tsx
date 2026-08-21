import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4">
      <Card className="w-full max-w-sm p-5">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-10 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-10 animate-pulse rounded bg-muted" />
      </Card>
    </main>
  );
}
