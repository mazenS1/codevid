import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as themes from "react-syntax-highlighter/dist/esm/styles/prism";

const sampleCodes = {
  javascript: `function greeting(name) {
  // Say hello to the user
  return \`Hello, \${name}!\`;
}

// Call the function
console.log(greeting("World"));`,
  python: `def greeting(name):
    # Say hello to the user
    return f"Hello, {name}!"

# Call the function
print(greeting("World"))`,
  java: `public class Greeting {
    public static String greeting(String name) {
        // Say hello to the user
        return "Hello, " + name + "!";
    }

    public static void main(String[] args) {
        System.out.println(greeting("World"));
    }
}`,
  cpp: `#include <iostream>
#include <string>

std::string greeting(std::string name) {
    // Say hello to the user
    return "Hello, " + name + "!";
}

int main() {
    std::cout << greeting("World") << std::endl;
    return 0;
}`,
};

const CodePreview = ({ theme = "dracula", language = "javascript" }) => {
  return (
    <>
      <div className="mt-4"></div>
      <h2 className="text-xl font-semibold mb-2">Theme Preview</h2>
      <SyntaxHighlighter
        language={language}
        style={themes[theme]}
        className="rounded-lg"
      >
        {sampleCodes[language]}
      </SyntaxHighlighter>
    </>
  );
};

export default CodePreview;
