import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import appLogo from "/images/image.png";
import { useI18n } from "@/lib/i18n";

interface SplashProps {
  durationMs?: number;
  tagline?: string;
}

export default function SplashScreen({
  durationMs = 2200,
  tagline = "",
}: SplashProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tag = tagline || t("welcome_subtitle");

  // step-based media progression
  const steps = 3;
  const [step, setStep] = React.useState(0);
  const stepInterval = Math.max(500, Math.floor(durationMs / steps));

  useEffect(() => {
    const tmo = setTimeout(() => navigate("/"), durationMs);
    const iv = setInterval(
      () => setStep((s) => Math.min(s + 1, steps - 1)),
      stepInterval,
    );
    return () => {
      clearTimeout(tmo);
      clearInterval(iv);
    };
  }, [durationMs, navigate, stepInterval]);

  const media = [
    {
      alt: t("report_issues"),
      src: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pothole&size=512&backgroundColor=e0f2fe",
    },
    {
      alt: t("track_issues"),
      src: "https://api.dicebear.com/7.x/avataaars/svg?seed=Streetlight&size=512&backgroundColor=ecfdf5",
    },
    {
      alt: t("community_leaderboard"),
      src: "https://api.dicebear.com/7.x/avataaars/svg?seed=Community&size=512&backgroundColor=fef3c7",
    },
  ];

  return (
    <div className="bg-background text-foreground flex items-center justify-center p-6 relative w-[377.18135433938824px] h-[1001.9897954665357px]">
      {/* subtle background gradient blob */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center gap-5">
          <img
            src={appLogo}
            alt="App Logo"
            className="h-16 w-16 rounded-xl object-cover shadow animate-scale-in animate-pulse-glow"
          />

          {/* step media */}
          <div className="w-full">
            <div key={step} className="animate-scale-in">
              <img
                src={media[step].src}
                alt={media[step].alt}
                className="w-full h-36 object-cover rounded-xl shadow-md"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.src !== "/image.png") target.src = "/image.png";
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-1">
              {Array.from({ length: steps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>

          <h1 className="text-2xl font-bold animate-fade-in-up">CivicSeva</h1>
          <p
            className="text-sm text-muted-foreground animate-fade-in-up"
            style={{ animationDelay: "80ms" }}
          >
            {tag}
          </p>

          {/* progress */}
          <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(((step + 1) / steps) * 100)}%` }}
            />
          </div>

          <div className="mt-4 h-10 flex items-center justify-center">
            <div
              className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"
              aria-label="loading"
            />
          </div>
        </div>
      </div>
    </div>
  );
}