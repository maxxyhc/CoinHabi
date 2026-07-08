import type { Metadata } from "next";
import { PortfolioApp } from "@/components/portfolio-app";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Coinhabi Demo",
};

export default function DemoPage() {
  return <PortfolioApp demo />;
}
