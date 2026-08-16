import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Poppins se carga con next/font en vez de un @import en CSS: así se descarga junto
// con la página y no provoca el parpadeo de fuente al cargar.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Inmob Ads — Campañas de Meta para inmobiliarias",
  description:
    "Crea, publica y mide campañas de Facebook e Instagram para tus propiedades desde un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // La app usa tema oscuro fijo: la clase `dark` activa las variables de color
    // definidas en globals.css.
    <html lang="es" className={`${poppins.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
