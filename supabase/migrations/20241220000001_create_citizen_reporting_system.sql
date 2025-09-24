CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin', 'staff')),
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  department TEXT,
  priority_level INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'submitted',
  priority TEXT DEFAULT 'medium',
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_address TEXT,
  reporter_name TEXT,
  reporter_email TEXT,
  reporter_phone TEXT,
  assigned_to TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  updated_by_name TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('report_submitted', 'status_update', 'assignment', 'resolution', 'feedback_request')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  push_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id),
  report_id UUID REFERENCES public.reports(id),
  department TEXT,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.categories (name, description, icon, color, department, priority_level) VALUES
('Roads & Infrastructure', 'Potholes, road damage, traffic signals', '🛣️', '#f97316', 'Public Works', 3),
('Street Lighting', 'Broken lights, dark areas, electrical issues', '💡', '#eab308', 'Utilities', 2),
('Sanitation & Waste', 'Garbage collection, littering, cleanliness', '🗑️', '#ef4444', 'Sanitation', 3),
('Water & Drainage', 'Water leaks, drainage issues, flooding', '💧', '#3b82f6', 'Water Department', 4),
('Parks & Recreation', 'Park maintenance, playground issues', '🌳', '#22c55e', 'Parks', 2),
('Public Safety', 'Safety hazards, security concerns', '🚨', '#dc2626', 'Safety', 5),
('Noise Pollution', 'Excessive noise, construction disturbances', '🔊', '#8b5cf6', 'Environmental', 2),
('Other', 'General civic issues not covered above', '📝', '#6b7280', 'General', 1);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);

alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.report_updates;
alter publication supabase_realtime add table public.report_media;