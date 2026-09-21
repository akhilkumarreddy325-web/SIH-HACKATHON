-- ============================================================================
-- SafePath AI / NearMiss: Voice Hazard Reports Storage & Schema Migration
-- ============================================================================

-- 1. Ensure nullable audio_path column exists on hazard_reports
ALTER TABLE public.hazard_reports 
  ADD COLUMN IF NOT EXISTS audio_path text;

-- 2. Create private storage bucket for voice hazard reports
-- SECURITY ARCHITECTURE:
-- The bucket is set to private (public = false) so files cannot be scraped or
-- accessed directly via public unauthenticated CDN URLs.
-- File size is constrained to 10MB and restricted strictly to audio MIME types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hazard-report-audio',
  'hazard-report-audio',
  false, -- Private bucket: access controlled via Signed URLs
  10485760, -- 10 MB limit per audio recording
  ARRAY[
    'audio/m4a',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/aac',
    'audio/mpeg',
    'audio/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage Policies for 'hazard-report-audio' bucket

-- Uploads: Strictly restricted to the 'reports' folder
DROP POLICY IF EXISTS "hazard_audio_insert_policy" ON storage.objects;
CREATE POLICY "hazard_audio_insert_policy" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'hazard-report-audio'
    AND (storage.foldername(name))[1] = 'reports'
  );

-- Reading / Signed-URL Playback:
-- SECURITY LIMITATION NOTE (SIH Prototype):
-- This policy allows anon and authenticated clients to read objects in 'hazard-report-audio'
-- for the purpose of generating time-limited signed playback URLs via the Supabase client.
-- Because user authentication and object ownership (auth.uid()) have not yet been implemented
-- in this prototype, community voice recordings are accessible to any client with the report path.
-- This is intentional for crowdsourced community road safety in this prototype stage,
-- but does NOT provide per-user privacy.
DROP POLICY IF EXISTS "hazard_audio_select_policy" ON storage.objects;
CREATE POLICY "hazard_audio_select_policy" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'hazard-report-audio'
  );
