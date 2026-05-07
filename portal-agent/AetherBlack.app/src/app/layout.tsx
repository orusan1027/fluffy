import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherBlack — Revenue Check",
  description: "DMM・Fab.com 収益確認ダッシュボード",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-aether-bg antialiased">{children}</body>
    </html>
  );
}
