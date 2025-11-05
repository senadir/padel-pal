-- Create session_templates table
CREATE TABLE IF NOT EXISTS public.session_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on created_by for faster queries
CREATE INDEX idx_session_templates_created_by ON public.session_templates(created_by);

-- Enable RLS
ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_templates
-- Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON public.session_templates
  FOR SELECT
  USING (auth.uid() = created_by);

-- Users can create templates
CREATE POLICY "Users can create templates"
  ON public.session_templates
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON public.session_templates
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON public.session_templates
  FOR DELETE
  USING (auth.uid() = created_by);

-- Organizers can view all templates
CREATE POLICY "Organizers can view all templates"
  ON public.session_templates
  FOR SELECT
  USING ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');
