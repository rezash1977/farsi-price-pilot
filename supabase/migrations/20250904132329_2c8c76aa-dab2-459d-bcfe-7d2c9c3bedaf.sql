-- Add missing RLS policy for whatsapp_sessions DELETE operation
-- This ensures users can only delete their own sessions
CREATE POLICY "Users can delete their own sessions" 
ON public.whatsapp_sessions 
FOR DELETE 
USING ((auth.uid())::text = (user_id)::text);

-- Add RLS policy for ocr_extracted_prices table
-- This ensures users can only access data in their organization
ALTER TABLE public.ocr_extracted_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access data in their org" 
ON public.ocr_extracted_prices 
FOR ALL 
USING (org_id IN ( 
  SELECT profiles.org_id
  FROM profiles
  WHERE (profiles.id = auth.uid())
));