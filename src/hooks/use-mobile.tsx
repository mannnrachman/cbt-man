import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // ponytail: SSR cannot detect viewport. We default to desktop (false) on SSR. Upgrade path: use CSS media queries instead of JS hooks for layout.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
