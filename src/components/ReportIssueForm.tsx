import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  MapPin,
  Mic,
  MicOff,
  Upload,
  X,
  Check,
  AlertCircle,
  Send,
  Square,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import supabase from "@/lib/supabaseClient";
import { useLocation } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";

interface ReportFormData {
  title: string;
  description: string;
  category: string;
  priority: string;
  location_lat?: number;
  location_lng?: number;
  location_address: string;
  reporter_name: string;
  reporter_email: string;
  reporter_phone: string;
}

const CATEGORIES = [
  {
    value: "roads",
    label: "Roads & Infrastructure",
    icon: "🛣️",
    dept: "Public Works",
  },
  {
    value: "lighting",
    label: "Street Lighting",
    icon: "💡",
    dept: "Utilities",
  },
  {
    value: "sanitation",
    label: "Sanitation & Waste",
    icon: "🗑️",
    dept: "Sanitation",
  },
  {
    value: "water",
    label: "Water & Drainage",
    icon: "💧",
    dept: "Water Department",
  },
  { value: "parks", label: "Parks & Recreation", icon: "🌳", dept: "Parks" },
  { value: "safety", label: "Public Safety", icon: "🚨", dept: "Safety" },
  {
    value: "noise",
    label: "Noise Pollution",
    icon: "🔊",
    dept: "Environmental",
  },
  { value: "other", label: "Other", icon: "📝", dept: "General" },
];

