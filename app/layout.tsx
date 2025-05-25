import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
// import { ThemeProvider } from "next-themes"; // Removed

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Investment Portfolio Analytics",
  description:
    "Query your investment portfolio database using natural language and visualize results with Next.js and AI SDK.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Retaining suppressHydrationWarning for now as it can be useful for other reasons too.
    // If issues arise or it's confirmed to be only for next-themes, we can remove it.
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* ThemeProvider removed */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
