"use strict";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider enableSystem={false} {...props}>
      {children}
    </NextThemesProvider>
  );
}
