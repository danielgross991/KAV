"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>משהו השתבש</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>נסה שוב</Button>
        </CardContent>
      </Card>
    </main>
  );
}
