import { Sarabun } from "next/font/google";

// Thai document font for the result documents, served by the app itself so
// screens, printouts and the master PDF files look the same everywhere (D021).
export const documentFont = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});
