import type { Metadata } from "next";
import { PortfolioApp } from "@/components/portfolio-app";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Financial Tracker Demo",
};

export default function DemoPage() {
  return <PortfolioApp demo />;
}
