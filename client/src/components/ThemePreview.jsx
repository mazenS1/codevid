import React, { useEffect, useRef } from "react";
// Import Prism core first
import Prism from "prismjs";
// Import CSS before language imports
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/themes/prism-dark.css";
import "prismjs/themes/prism-okaidia.css";
import "prismjs/themes/prism-twilight.css";
import "prismjs/themes/prism-coy.css";
import "prismjs/themes/prism-solarizedlight.css";
import "prismjs/themes/prism-funky.css";
// Then import languages
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-cpp";

export function ThemePreview({ code, language, theme }) {
  const preRef = useRef(null);

  useEffect(() => {
    // Ensure Prism is loaded
    if (window.Prism && preRef.current) {
      Prism.highlightElement(preRef.current);
    }
  }, [code, language, theme]);

  return (
    <pre
      ref={preRef}
      className={`language-${language}`}
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        maxHeight: "300px",
        overflowY: "auto",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}
