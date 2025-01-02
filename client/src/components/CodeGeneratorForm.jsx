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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const API_BASE_URL =  process.env.REACT_APP_API_BASE_URL || "";

export function CodeGeneratorForm({ onThemeChange, onLanguageChange }) {
  const [code, setCode] = useState('console.log("Hello, World!");');
  const [language, setLanguage] = useState("javascript");
  const [typingSpeed, setTypingSpeed] = useState(150);
  const [theme, setTheme] = useState("tomorrow");
  const [frameRate, setFrameRate] = useState(30);
  const [selectedBackground, setselectedBackground] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadFeedback, setDownloadFeedback] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false);
  const [retryAfter, setRetryAfter] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setRateLimitExceeded(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/generate-syntax-video`,
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
            selectedBackground,
          }),
        }
      );
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        setRateLimitExceeded(true);
        setRetryAfter(6000);
        throw new Error(
          `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
        );
      }
      if (!response.ok) {
        throw new Error("Failed to generate video");
      }

      const data = await response.json();
      
      const videoId = data.downloadLink.split("/").pop();
      const streamUrl = `${API_BASE_URL}/api/stream-video/${videoId}`;
      setVideoUrl(streamUrl);
      
      setDownloadUrl(videoId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadFeedback(null);
    setIsDownloading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/download-video/${downloadUrl}`);
      if (!response.ok) throw new Error("Failed to get download URL");
      
      const data = await response.json();
      if (!data.downloadUrl) throw new Error("No download URL received");

      const link = document.createElement('a');
      link.href = `${API_BASE_URL}${data.downloadUrl}`;
      link.download = `code-animation-${downloadUrl}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadFeedback("Download started!");
    } catch (err) {
      setError("Failed to download video");
      setDownloadFeedback("Download failed.");
    } finally {
      setTimeout(() => setIsDownloading(false), 3000);
    }
  };

  const handleThemeChange = (value) => {
    setTheme(value);
    onThemeChange(value);
  };

  const handleLanguageChange = (value) => {
    setLanguage(value);
    onLanguageChange(value);
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
            <Select value={language} onValueChange={handleLanguageChange}>
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
              min={85}
              max={300}
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
            {frameRate > 30 && (
              <p className="text-yellow-500 text-sm mt-1">
                Note: Frame rates above 30 FPS will be capped at 30 FPS for optimal performance
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="selectedBackground"
              className="block text-sm font-medium mb-1"
            >
              Background Color
            </label>
            <Select
              value={selectedBackground}
              onValueChange={setselectedBackground}
            >
              <SelectTrigger className="w-full rounded-lg">
                <SelectValue placeholder="Select a background color (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                <SelectItem value="#000000">Black</SelectItem>
                <SelectItem value="#FFFFFF">White</SelectItem>
                <SelectItem value="#1A1A1A">Dark Gray</SelectItem>
                <SelectItem value="#F0F0F0">Light Gray</SelectItem>
                <SelectItem value="#0D1117">GitHub Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={loading || rateLimitExceeded}
            className="w-full rounded-lg"
          >
            {loading ? "Generating..." : "Generate Video"}
          </Button>
        </div>
      </div>

      {rateLimitExceeded && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rate Limit Exceeded</AlertTitle>
          <AlertDescription>
            Please try again in {retryAfter} seconds.
          </AlertDescription>
        </Alert>
      )}

      {error && !rateLimitExceeded && <p className="text-red-500 mt-4">{error}</p>}
      {videoUrl && (
        <div className="mt-4 space-y-4">
          <h2 className="text-lg font-semibold">Generated Video</h2>
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            className="w-full max-w-2xl rounded-lg"
            type="video/mp4"
          />
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={handleDownload}
              className="w-full md:w-auto"
              disabled={isDownloading}
            >
              {isDownloading ? "Downloading..." : "Download Video"}
            </Button>
          </div>
        </div>
      )}
      {downloadFeedback && (
        <p className="text-green-500 mt-4">{downloadFeedback}</p>
      )}
    </form>
  );
}
