import { useState, useEffect } from "react";
import { SECTION_IDS } from "@/components/constants";

export function useActiveSection(disabled: boolean) {
  const [activeSection, setActiveSection] = useState<string>("hero");

  useEffect(() => {
    if (disabled) return;

    const updateActive = () => {
      const headerEl = document.querySelector("header") as HTMLElement | null;
      const headerOffset = headerEl?.offsetHeight || 72;
      
      const sections = SECTION_IDS
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { id, top: rect.top };
        })
        .filter(Boolean) as Array<{ id: string; top: number }>;

      if (!sections.length) return;

      const above = sections.filter((s) => s.top <= headerOffset + 10);
      const activeId = above.length
        ? above.sort((a, b) => b.top - a.top)[0].id
        : sections.sort((a, b) => a.top - b.top)[0].id;

      setActiveSection(activeId);
    };

    updateActive();
    window.addEventListener("scroll", updateActive);
    window.addEventListener("resize", updateActive);

    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [disabled]);

  return activeSection;
}