import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PhasePlaceholder({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>נבנה בהמשך לאחר אימות של שלב התשתית.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          {description}
        </CardContent>
      </Card>
    </main>
  );
}
