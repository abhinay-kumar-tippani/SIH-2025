import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface Slide {
  title: string;
  desc: string;
}

interface OnboardingProps {
  slides?: Slide[];
}

export default function Onboarding({
  slides = []
}: OnboardingProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  const localSlides: Slide[] = slides.length ? slides : [
    { title: t('report_issues'), desc: t('report_issues_subtitle') },
    { title: t('track_issues'), desc: t('track_issues_subtitle') },
    { title: t('community_leaderboard'), desc: t('leaderboard_subtitle') },
  ];

  const isLast = index === localSlides.length - 1;

  const illustrations = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Pothole&size=512&backgroundColor=e0f2fe',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Streetlight&size=512&backgroundColor=ecfdf5',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Community&size=512&backgroundColor=fef3c7',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-center">{t('welcome_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div key={index} className="text-center px-2 py-4 animate-fade-in-up">
              <div className="mb-4">
                <img
                  src={illustrations[index % illustrations.length]}
                  alt={localSlides[index].title}
                  className="w-full h-40 object-cover rounded-xl shadow-md animate-scale-in"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src !== "/image.png") target.src = "/image.png";
                  }}
                />
              </div>
              <h2 className="text-xl font-semibold">{localSlides[index].title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{localSlides[index].desc}</p>

              <div className="mt-6 flex items-center justify-center gap-2">
                {localSlides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-transform ${i === index ? "bg-primary scale-110" : "bg-muted"}`}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate("/")}>Skip</Button>
                {!isLast ? (
                  <Button className="animate-slide-in" onClick={() => setIndex((i) => Math.min(i + 1, localSlides.length - 1))}>
                    Next
                  </Button>
                ) : (
                  <Button className="animate-slide-in" onClick={() => navigate("/")}>Get Started</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}