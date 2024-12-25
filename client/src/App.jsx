import React, { useState } from "react";
import { CodeGeneratorForm } from "./components/CodeGeneratorForm";
import CodePreview from "./components/CodePreview";

function App() {
  const [selectedTheme, setSelectedTheme] = useState("dracula");

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Syntax Highlighted Video Generator
      </h1>
      <CodeGeneratorForm onThemeChange={setSelectedTheme} />
      <CodePreview theme={selectedTheme} />
    </div>
  );
}

export default App;
