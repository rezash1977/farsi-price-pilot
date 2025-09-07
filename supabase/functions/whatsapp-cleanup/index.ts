import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting WhatsApp cleanup process...')

    // Clean up expired QR codes
    const { data: expiredQRs, error: qrError } = await supabase
      .rpc('cleanup_expired_qr_codes')

    if (qrError) {
      console.error('Error cleaning expired QR codes:', qrError)
      throw qrError
    }

    console.log(`Cleaned up ${expiredQRs || 0} expired QR codes`)

    // Clean up old disconnected sessions (older than 7 days)
    const { data: oldSessions, error: sessionsError } = await supabase
      .from('whatsapp_sessions')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('connected', false)

    if (sessionsError) {
      console.error('Error cleaning old sessions:', sessionsError)
      throw sessionsError
    }

    console.log(`Cleaned up ${oldSessions?.length || 0} old disconnected sessions`)

    // Clean up orphaned media files (optional)
    const { data: orphanedMedia, error: mediaError } = await supabase
      .from('media_files')
      .delete()
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('ocr_status', 'failed')

    if (mediaError) {
      console.error('Error cleaning orphaned media:', mediaError)
    } else {
      console.log(`Cleaned up ${orphanedMedia?.length || 0} failed media files`)
    }

    const summary = {
      expired_qr_codes: expiredQRs || 0,
      old_sessions: oldSessions?.length || 0,
      failed_media: orphanedMedia?.length || 0,
      timestamp: new Date().toISOString()
    }

    console.log('Cleanup completed:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        summary
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Cleanup failed',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})