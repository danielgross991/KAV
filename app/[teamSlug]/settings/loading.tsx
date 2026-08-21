import { Card, CardContent } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 h-24 animate-pulse rounded-lg bg-muted" />
      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="grid gap-3 p-5">
              {Array.from({ length: 5 }).map((__, row) => (
                <div key={row} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
