import React, { useEffect, useMemo, useState, useRef } from "react";
import { FileText, TrendingUp, Award, Plus, Bell, Menu, X, MessageCircle, ThumbsUp, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import supabase from "@/lib/supabaseClient";
import appLogo from "/images/image.png";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  // Voting state
  const [userId, setUserId] = useState<string | null>(null);
  const [votesById, setVotesById] = useState<Record<string, number>>({});
  const [votedByMe, setVotedByMe] = useState<Record<string, boolean>>({});
  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<string>("other");
  const [age, setAge] = useState<string | number>("");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [localGender, setLocalGender] = useState<string>((user?.user_metadata?.gender as string) || "other");
  const [localAge, setLocalAge] = useState<string | number>((user?.user_metadata?.age as number) || "");
  const defaultAvatar = user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'user')}&radius=50&background=%23eef2ff`;
  const [selectedAvatar, setSelectedAvatar] = useState<string>(defaultAvatar);
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // ElevenLabs TTS state
  const [ttsText, setTtsText] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const elevenKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
  const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! I can help you report issues, track status, and learn how CivicSeva works.' }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  // Voice input (chat)
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [transcribing, setTranscribing] = useState(false);

  const transcribeWithElevenLabs = async (blob: Blob) => {
    if (!elevenKey) return;
    try {
      setTranscribing(true);
      const fd = new FormData();
      fd.append('file', new File([blob], 'audio.webm', { type: 'audio/webm' }));
      fd.append('model_id', 'scribe-v1');
      fd.append('language_code', lang === 'hi' ? 'hi' : 'en');
      const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': elevenKey },
        body: fd,
      });
      const data = await res.json();
      const text = data?.text || data?.transcript || '';
      if (text) setChatInput((prev) => (prev ? prev + ' ' : '') + String(text).trim());
    } catch {}
    finally { setTranscribing(false); }
  };

  const startVoice = async () => {
    if (listening) return;
    // Prefer ElevenLabs STT if key exists; else fallback to browser SR
    if (elevenKey) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          transcribeWithElevenLabs(blob);
        };
        setListening(true);
        mr.start();
      } catch {
        alert(t('stt_not_supported'));
      }
      return;
    }

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert(t('stt_not_supported')); return; }
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setChatInput((prev) => (prev ? prev + ' ' : '') + text.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stopVoice = () => {
    if (elevenKey) {
      try { mediaRecorderRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  // Avatar style & helpers
  const [avatarStyle, setAvatarStyle] = useState<'avataaars' | 'fun-emoji' | 'adventurer' | 'bottts-neutral'>('avataaars');
  const urlForSeed = (seed: string, style: 'avataaars' | 'fun-emoji' | 'adventurer' | 'bottts-neutral' = avatarStyle) => `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&background=%23eef2ff`;
  const getSuggestedSeeds = (gender: string, ageVal: number | null) => {
    const seedsByGender: Record<string, string[]> = {
      male: ["Liam", "Noah", "Aarav", "Arjun", "Leo", "Ethan"],
      female: ["Olivia", "Ava", "Mia", "Anaya", "Priya", "Sophia"],
      other: ["Alex", "Sam", "Taylor", "Casey", "Riley", "Jordan"],
    };
    const base = seedsByGender[gender] || seedsByGender.other;
    if (ageVal == null || Number.isNaN(ageVal)) return base;
    if (ageVal < 13) return ["Kiddo", "Sunny", "Panda", ...base.slice(0, 3)];
    if (ageVal < 20) return ["Skater", "Nova", "Pixel", ...base.slice(0, 3)];
    if (ageVal >= 60) return ["Grand", "Sage", "Elder", ...base.slice(0, 3)];
    return base;
  };

  // Call Gemini with conversation history
  const fetchGeminiReply = async (history: { role: 'user' | 'assistant'; content: string }[]) => {
    if (!geminiKey) return null;
    try {
      const contents = history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            system_instruction: {
              parts: [{
                text:
                  'You are CivicSeva, a helpful city assistant for reporting issues, tracking report status, and explaining app features. Be concise and actionable. When relevant, guide users to: Report New Issue, View My Reports, or provide their Report ID.'
              }]
            },
            generationConfig: { temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 512 }
          })
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || null;
      return text;
    } catch {
      return null;
    }
  };

  const handleSaveAvatar = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: selectedAvatar, gender: localGender, age: localAge }
    });
    if (!error) {
      setUser(data.user);
      setCustomizeOpen(false);
    } else {
      alert(t('failed_save_avatar'));
    }
  };

  const handleRandomAvatar = () => {
    const list = getSuggestedSeeds(localGender, parseInt(String(localAge)) || null);
    const seed = list[Math.floor(Math.random() * list.length)] || 'Explorer';
    setSelectedAvatar(urlForSeed(seed));
  };

  // Speak via ElevenLabs
  const speakText = async (text: string, voiceId: string = defaultVoiceId) => {
    if (!elevenKey || !text.trim()) return;
    try {
      setTtsLoading(true);
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}` ,{
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      // silently ignore
    } finally {
      setTtsLoading(false);
    }
  };

  // Very lightweight on-device assistant while API chat is pending
  const generateBotReply = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('report')) {
      return 'To report an issue: tap "Report New Issue", pick a category, add a photo and location, then submit. You will get a Report ID and can track it in Track Issues.';
    }
    if (lower.includes('track') || lower.includes('status')) {
      return 'You can track your reports via "View My Reports". Search by Report ID to see live status updates.';
    }
    if (lower.includes('hello') || lower.includes('hi')) {
      return 'Hello! How can I help you today? You can say "report a pothole" or "check status".';
    }
    if (lower.includes('voice') || lower.includes('audio')) {
      return 'Voice features are currently disabled.';
    }
    return 'Got it. You can ask me to help report an issue or check a report status. What would you like to do?';
  };

  const handleSendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg) return;
    const nextMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    // Instant local reply for responsiveness
    const localReply = generateBotReply(msg);
    setChatMessages((m) => [...m, { role: 'assistant', content: localReply }]);
    if (elevenKey) speakText(localReply);

    // Try Gemini in background and replace last assistant message if available
    if (geminiKey) {
      const ai = await fetchGeminiReply(nextMessages);
      if (ai) {
        setChatMessages((m) => {
          const copy = [...m];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant') { copy[i] = { role: 'assistant', content: ai }; break; }
          }
          return copy;
        });
        if (elevenKey) speakText(ai);
      }
    }

    setChatLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    // Auth: load current user and subscribe to changes
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUser(data.user || null);
        setUserId(data.user?.id || null);
      }
    })();
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      setUserId(session?.user?.id || null);
    });

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (!mounted) return;
      if (!error) setReports(data || []);
      setLoading(false);
    };

    fetchReports();

    const channel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        (payload) => {
          setReports((cur) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as any, ...cur];
            }
            if (payload.eventType === "UPDATE") {
              return cur.map((r) => (r.id === (payload.new as any).id ? (payload.new as any) : r));
            }
            if (payload.eventType === "DELETE") {
              return cur.filter((r) => r.id !== (payload.old as any).id);
            }
            return cur;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
      authSub?.subscription.unsubscribe();
    };
  }, []);

  // Fetch ONLY my notifications based on authenticated user email/phone
  useEffect(() => {
    let active = true;
    (async () => {
      const email = user?.email || null;
      const phone = (user as any)?.phone || null;
      if (!email && !phone) {
        setNotifications([]);
        return;
      }
      const base = supabase
        .from("report_updates")
        .select(`
          *,
          reports!inner(id,title,reporter_email,reporter_name,reporter_phone)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      const query = email
        ? base.eq("reports.reporter_email", email)
        : base.eq("reports.reporter_phone", phone as string);
      const { data, error } = await query;
      if (active && !error) setNotifications(data || []);
    })();
    return () => { active = false; };
  }, [user?.email, (user as any)?.phone]);

  // Refresh votes when reports or user changes
  useEffect(() => {
    const ids = reports.map((r) => r.id);
    if (!ids.length) return;
    (async () => {
      const { data } = await supabase
        .from("report_votes")
        .select("report_id,voter_id")
        .in("report_id", ids);
      const counts: Record<string, number> = {};
      const mine: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        counts[row.report_id] = (counts[row.report_id] || 0) + 1;
        if (userId && row.voter_id === userId) mine[row.report_id] = true;
      });
      setVotesById(counts);
      setVotedByMe(userId ? mine : {});
    })();
  }, [reports, userId]);

  const totals = useMemo(() => {
    const total = reports.length;
    const resolved = reports.filter((r) => (r.status || "").toLowerCase().includes("resolved") || (r.status || "").toLowerCase() === "closed").length;
    const inProgress = Math.max(total - resolved, 0);
    return { total, resolved, inProgress };
  }, [reports]);

  const recent = useMemo(() => reports.slice(0, 2), [reports]);

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; reports: number; resolved: number }>();
    for (const r of reports) {
      const key = (r.reporter_name || r.user_name || r.user_id || r.email || "").toString();
      if (!key) continue;
      const entry = map.get(key) || { name: key, reports: 0, resolved: 0 };
      entry.reports += 1;
      if ((r.status || "").toLowerCase().includes("resolved") || (r.status || "").toLowerCase() === "closed") entry.resolved += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.reports - a.reports).slice(0, 3);
  }, [reports]);

  const handleReportIssue = () => {
    navigate("/report");
  };

  const handleTrackIssues = () => {
    navigate("/track");
  };

  const handleCategorySelect = (category: string) => {
    navigate("/report", { state: { preselectedCategory: category.toLowerCase() } });
  };

  const unreadNotifications = notifications.filter(n => 
    new Date(n.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  const signInWithGoogle = async () => {
    const redirectTo = window.location !== window.parent.location
      ? 'https://ad06a98f-0b7c-43fd-aeb2-8590effe57aa.canvases.tempo.build'
      : window.location.origin;
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (data?.url) window.location.href = data.url;
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : t('signed_in_success'));
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { gender, age } }
    });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : t('check_email_confirm'));
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, data: { gender, age } }
    });
    setAuthLoading(false);
    setOtpSent(!error);
    setAuthMessage(error ? error.message : t('otp_sent'));
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otpToken,
      type: 'sms'
    });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : t('phone_verified_signed_in'));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const handleVoteRecent = async (reportId: string) => {
    if (!userId) {
      alert(t('please_sign_in_to_vote'));
      return;
    }
    const has = !!votedByMe[reportId];
    if (!has) {
      const { error } = await supabase.from("report_votes").insert({
        report_id: reportId,
        voter_id: userId,
        voter_email: user?.email || null,
      });
      if (error && error.code !== "23505") return alert(t('failed_vote'));
    } else {
      const { error } = await supabase
        .from("report_votes")
        .delete()
        .eq("report_id", reportId)
        .eq("voter_id", userId);
      if (error) return alert(t('failed_unvote'));
    }
    // refresh this one id
    const { count } = await supabase
      .from("report_votes")
      .select("*", { count: "exact", head: true })
      .eq("report_id", reportId);
    setVotesById((prev) => ({ ...prev, [reportId]: count || 0 }));
    setVotedByMe((prev) => ({ ...prev, [reportId]: !has }));
  };

  // Auto-send OTP when phone becomes a valid 10-digit number
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10 && !otpSent && !authLoading && lastPhoneSentRef.current !== digits) {
      lastPhoneSentRef.current = digits;
      (async () => {
        setAuthLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: { shouldCreateUser: true, data: { gender, age } }
        });
        setOtpSent(!error);
        setAuthMessage(error ? error.message : t('otp_sent'));
        setAuthLoading(false);
      })();
    }
  }, [phone, otpSent, authLoading, gender, age]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <div className="flex items-center gap-3">
                      <img src={appLogo} alt="CivicSeva logo" className="h-8 w-8 rounded-md" />
                      <SheetTitle className="text-foreground">CivicSeva</SheetTitle>
                    </div>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-left hover:bg-primary/10 hover:text-primary"
                      onClick={() => navigate("/")}
                    >
                      🏠 {t('menu_home')}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-left hover:bg-primary/10 hover:text-primary"
                      onClick={() => navigate("/report")}
                    >
                      📝 {t('menu_report_issue')}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-left hover:bg-primary/10 hover:text-primary"
                      onClick={() => navigate("/track")}
                    >
                      📊 {t('menu_track_reports')}
                    </Button>
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-600 mb-2">{t('account')}</p>
                      {!user ? (
                        <Tabs defaultValue="signin" className="w-full">
                          <TabsList className="grid grid-cols-3">
                            <TabsTrigger value="signin">{t('sign_in')}</TabsTrigger>
                            <TabsTrigger value="signup">{t('sign_up')}</TabsTrigger>
                            <TabsTrigger value="phone">{t('phone_otp')}</TabsTrigger>
                          </TabsList>
                          <TabsContent value="signin">
                            <form onSubmit={handleEmailSignIn} className="space-y-2 mt-3">
                              <div className="space-y-1">
                                <Label htmlFor="email">{t('email')}</Label>
                                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="password">{t('password')}</Label>
                                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                              </div>
                              <Button disabled={authLoading} className="w-full mt-1" type="submit">
                                {authLoading ? t('signing_in') : t('sign_in')}
                              </Button>
                              <div className="relative py-2 text-center text-xs text-gray-500">{t('or')}</div>
                              <Button variant="outline" className="w-full" type="button" onClick={signInWithGoogle}>
                                {t('continue_with_google')}
                              </Button>
                              {authMessage && <p className="text-xs text-gray-600 mt-2">{authMessage}</p>}
                            </form>
                          </TabsContent>
                          <TabsContent value="signup">
                            <form onSubmit={handleEmailSignUp} className="space-y-2 mt-3">
                              <div className="space-y-1">
                                <Label htmlFor="su-email">{t('email')}</Label>
                                <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="su-password">{t('password')}</Label>
                                <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                              </div>
                              <div className="space-y-1">
                                <Label>{t('gender')}</Label>
                                <Select value={gender} onValueChange={(v) => setGender(v)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('select_gender')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="male">{t('male')}</SelectItem>
                                    <SelectItem value="female">{t('female')}</SelectItem>
                                    <SelectItem value="other">{t('other')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="age">{t('age')}</Label>
                                <Input id="age" type="number" min={1} max={100} value={age} onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, "");
                                  const num = v ? Math.min(100, Math.max(1, parseInt(v))) : "";
                                  setAge(num as any);
                                }} required />
                              </div>
                              <Button disabled={authLoading} className="w-full mt-1" type="submit">
                                {authLoading ? t('creating_account') : t('create_account')}
                              </Button>
                              {authMessage && <p className="text-xs text-gray-600 mt-2">{authMessage}</p>}
                            </form>
                          </TabsContent>
                          <TabsContent value="phone">
                            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-2 mt-3">
                              <div className="space-y-1">
                                <Label htmlFor="phone">{t('mobile_number_with_country_code')}</Label>
                                <Input id="phone" type="tel" inputMode="numeric" pattern="[0-9]*" placeholder={t('phone_placeholder_example')} value={phone} onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                                  setPhone(v);
                                }} required />
                              </div>
                              {!otpSent && (
                                <>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label>Gender</Label>
                                      <Select value={gender} onValueChange={(v) => setGender(v)}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="male">Male</SelectItem>
                                          <SelectItem value="female">Female</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor="age2">Age</Label>
                                      <Input id="age2" type="number" min={1} max={100} value={age} onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, "");
                                        const num = v ? Math.min(100, Math.max(1, parseInt(v))) : "";
                                        setAge(num as any);
                                      }} required />
                                    </div>
                                  </div>
                                  <Button disabled={authLoading} className="w-full mt-1" type="submit">
                                    {authLoading ? t('sending') : t('send_otp')}
                                  </Button>
                                </>
                              )}
                              {otpSent && (
                                <>
                                  <div className="space-y-1">
                                    <Label htmlFor="otp">{t('enter_otp')}</Label>
                                    <Input id="otp" inputMode="numeric" pattern="[0-9]*" value={otpToken} onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
                                  </div>
                                  <Button disabled={authLoading} className="w-full mt-1" type="submit">
                                    {authLoading ? t('verifying') : t('verify_otp')}
                                  </Button>
                                </>
                              )}
                              {authMessage && <p className="text-xs text-gray-600 mt-2">{authMessage}</p>}
                            </form>
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user?.user_metadata?.avatar_url || defaultAvatar} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {(user?.email?.[0] || "U").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm text-gray-700 truncate flex-1">{user.email || t('signed_in_success')}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => setCustomizeOpen(true)}>{t('customize')}</Button>
                            <Button variant="outline" onClick={signOut}>{t('sign_out')}</Button>
                          </div>
                          <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>{t('customize_character')}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-16 w-16">
                                    <AvatarImage src={selectedAvatar} />
                                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                      {(user?.email?.[0] || "U").toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="grid grid-cols-2 gap-2 flex-1">
                                    <div className="space-y-1">
                                      <Label>Gender</Label>
                                      <Select value={localGender} onValueChange={(v) => setLocalGender(v)}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="male">Male</SelectItem>
                                          <SelectItem value="female">Female</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Age</Label>
                                      <Input type="number" min={1} max={100} value={localAge} onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, "");
                                        const num = v ? Math.min(100, Math.max(1, parseInt(v))) : "";
                                        setLocalAge(num as any);
                                      }} />
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label>Style</Label>
                                    <Select value={avatarStyle} onValueChange={(v) => setAvatarStyle(v as any)}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select style" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="avataaars">Avataaars</SelectItem>
                                        <SelectItem value="fun-emoji">Fun Emoji</SelectItem>
                                        <SelectItem value="adventurer">Adventurer</SelectItem>
                                        <SelectItem value="bottts-neutral">Bottts Neutral</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-2 flex items-end justify-end">
                                    <Button variant="outline" onClick={handleRandomAvatar}>{t('randomize')}</Button>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs text-muted-foreground mb-2">{t('suggestions')}</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    {getSuggestedSeeds(localGender, parseInt(String(localAge)) || null).map((seed) => (
                                      <button
                                        key={seed}
                                        type="button"
                                        onClick={() => setSelectedAvatar(urlForSeed(seed))}
                                        className={`rounded-md p-1 border ${selectedAvatar === urlForSeed(seed) ? 'border-primary' : 'border-transparent'} hover:border-primary/60 bg-white`}
                                      >
                                        <img src={urlForSeed(seed)} alt={seed} className="h-14 w-14" />
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" onClick={() => setCustomizeOpen(false)}>{t('cancel')}</Button>
                                  <Button onClick={handleSaveAvatar}>{t('save')}</Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  CivicSeva
                </h1>
                <p className="text-xs text-primary -mt-1">सिविक सेवा</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={lang} onValueChange={(v) => setLang(v as any)}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue placeholder="Lang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('lang_english')}</SelectItem>
                  <SelectItem value="hi">{t('lang_hindi')}</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500">
                        {unreadNotifications}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t('recent_updates')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">{t('no_recent_notifications')}</p>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {notification.reports?.title || t('report_update')}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {notification.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url || defaultAvatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(user?.email?.[0] || "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t('welcome_title')}
          </h2>
          <p className="text-muted-foreground">
            {t('welcome_subtitle')}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{loading ? "—" : totals.total}</div>
              <div className="text-xs text-primary/80">{t('total_reports')}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/10 border-secondary/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{loading ? "—" : totals.resolved}</div>
              <div className="text-xs text-muted-foreground">{t('resolved')}</div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{loading ? "—" : totals.inProgress}</div>
              <div className="text-xs text-destructive">{t('in_progress')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="space-y-4">
          {/* Report Issues Section */}
          <Card className="bg-primary text-primary-foreground border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                {t('report_issues')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-white/80 text-sm mb-4">
                {t('report_issues_subtitle')}
              </p>
              <Button
                onClick={handleReportIssue}
                variant="outline"
                className="w-full bg-white text-primary hover:bg-white hover:text-primary border border-primary/20"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('report_new_issue')}
              </Button>
            </CardContent>
          </Card>

          {/* Track Issues Section */}
          <Card className="bg-[hsl(var(--secondary))] text-secondary-foreground border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                {t('track_issues')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-white/80 text-sm mb-4">
                {t('track_issues_subtitle')}
              </p>
              <Button
                onClick={handleTrackIssues}
                className="w-full bg-white text-primary hover:bg-primary/10"
              >
                {t('view_my_reports')}
              </Button>
              <div className="mt-3 space-y-2">
                {recent.length === 0 && (
                  <div className="bg-white/20 rounded-lg p-3 text-sm">{t('no_recent_reports')}</div>
                )}
                {recent.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white/20 rounded-lg p-3 text-sm cursor-pointer hover:bg-white/30 transition-colors"
                    onClick={() => navigate("/track", { state: { reportId: report.id } })}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{report.title || report.category || `Report ${report.id}`}</p>
                        <p className="text-xs text-white/80">
                          {report.created_at ? new Date(report.created_at).toLocaleString() : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={votedByMe[report.id] ? "default" : "outline"}
                          onClick={(e) => { e.stopPropagation(); handleVoteRecent(report.id); }}
                          className="h-7 px-2"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Badge className="bg-white/30 text-white text-xs">
                          {(votesById[report.id] || 0)} {t('votes')}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-white/30 text-white text-xs"
                        >
                          {(report.status || "").toString() || "—"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard Section */}
          <Card className="bg-primary text-primary-foreground border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5" />
                {t('community_leaderboard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-white/80 text-sm mb-4">
                {t('leaderboard_subtitle')}
              </p>
              <div className="space-y-3">
                {leaderboard.length === 0 && (
                  <div className="bg-white/20 rounded-lg p-3 text-sm">{t('no_leaderboard')}</div>
                )}
                {leaderboard.map((user, index) => (
                  <div
                    key={user.name}
                    className="flex items-center gap-3 bg-white/20 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-white/30 rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-primary-foreground/80">
                        {user.reports} reports • {user.resolved} resolved
                      </p>
                    </div>
                    {index === 0 && (
                      <Award className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full mt-3 text-primary-foreground hover:bg-primary/20"
                  >
                    {t('view_full_leaderboard')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('community_leaderboard')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Array.from(new Map(reports.map(r => {
                      const key = r.reporter_name || "Anonymous";
                      return [key, {
                        name: key,
                        reports: reports.filter(rep => rep.reporter_name === key).length,
                        resolved: reports.filter(rep => rep.reporter_name === key && (rep.status === "resolved" || rep.status === "closed")).length
                      }];
                    })).values())
                    .sort((a, b) => b.reports - a.reports)
                    .map((user, index) => (
                      <div key={user.name} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-gray-600">
                            {user.reports} reports • {user.resolved} resolved • {Math.round((user.resolved / user.reports) * 100) || 0}% success rate
                          </p>
                        </div>
                        {index < 3 && (
                          <Award className={`h-5 w-5 text-primary`} />
                        )}
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Quick Categories */}
        <Card className="bg-white/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t('quick_categories')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: t('category_roads'), icon: "🛣️", category: "roads" },
                { name: t('category_lighting'), icon: "💡", category: "lighting" },
                { name: t('category_sanitation'), icon: "🗑️", category: "sanitation" },
                { name: t('category_water'), icon: "💧", category: "water" },
              ].map((category) => (
                <Button
                  key={category.name}
                  variant="ghost"
                  className={`bg-muted h-16 flex-col gap-1 hover:scale-105 transition-transform`}
                  onClick={() => handleCategorySelect(category.category)}
                >
                  <span className="text-xl">{category.icon}</span>
                  <span className="text-xs">{category.name}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Floating Chatbot Button */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogTrigger asChild>
          <button
            aria-label="Chatbot"
            className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('city_assistant')}</DialogTitle>
              <Button
                size="icon"
                variant="outline"
                aria-label={t('voice_input')}
                onClick={listening ? stopVoice : startVoice}
                className={listening ? 'bg-red-50 border-red-300' : ''}
              >
                {listening ? <Square className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-md p-3 h-56 overflow-auto bg-gray-50 text-sm">
              {chatMessages.map((m, i) => (
                <div key={i} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground border'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-gray-500">{t('assistant_typing')}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('type_message')}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); } }}
              />
              <Button
                size="icon"
                variant="outline"
                aria-label={t('voice_input')}
                onClick={listening ? stopVoice : startVoice}
                className={listening ? 'bg-red-50 border-red-300' : ''}
              >
                {listening ? <Square className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}>
                {t('send')}
              </Button>
            </div>
            {listening && (
              <div className="text-xs text-red-600">{t('listening')}</div>
            )}
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-medium">{t('tts_test')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('tts_placeholder')}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />
                <Button size="sm" variant="secondary" onClick={() => speakText(ttsText)} disabled={!elevenKey || ttsLoading || !ttsText.trim()}>
                  {ttsLoading ? t('tts_generating') : t('tts_speak')}
                </Button>
              </div>
              {ttsAudioUrl && (
                <audio className="w-full" controls src={ttsAudioUrl} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}