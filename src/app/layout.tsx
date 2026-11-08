import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Follow-up WhatsApp",
  description: "Disparo distribuído, prequalificação e simulação de cliente perdido",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
