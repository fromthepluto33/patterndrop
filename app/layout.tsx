import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { BridgeProvider } from "@/components/bridge-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PanelViewProvider } from "@/components/panel-view-provider";
import { HeaderControls } from "@/components/header-controls";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const appName = "Pattern Drop";

export const metadata: Metadata = {
  title: appName,
  description: "Онлайн-редактор бесшовных паттернов",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={cn("font-sans", inter.variable)}
    >
      <body className="antialiased min-h-screen bg-background flex flex-col">
        <BridgeProvider />
        <ThemeProvider>
          <PanelViewProvider>
            <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
              <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-lg font-semibold tracking-tight"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xl leading-none"
                    aria-hidden
                  >
                    🌀
                  </div>
                  {appName}
                </Link>
                <HeaderControls />
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </PanelViewProvider>
        </ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
