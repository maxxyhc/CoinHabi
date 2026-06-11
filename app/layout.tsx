import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Tracker",
  description: "A private portfolio tracker for crypto, Taiwan stocks, US stocks, and cash.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
