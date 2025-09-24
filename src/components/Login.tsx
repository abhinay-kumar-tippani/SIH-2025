import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

interface Country {
  code: string;
  dial: string; // "+1"
  label: string;
}

const COUNTRIES: Country[] = [
  { code: "US", dial: "+1", label: "United States (+1)" },
  { code: "IN", dial: "+91", label: "India (+91)" },
  { code: "GB", dial: "+44", label: "United Kingdom (+44)" },
  { code: "CA", dial: "+1", label: "Canada (+1)" },
  { code: "AU", dial: "+61", label: "Australia (+61)" },
  { code: "SG", dial: "+65", label: "Singapore (+65)" },
  { code: "AE", dial: "+971", label: "UAE (+971)" },
];

const detectDefaultCountry = (): Country => {
  try {
    const lang = navigator.language || (navigator as any).userLanguage || "en-US";
    const region = (lang.split("-")[1] || "US").toUpperCase();
    const found = COUNTRIES.find((c) => c.code === region);
    return found || COUNTRIES[0];
  } catch {
    return COUNTRIES[0];
  }
};

const normalizePhone = (raw: string, dial: string): string => {
  let v = (raw || "").trim();
  // Remove spaces, dashes, parentheses
  v = v.replace(/[\s()-]/g, "");
  if (v.startsWith("+")) return v; // already E.164
  // Remove leading zeros
  v = v.replace(/^0+/, "");
  // Ensure dial starts with + and no trailing spaces
  const prefix = dial.startsWith("+") ? dial : `+${dial}`;
  return `${prefix}${v}`;
};

export default function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [country, setCountry] = useState<Country>(detectDefaultCountry());
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const lastSentRef = React.useRef<string>("");

  const e164 = useMemo(() => normalizePhone(phone, country.dial), [phone, country]);
  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const isPhoneValid = useMemo(() => phoneDigits.length === 10, [phoneDigits]);

  // Auto-send OTP when a valid 10-digit phone is entered
  useEffect(() => {
    if (step !== "phone" || loading) return;
    if (isPhoneValid && lastSentRef.current !== e164) {
      lastSentRef.current = e164;
      sendOtp();
    }
  }, [isPhoneValid, step, loading, e164]);

  useEffect(() => {
    setError("");
    setMessage("");
  }, [step]);

  const sendOtp = async () => {
    setLoading(true);
    setError("");

    if (!isPhoneValid) {
      setError(t('invalid_phone') || 'Enter a valid phone number');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: "sms", shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("otp");
      setMessage(t('otp_sent_check_phone'));
    } catch (err: any) {
      setError(t('failed_send_otp'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      if (data?.session) {
        setMessage(t('logged_in_success'));
        navigate("/");
      } else {
        setError(t('invalid_or_expired_code'));
      }
    } catch (err: any) {
      setError(t('verification_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-center">{t('login_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === "phone" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label htmlFor="country">{t('country')}</Label>
                    <Select
                      value={country.code}
                      onValueChange={(val) => {
                        const c = COUNTRIES.find((c) => c.code === val) || COUNTRIES[0];
                        setCountry(c);
                      }}
                    >
                      <SelectTrigger id="country">
                        <SelectValue placeholder={t('select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="phone">{t('phone_number')}</Label>
                    <div className="flex gap-2">
                      <div className="px-3 h-10 rounded-md bg-muted flex items-center text-sm">
                        {country.dial}
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        aria-invalid={!isPhoneValid && !!phone.trim()}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t('sms_send_to')} {e164}</p>
                    {!isPhoneValid && !!phone.trim() && (
                      <p className="text-xs text-red-600 mt-1">{t('invalid_phone') || 'Enter a valid phone number'}</p>
                    )}
                  </div>
                </div>
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
                {message && (
                  <div className="text-sm text-[hsl(var(--secondary))]">{message}</div>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={sendOtp} disabled={loading || !isPhoneValid}>
                    {loading ? t('sending') : t('send_otp')}
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/")}>{t('continue_guest')}</Button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="otp">{t('enter_otp')}</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('otp_placeholder')}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('sent_to')} {e164}</p>
                </div>
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
                {message && (
                  <div className="text-sm text-[hsl(var(--secondary))]">{message}</div>
                )}
                <div className="flex items-center gap-2">
                  <Button className="flex-1" onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                    {loading ? t('verifying') : t('verify_continue')}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep("phone")}>{t('edit_number')}</Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => sendOtp()} disabled={loading}>
                  {t('resend_otp')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}