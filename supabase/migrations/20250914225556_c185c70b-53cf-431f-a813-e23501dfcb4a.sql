-- Fix WhatsApp sessions RLS policies for better security and performance
-- Drop existing policies that use inefficient text casting
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.whatsapp_sessions;

-- Create improved RLS policies with proper UUID comparison and stricter security
CREATE POLICY "Users can view their own WhatsApp sessions"
ON public.whatsapp_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own WhatsApp sessions"
ON public.whatsapp_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WhatsApp sessions"
ON public.whatsapp_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WhatsApp sessions"
ON public.whatsapp_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Ensure RLS is enabled (should already be, but double-check)
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Add comment for security documentation
COMMENT ON TABLE public.whatsapp_sessions IS 'WhatsApp session data with RLS policies restricting access to session owners only. Contains encrypted phone numbers and session tokens.';