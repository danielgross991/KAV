import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kav-ordan.vercel.app"),
  title: "KAV",
  description: "ניהול צוותי מילואים, לו״ז ונוכחות",
  openGraph: {
    title: "KAV",
    description: "ניהול צוותי מילואים, לו״ז ונוכחות",
    siteName: "KAV",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KAV",
    description: "ניהול צוותי מילואים, לו״ז ונוכחות",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
