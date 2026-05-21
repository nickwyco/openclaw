import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tempo — Agentic Growth Engine for Ecommerce",
  description:
    "Tempo studies your product and generates a weekly batch of Meta ad creative — persona angles, hooks, offers, and the reasoning behind every one.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0a0a0b",
          color: "#ededed",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </body>
    </html>
  );
}
