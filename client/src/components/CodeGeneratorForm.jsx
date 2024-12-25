import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export function CodeGeneratorForm({ onThemeChange }) {
  const [code, setCode] = useState('console.log("Hello, World!");');
  const [language, setLanguage] = useState("javascript");
  const [typingSpeed, setTypingSpeed] = useState(50);
  const [theme, setTheme] = useState("tomorrow");
  const [frameRate, setFrameRate] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const response = await fetch(
        "http://localhost:3000/generate-syntax-video",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            language,
            typingSpeed,
            theme,
            frameRate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate video");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (value) => {
    setTheme(value);
    onThemeChange(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              Code
            </label>
            <Textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your code here"
              required
              className="w-full rounded-lg"
            />
          </div>

          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium mb-1"
            >
              Language
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full rounded-lg">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="typingSpeed"
              className="block text-sm font-medium mb-1"
            >
              Typing Speed
            </label>
            <Slider
              id="typingSpeed"
              min={10}
              max={100}
              step={1}
              value={[typingSpeed]}
              onValueChange={(value) => setTypingSpeed(value[0])}
              className="mt-1"
            />
            <span className="text-sm text-muted-foreground">{typingSpeed}</span>
          </div>

          <div>
            <label htmlFor="theme" className="block text-sm font-medium mb-1">
              Theme
            </label>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full rounded-lg">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="okaidia">Okaidia</SelectItem>
                <SelectItem value="twilight">Twilight</SelectItem>
                <SelectItem value="coy">Coy</SelectItem>
                <SelectItem value="solarizedlight">Solarized Light</SelectItem>
                <SelectItem value="funky">Funky</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="frameRate"
              className="block text-sm font-medium mb-1"
            >
              Frame Rate
            </label>
            <Input
              type="number"
              id="frameRate"
              value={frameRate}
              onChange={(e) => setFrameRate(Number(e.target.value))}
              min={1}
              max={60}
              required
              className="w-full rounded-lg"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg"
          >
            {loading ? "Generating..." : "Generate Video"}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      {videoUrl && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Generated Video</h2>
          <video
            src={videoUrl}
            controls
            className="w-full max-w-2xl rounded-lg"
          />
          <Button
            onClick={() => window.open(videoUrl, "_blank")}
            className="mt-2 rounded-lg"
          >
            Download Video
          </Button>
        </div>
      )}
    </form>
  );
}
