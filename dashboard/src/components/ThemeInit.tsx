"use client";

import { useEffect } from "react";

export default function ThemeInit() {
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t && t !== "dark") {
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch {}
  }, []);
  return null;
}
