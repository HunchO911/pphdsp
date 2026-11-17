import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "PPHDSP – Privacy Preserving Health Data Sharing Platform",
  description: "Differential privacy demo for Nigerian health research",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
