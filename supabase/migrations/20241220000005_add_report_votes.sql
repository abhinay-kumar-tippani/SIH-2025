CREATE TABLE IF NOT EXISTS public.report_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  voter_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_votes_unique ON public.report_votes(report_id, voter_id);

alter publication supabase_realtime add table public.report_votes;