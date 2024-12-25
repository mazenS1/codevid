import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as themes from "react-syntax-highlighter/dist/esm/styles/prism";

const CodePreview = ({ theme = "dracula" }) => {
  const sampleCode = `function greeting(name) {
  // Say hello to the user
  return \`Hello, \${name}!\`;
}

// Call the function
console.log(greeting("World"));`;

  return (
    <>
      <div className="mt-4"></div>
      <h2 className="text-xl font-semibold mb-2">Theme Preview</h2>
      <SyntaxHighlighter
        language="javascript"
        style={themes[theme]}
        className="rounded-lg"
      >
        {sampleCode}
      </SyntaxHighlighter>
    </>
  );
};

export default CodePreview;