export default function ReportIssueForm({
  onSuccess = () => {},
}: {
  onSuccess?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const preselectedCategory = location.state?.preselectedCategory || "";

  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState<ReportFormData>({
    title: "",
    description: "",
    category: preselectedCategory,
    priority: "medium",
    location_address: "",
    reporter_name: "",
    reporter_email: "",
    reporter_phone: "",
  });

  // Prefill from auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data.user || null;
      setUser(u);
      if (u) {
        setFormData((prev) => ({
          ...prev,
          reporter_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || prev.reporter_name,
          reporter_email: u.email || prev.reporter_email,
        }));
      }
    })();
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        setFormData((prev) => ({
          ...prev,
          reporter_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || prev.reporter_name,
          reporter_email: u.email || prev.reporter_email,
        }));
      }
    });
    return () => authSub?.subscription.unsubscribe();
  }, []);

  const [photos, setPhotos] = useState<File[]>([]);
  // STT for title
  const titleRecognitionRef = useRef<any>(null);
  const [titleListening, setTitleListening] = useState(false);
  const titleMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const titleChunksRef = useRef<BlobPart[]>([]);

  // STT for description
  const descRecognitionRef = useRef<any>(null);
  const [descListening, setDescListening] = useState(false);
  const elevenKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
  const descMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const descChunksRef = useRef<BlobPart[]>([]);

  // Reverse geocode (Mapbox)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (!token) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=${lang === 'hi' ? 'hi' : 'en'}`
      );
      const data = await res.json();
      const place = data?.features?.[0]?.place_name as string | undefined;
      return place || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // STT (title) - ElevenLabs first, else browser SR
  const transcribeTitleWithElevenLabs = async (blob: Blob) => {
    if (!elevenKey) return;
    try {
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
      if (text) {
        setFormData((prev) => ({ ...prev, title: (prev.title ? prev.title + ' ' : '') + String(text).trim() }));
      }
    } catch {}
  };

  const startTitleVoice = async () => {
    if (titleListening) return;
    if (elevenKey) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        titleMediaRecorderRef.current = mr;
        titleChunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data?.size) titleChunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(titleChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          transcribeTitleWithElevenLabs(blob);
        };
        setTitleListening(true);
        mr.start();
      } catch {
        alert('Microphone not available');
      }
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const finalText = text.trim();
      if (finalText) {
        setFormData((prev) => ({ ...prev, title: (prev.title ? prev.title + ' ' : '') + finalText }));
      }
    };
    rec.onerror = () => setTitleListening(false);
    rec.onend = () => setTitleListening(false);
    titleRecognitionRef.current = rec;
    setTitleListening(true);
    rec.start();
  };
  const stopTitleVoice = () => {
    if (elevenKey) {
      try { titleMediaRecorderRef.current?.stop(); } catch {}
      setTitleListening(false);
      return;
    }
    try { titleRecognitionRef.current?.stop(); } catch {}
    setTitleListening(false);
  };

  // STT for description
  const transcribeDescWithElevenLabs = async (blob: Blob) => {
    if (!elevenKey) return;
    try {
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
      if (text) {
        setFormData((prev) => ({ ...prev, description: (prev.description ? prev.description + ' ' : '') + String(text).trim() }));
      }
    } catch {}
  };

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reportId, setReportId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Mapbox picker
  const pickerMapRef = useRef<mapboxgl.Map | null>(null);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const pickerMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!pickerContainerRef.current || pickerMapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const center = [
      typeof formData.location_lng === "number" ? formData.location_lng : 78.9629,
      typeof formData.location_lat === "number" ? formData.location_lat : 20.5937,
    ];
    const map = new mapboxgl.Map({
      container: pickerContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom:
        typeof formData.location_lat === "number" && typeof formData.location_lng === "number"
          ? 15
          : 4,
      pitch: 45,
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on("click", async (e) => {
      const { lng, lat } = e.lngLat;
      const address = await reverseGeocode(lat, lng);
      setFormData((prev) => ({
        ...prev,
        location_lat: lat,
        location_lng: lng,
        location_address: address,
      }));
    });
    pickerMapRef.current = map;
    return () => {
      map.remove();
      pickerMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = pickerMapRef.current;
    if (!map) return;
    if (typeof formData.location_lat === "number" && typeof formData.location_lng === "number") {
      if (!pickerMarkerRef.current) {
        pickerMarkerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
          .setLngLat([formData.location_lng, formData.location_lat])
          .addTo(map);
      } else {
        pickerMarkerRef.current.setLngLat([formData.location_lng, formData.location_lat]);
      }
      map.flyTo({ center: [formData.location_lng, formData.location_lat], zoom: 15, essential: true });
    }
  }, [formData.location_lat, formData.location_lng]);

  // Get current location
  const getCurrentLocation = async () => {
    setLocationStatus("loading");
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          });
        },
      );

      const { latitude, longitude } = position.coords;
      const address = await reverseGeocode(latitude, longitude);
      setFormData((prev) => ({
        ...prev,
        location_lat: latitude,
        location_lng: longitude,
        location_address: address,
      }));

      setLocationStatus("success");
    } catch (error) {
      setLocationStatus("error");
      setErrors((prev) => ({
        ...prev,
        location: "Unable to get location. Please enter manually.",
      }));
    }
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, camera: "Camera access denied" }));
    }
  };

  const stopCamera = () => {
    const video = videoRef.current;
    const stream = (video?.srcObject as MediaStream) || null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            setPhotos((prev) => [...prev, file]);
          }
        },
        "image/jpeg",
        0.8,
      );
      // keep camera running so user can take multiple photos
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      setErrors((prev) => ({ ...prev, audio: "Microphone access denied" }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);
  };

  // STT for description
  const startDescVoice = async () => {
    if (descListening) return;
    if (elevenKey) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        descMediaRecorderRef.current = mr;
        descChunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data?.size) descChunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(descChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          transcribeDescWithElevenLabs(blob);
        };
        setDescListening(true);
        mr.start();
      } catch {
        alert(t('stt_not_supported'));
      }
      return;
    }

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert(t('stt_not_supported')); return; }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const finalText = text.trim();
      if (finalText) {
        setFormData((prev) => ({ ...prev, description: (prev.description ? prev.description + ' ' : '') + finalText }));
      }
    };
    rec.onerror = () => setDescListening(false);
    rec.onend = () => setDescListening(false);
    descRecognitionRef.current = rec;
    setDescListening(true);
    rec.start();
  };
  const stopDescVoice = () => {
    if (elevenKey) {
      try { descMediaRecorderRef.current?.stop(); } catch {}
      setDescListening(false);
      return;
    }
    try { descRecognitionRef.current?.stop(); } catch {}
    setDescListening(false);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";

    // Only require contact info if not signed in
    if (!user) {
      if (!formData.reporter_name.trim()) newErrors.reporter_name = "Name is required";
      if (!formData.reporter_email.trim()) newErrors.reporter_email = "Email is required";
      if (formData.reporter_email && !/\S+@\S+\.\S+/.test(formData.reporter_email)) {
        newErrors.reporter_email = "Valid email is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form with better error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitProgress(10);

    try {
      // Simple duplicate check (last 12h)
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const emailForCheck = formData.reporter_email || '';
      if (emailForCheck) {
        const { data: dup } = await supabase
          .from('reports')
          .select('id,created_at')
          .eq('reporter_email', emailForCheck)
          .ilike('title', formData.title)
          .gte('created_at', since)
          .limit(1);
        if ((dup || []).length) {
          setErrors({ submit: 'Similar report recently submitted. Please avoid duplicate/spam submissions.' });
          setIsSubmitting(false);
          setSubmitProgress(0);
          return;
        }
      }

      // Test database connection first
      const { data: testData, error: testError } = await supabase
        .from("reports")
        .select("count")
        .limit(1);

      if (testError) {
        if (
          testError.message.includes("relation") ||
          testError.message.includes("does not exist")
        ) {
          throw new Error(
            "Database tables not set up. Please contact administrator to run database migration.",
          );
        }
        throw new Error(`Database connection error: ${testError.message}`);
      }

      setSubmitProgress(20);

      // Create report
      const reportData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        location_address: formData.location_address,
        reporter_name: formData.reporter_name,
        reporter_email: formData.reporter_email,
        reporter_phone: formData.reporter_phone,
        department:
          CATEGORIES.find((c) => c.value === formData.category)?.dept ||
          "General",
        status: "submitted",
      };

      const { data: report, error: reportError } = await supabase
        .from("reports")
        .insert([reportData])
        .select()
        .single();

      if (reportError) {
        console.error("Report creation error:", reportError);
        throw new Error(`Failed to create report: ${reportError.message}`);
      }

      setReportId(report.id);
      setSubmitProgress(50);

      // Upload media (images)
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        try {
          const path = `${report.id}/${Date.now()}_${i}_${file.name}`;
          const { data: up, error: upErr } = await supabase.storage
            .from('report-media')
            .upload(path, file, { contentType: file.type, upsert: true });
          let url = '';
          if (!upErr) {
            const { data: pub } = supabase.storage.from('report-media').getPublicUrl(path);
            url = pub.publicUrl;
          } else {
            // fallback: embed as data URL in DB
            const b64 = await new Promise<string>((resolve) => {
              const fr = new FileReader();
              fr.onloadend = () => resolve(String(fr.result));
              fr.readAsDataURL(file);
            });
            url = b64;
          }
          await supabase.from('report_media').insert({
            report_id: report.id,
            media_type: 'image',
            file_url: url,
            file_name: file.name,
          });
        } catch {}
      }

      // Upload voice (audio)
      if (audioBlob) {
        try {
          const path = `${report.id}/${Date.now()}_voice.webm`;
          const { error: upErr } = await supabase.storage
            .from('report-media')
            .upload(path, audioBlob, { contentType: 'audio/webm', upsert: true });
          let url = '';
          if (!upErr) {
            const { data: pub } = supabase.storage.from('report-media').getPublicUrl(path);
            url = pub.publicUrl;
          } else {
            const b64 = await new Promise<string>((resolve) => {
              const fr = new FileReader();
              fr.onloadend = () => resolve(String(fr.result));
              fr.readAsDataURL(audioBlob);
            });
            url = b64;
          }
          await supabase.from('report_media').insert({
            report_id: report.id,
            media_type: 'audio',
            file_url: url,
            file_name: 'voice.webm',
          });
        } catch {}
      }

      setSubmitProgress(80);

      // Create initial status update
      const { error: updateError } = await supabase
        .from("report_updates")
        .insert([
          {
            report_id: report.id,
            status: "submitted",
            message:
              "Report submitted successfully. We will review and acknowledge within 24 hours.",
            updated_by_name: "System",
            is_public: true,
          },
        ]);

      if (updateError) {
        console.error("Status update error:", updateError);
        // Continue even if status update fails
      }

      setSubmitProgress(100);

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error("Submission error:", error);
      setErrors({ submit: (error as Error).message });
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  // Auto-get location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  if (reportId && submitProgress === 100) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-900 mb-2">
              Report Submitted!
            </h2>
            <p className="text-green-700 mb-4">
              Your report has been successfully submitted with ID:{" "}
              <strong>{reportId.slice(0, 8)}</strong>
            </p>
            <Badge variant="secondary" className="mb-4">
              Status: Submitted
            </Badge>
            <p className="text-sm text-green-600 mb-6">
              You will receive updates via email and push notifications as your
              report progresses.
            </p>
            <Button onClick={onSuccess} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background w-[390px] h-[844px]">
      <div className="max-w-md mx-auto p-4">
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                aria-label="Back"
                className="-ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Send className="h-5 w-5" />
              {t('report_issues')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSubmitting && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  <span className="text-sm text-primary">
                    Submitting report...
                  </span>
                </div>
                <Progress value={submitProgress} className="h-2" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Title *
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Brief description of the issue"
                    className={errors.title ? "border-red-500" : ""}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={titleListening ? stopTitleVoice : startTitleVoice}
                    className={titleListening ? 'bg-red-50 border-red-300' : ''}
                    aria-label={t('voice_input')}
                  >
                    {titleListening ? <Square className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.title && (
                  <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                )}
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger
                    className={errors.category ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select issue category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-red-500 text-xs mt-1">{errors.category}</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={locationStatus === "loading"}
                    className="flex items-center gap-1"
                  >
                    <MapPin className="h-4 w-4" />
                    {locationStatus === "loading"
                      ? "Getting..."
                      : "Use Current"}
                  </Button>
                  {locationStatus === "success" && (
                    <Badge variant="secondary" className="text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Located
                    </Badge>
                  )}
                </div>
                <Input
                  value={formData.location_address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_address: e.target.value,
                    }))
                  }
                  placeholder="Enter address or description"
                />
                {errors.location && (
                  <p className="text-red-500 text-xs mt-1">{errors.location}</p>
                )}

                {/* Map preview & picker */}
                <div className="mt-2">
                  <div
                    ref={pickerContainerRef}
                    className="h-48 w-full rounded-md overflow-hidden border"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Tap the map to set the exact location.
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed description of the issue"
                  rows={3}
                  className={errors.description ? "border-red-500" : ""}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('voice_input')}</span>
                  <div className="flex items-center gap-2">
                    {descListening && (
                      <span className="text-xs text-red-600">{t('listening')}</span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={descListening ? stopDescVoice : startDescVoice}
                      className={descListening ? 'bg-red-50 border-red-300' : ''}
                    >
                      {descListening ? (
                        <>
                          <Square className="h-4 w-4 mr-2 text-red-600" /> Stop
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" /> Start
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {errors.description && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Evidence
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    className="flex flex-col items-center gap-1 h-16"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="text-xs">Camera</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 h-16"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-xs">Upload</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex flex-col items-center gap-1 h-16 ${isRecording ? "bg-red-50 border-red-300" : ""}`}
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4 text-red-600" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    <span className="text-xs">
                      {isRecording ? "Stop" : "Voice"}
                    </span>
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Camera view */}
                <div className={`${cameraActive ? 'block' : 'hidden'} mb-2`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg border"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" size="sm" onClick={capturePhoto}>
                      Capture Photo
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                      Stop Camera
                    </Button>
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />

                {/* Show captured photos */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-16 h-16 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0"
                          onClick={() =>
                            setPhotos((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show audio recording */}
                {audioBlob && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                    <Mic className="h-4 w-4 text-green-600" />
                    <audio controls src={URL.createObjectURL(audioBlob)} className="flex-1" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAudioBlob(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Reporter Information */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-medium text-gray-900">
                  Contact Information
                </h3>

                <div>
                  <Input
                    value={formData.reporter_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reporter_name: e.target.value,
                      }))
                    }
                    placeholder="Your full name *"
                    className={errors.reporter_name ? "border-red-500" : ""}
                    disabled={!!user}
                    readOnly={!!user}
                  />
                  {errors.reporter_name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.reporter_name}
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    type="email"
                    value={formData.reporter_email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reporter_email: e.target.value,
                      }))
                    }
                    placeholder="Your email address *"
                    className={errors.reporter_email ? "border-red-500" : ""}
                    disabled={!!user}
                    readOnly={!!user}
                  />
                  {errors.reporter_email && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.reporter_email}
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    type="tel"
                    value={formData.reporter_phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reporter_phone: e.target.value,
                      }))
                    }
                    placeholder="Your phone number (optional)"
                  />
                </div>
              </div>

              {/* Error Messages */}
              {errors.submit && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.submit}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary hover:opacity-90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('report_new_issue')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}