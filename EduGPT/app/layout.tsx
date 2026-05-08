import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduGPT",
  description: "An AI-powered academic tutor with a document-grounded RAG workflow."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
