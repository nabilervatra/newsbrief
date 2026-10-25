import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "Newsbrief",
  description: "Search recent news and get AI summaries and sentiment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body className="bg-paper font-serif text-ink antialiased">{children}</body>
    </html>
  );
}
