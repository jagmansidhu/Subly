import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConnectionGraph - Visualize Your Network",
  description: "An Obsidian-style graph view for your professional connections with engagement heat mapping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
