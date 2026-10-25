import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newsbrief",
  description: "Search recent news and get AI summaries and sentiment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
