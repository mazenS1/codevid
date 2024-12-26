import React, { useState } from "react";
import { CodeGeneratorForm } from "./components/CodeGeneratorForm";
import CodePreview from "./components/CodePreview";
import { ThemeToggle } from "./components/theme-toggle";
import { ThemeProvider } from "./components/theme-provider";

function App() {
  const [selectedTheme, setSelectedTheme] = useState("dracula");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");

  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">
            Syntax Highlighted Video Generator
          </h1>
          <ThemeToggle />
        </div>
        <CodeGeneratorForm
          onThemeChange={setSelectedTheme}
          onLanguageChange={setSelectedLanguage}
        />
        <CodePreview theme={selectedTheme} language={selectedLanguage} />
      </div>
    </ThemeProvider>
  );
}

export default App;
