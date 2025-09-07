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

    console.log('Starting WhatsApp session cleanup...')

    // Clean up expired QR codes using secure function
    const { data: expiredCount, error: expiredError } = await supabase.rpc('cleanup_expired_qr_codes')
    
    if (expiredError) {
      console.error('Error cleaning expired QR codes:', expiredError)
    } else {
      console.log(`Cleaned up ${expiredCount || 0} expired QR codes`)
    }

    // Clean up old disconnected sessions (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: deletedSessions, error: deleteError } = await supabase
      .from('whatsapp_sessions')
      .delete()
      .lt('created_at', sevenDaysAgo)
      .eq('connected', false)
      .select('count', { count: 'exact' })

    if (deleteError) {
      console.error('Error cleaning up old sessions:', deleteError)
    } else {
      console.log(`Cleaned up old disconnected sessions`)
    }

    // Return cleanup summary
    return new Response(
      JSON.stringify({ 
        success: true,
        expired_qr_codes_cleaned: expiredCount || 0,
        old_sessions_cleaned: true,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('WhatsApp cleanup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})