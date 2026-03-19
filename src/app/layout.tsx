import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const sarabun = Sarabun({
  subsets: ['latin', 'thai'],
  weight: ['400', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Agents Room",
  description: "Multi-agent conversation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", sarabun.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
