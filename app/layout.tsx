import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "NEXT",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEXT",
  },
  description: "Painel financeiro mobile-first para pequenos negócios.",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/nexis-icon.svg",
    shortcut: "/icons/nexis-icon.svg",
    apple: "/icons/nexis-icon.svg",
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "NEXT",
    template: "%s | NEXT",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#064e3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
