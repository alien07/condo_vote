import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";
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
  // Pages set their own language; this is the browser's chosen one (D020).
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;

  return (
    <html lang={isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
