import React, { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Star,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import supabase from "@/lib/supabaseClient";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  location_address: string;
  reporter_name: string;
  reporter_email: string;
  reporter_phone: string;
  department: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

interface ReportUpdate {
  id: string;
  status: string;
  message: string;
  updated_by_name: string;
  is_public: boolean;
  created_at: string;
}

interface ReportMedia {
  id: string;
  media_type: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

const STATUS_CONFIG = {
  submitted: { label: "Submitted", color: "bg-blue-500", progress: 20 },
  acknowledged: { label: "Acknowledged", color: "bg-yellow-500", progress: 40 },
  in_progress: { label: "In Progress", color: "bg-orange-500", progress: 60 },
  resolved: { label: "Resolved", color: "bg-green-500", progress: 80 },
  closed: { label: "Closed", color: "bg-gray-500", progress: 100 },
  rejected: { label: "Rejected", color: "bg-red-500", progress: 100 },
};

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export default function ReportStatusTracker({
  reportId = "",
  onBack = () => {},
}: {
  reportId?: string;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const initialReportId = location.state?.reportId || reportId;

  const [searchId, setSearchId] = useState(initialReportId);
  const [report, setReport] = useState<Report | null>(null);
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [media, setMedia] = useState<ReportMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ rating: 0, comment: "" });
  const [showFeedback, setShowFeedback] = useState(false);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [votesCount, setVotesCount] = useState<number>(0);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [voting, setVoting] = useState<boolean>(false);

  // Auto-search if reportId is provided
  useEffect(() => {
    if (initialReportId && initialReportId.trim()) {
      fetchReport(initialReportId);
    }
  }, [initialReportId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || null;
      const uid = data.user?.id || null;
      if (!mounted) return;
      setUserEmail(email);
      setUserId(uid);
      if (email) {
        const { data: mine } = await supabase
          .from("reports")
          .select("*")
          .eq("reporter_email", email)
          .order("created_at", { ascending: false })
          .limit(25);
        if (mine) setMyReports(mine as Report[]);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email || null;
      const uid = session?.user?.id || null;
      setUserEmail(email);
      setUserId(uid);
      if (!email) setMyReports([]);
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  const fetchVotes = async (id: string, uid?: string | null) => {
    const { count } = await supabase
      .from("report_votes")
      .select("*", { count: "exact", head: true })
      .eq("report_id", id);
    setVotesCount(count || 0);
    if (uid) {
      const { data: v } = await supabase
        .from("report_votes")
        .select("id")
        .eq("report_id", id)
        .eq("voter_id", uid)
        .maybeSingle();
      setHasVoted(!!v);
    } else {
      setHasVoted(false);
    }
  };

  const fetchReport = async (id: string) => {
    if (!id.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .single();

      if (reportError || !reportData) {
        setError(t('report_not_found'));
        setReport(null);
        setUpdates([]);
        setMedia([]);
        setVotesCount(0);
        setHasVoted(false);
        return;
      }

      setReport(reportData);

      const { data: updatesData } = await supabase
        .from("report_updates")
        .select("*")
        .eq("report_id", id)
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      setUpdates(updatesData || []);

      const { data: mediaData } = await supabase
        .from("report_media")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: false });
      setMedia(mediaData || []);

      setShowFeedback(
        reportData.status === "resolved" || reportData.status === "closed",
      );

      await fetchVotes(id, userId);
    } catch (err) {
      setError(t('failed_fetch_report_details'));
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates (report, updates, and votes)
  useEffect(() => {
    if (!report) return;

    const channel = supabase
      .channel(`report-${report.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${report.id}` },
        (payload) => setReport(payload.new as Report),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_updates", filter: `report_id=eq.${report.id}` },
        (payload) => {
          const nu = payload.new as ReportUpdate;
          if (nu.is_public) setUpdates((prev) => [nu, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_votes", filter: `report_id=eq.${report.id}` },
        async () => {
          await fetchVotes(report.id, userId);
        },
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [report?.id, userId]);

  const handleVote = async () => {
    if (!report) return;
    if (!userId) {
      alert(t('please_sign_in_to_vote'));
      return;
    }
    setVoting(true);
    try {
      if (!hasVoted) {
        const { error } = await supabase.from("report_votes").insert({
          report_id: report.id,
          voter_id: userId,
          voter_email: userEmail,
        });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("report_votes")
          .delete()
          .eq("report_id", report.id)
          .eq("voter_id", userId);
        if (error) throw error;
      }
      await fetchVotes(report.id, userId);
    } catch (e) {
      alert(t('failed_update_vote'));
    } finally {
      setVoting(false);
    }
  };

  const submitFeedback = async () => {
    if (!report || feedback.rating === 0) return;

    try {
      await supabase
        .from("reports")
        .update({
          citizen_rating: feedback.rating,
          citizen_feedback: feedback.comment,
        })
        .eq("id", report.id);

      setShowFeedback(false);
      alert(t('thank_you_feedback'));
    } catch (error) {
      alert(t('failed_submit_feedback'));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(searchId);
  };

  const getStatusProgress = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.progress || 0;
  };

  const getStatusLabel = (status: string) => {
    return t(`status_${status}`);
  };

  const normalizeStatusKey = (status: string) => status.replace(/\s+/g, "_").toLowerCase();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getEstimatedResolution = (createdAt: string, priority: string) => {
    const created = new Date(createdAt);
    const daysToAdd =
      priority === "urgent"
        ? 1
        : priority === "high"
          ? 3
          : priority === "medium"
            ? 7
            : 14;
    const estimated = new Date(
      created.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
    );
    return estimated.toLocaleDateString();
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{t('track_reports')}</h1>
          <Button variant="outline" onClick={onBack}>{t('back')}</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('find_your_report')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={searchId || ""}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder={t('enter_report_id')}
              />
              <Button type="submit" disabled={loading}>{t('search')}</Button>
            </form>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </CardContent>
        </Card>

        {loading && (
          <div className="text-sm text-gray-600">{t('loading')}</div>
        )}

        {!loading && !report && (
          <div className="text-sm text-gray-700">
            {t('enter_report_id_help')}
          </div>
        )}

        {userEmail ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('my_reports')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myReports.length === 0 && (
                <p className="text-sm text-gray-600">{t('no_reports_yet')}</p>
              )}
              {myReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSearchId(r.id);
                    fetchReport(r.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-left p-3 rounded border hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.title || r.category || `Report ${r.id}`}</p>
                      <p className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('my_reports')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{t('sign_in_to_see_reports')}</p>
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            <Card className="bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{report.title || report.category || `Report ${report.id}`}</span>
                  <Badge className="capitalize">
                    {getStatusLabel(normalizeStatusKey(report.status || ""))}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={getStatusProgress(normalizeStatusKey(report.status || ""))} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {report.location_address || "—"}</div>
                  <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {report.created_at ? formatDate(report.created_at) : "—"}</div>
                  <div className="flex items-center gap-1"><User className="h-4 w-4" /> {report.reporter_name || "—"}</div>
                  <div className="flex items-center gap-1"><Mail className="h-4 w-4" /> {report.reporter_email || "—"}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs ${PRIORITY_COLORS[(report.priority || "medium") as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium}`}>
                    {t('priority_label')} {report.priority || "medium"}
                  </span>
                  <span className="text-xs text-gray-600">
                    {t('eta_label')} {report.created_at ? getEstimatedResolution(report.created_at, (report.priority || "medium").toLowerCase()) : "—"}
                  </span>
                  <Button size="sm" variant={hasVoted ? "default" : "outline"} onClick={handleVote} disabled={voting}>
                    {hasVoted ? t('voted') : t('upvote')}
                  </Button>
                  <Badge variant="secondary">{votesCount} {t('votes')}</Badge>
                  {votesCount >= 3 && (
                    <Badge className="bg-green-600 text-white">{t('community_verified')}</Badge>
                  )}
                </div>
                {report.description && (
                  <p className="text-sm text-gray-700">{report.description}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('updates')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {updates.length === 0 && (
                  <p className="text-sm text-gray-600">{t('no_updates_yet')}</p>
                )}
                {updates.map((u) => (
                  <div key={u.id} className="p-3 rounded bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{formatDate(u.created_at)}</span>
                      <Badge variant="secondary" className="capitalize">{u.status}</Badge>
                    </div>
                    <p className="text-sm mt-1">{u.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('attachments')}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {media.length === 0 && (
                  <p className="text-sm text-gray-600 col-span-2">{t('no_attachments')}</p>
                )}
                {media.map((m) => (
                  <div key={m.id} className="border rounded overflow-hidden">
                    {m.media_type?.startsWith("image") ? (
                      <img src={m.file_url} alt={m.file_name} className="w-full h-24 object-cover" />
                    ) : (
                      <a href={m.file_url} target="_blank" rel="noreferrer" className="block p-2 text-sm text-blue-600 underline">
                        {m.file_name || t('download')}
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {showFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('your_feedback')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFeedback((f) => ({ ...f, rating: n }))}
                        className={`p-1 ${feedback.rating >= n ? "text-yellow-500" : "text-gray-300"}`}
                        aria-label={`Rate ${n}`}
                      >
                        <Star className="h-5 w-5 fill-current" />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder={t('leave_comment_optional')}
                    value={feedback.comment}
                    onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))}
                  />
                  <Button onClick={submitFeedback} disabled={feedback.rating === 0}>{t('submit_feedback')}</Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}