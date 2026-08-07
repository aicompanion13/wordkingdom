import type { Metadata } from "next";
import { Fredoka, Geist_Mono, Nunito_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const gameDisplay = Fredoka({ weight: "600", variable: "--font-game-display", subsets: ["latin"] });
const gameUi = Nunito_Sans({ variable: "--font-game-ui", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ?? requestHeaders.get("host") ?? "living-word-search.inspectorkush1.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() === "http" ? "http" : "https";
  let origin: URL;
  try { origin = new URL(`${protocol}://${host}`); }
  catch { origin = new URL("https://living-word-search.inspectorkush1.chatgpt.site"); }
  const title = "Word Kingdom: Spell & Steal — Find Words. Change Worlds.";
  const description = "A living word-search adventure across ocean, forest, space, ancient ruins, and the arctic. Spell words, steal momentum, and reshape the board with every discovery.";
  const socialImage = new URL("/og.png", origin).toString();
  return {
    metadataBase: origin,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: socialImage, width: 1802, height: 872, alt: "Word Kingdom: Spell & Steal young king, enchanted word board, castle raid, and gold coins" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${gameDisplay.variable} ${gameUi.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
