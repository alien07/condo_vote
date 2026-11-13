import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { APP_TITLE } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Online condominium meeting voting system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Same rule as the pages: profile, then cookie, then Thai (D020).
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
