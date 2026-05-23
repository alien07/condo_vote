import type { Metadata } from "next";
import { APP_TITLE } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Online condominium meeting voting system",
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
