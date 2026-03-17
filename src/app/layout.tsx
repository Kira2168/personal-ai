import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import TopNav from "../components/top-nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const displaySerif = Playfair_Display({ variable: "--font-display-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kirubel Personal AI",
  description: "Kirubel Personal AI assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}>
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}