import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Air Quality Node",
  description: "Indoor air quality monitoring dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
