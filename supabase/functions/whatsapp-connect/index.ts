import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppSession {
  session_id: string
  qr_code?: string
  connected: boolean
  phone_number?: string
  user_id: string
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

    const { action, session_id, user_id } = await req.json()

    switch (action) {
      case 'generate_qr':
        return await generateQRCode(supabase, user_id)
      case 'check_status':
        return await checkConnectionStatus(supabase, session_id)
      case 'get_contacts':
        return await getContacts(supabase, session_id)
      case 'extract_messages':
        return await extractMessages(supabase, session_id, await req.json())
      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateQRCode(supabase: any, user_id: string) {
  const session_id = `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`Starting WhatsApp Web session for user: ${user_id}`)
  
  try {
    // Generate a mock QR code (since Puppeteer is not supported in edge functions)
    // In a real implementation, you would integrate with WhatsApp Business API
    const mockQRCode = generateMockQRCode()

    // Store session in Supabase
    const { error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        session_id,
        user_id,
        qr_code: mockQRCode,
        connected: false,
        status: 'waiting_for_scan',
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    // Simulate connection process in background
    simulateConnectionProcess(supabase, session_id)

    return new Response(
      JSON.stringify({ 
        session_id,
        qr_code: mockQRCode,
        status: 'waiting_for_scan'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('QR code generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate QR code',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

function generateMockQRCode(): string {
  // Generate a mock QR code using a simple pattern
  // This creates a basic QR-like pattern as base64
  const size = 200
  const canvas = new Array(size * size * 4).fill(255) // RGBA white background
  
  // Create a simple pattern
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const index = (i * size + j) * 4
      // Create a checkerboard-like pattern
      if ((i + j) % 20 < 10) {
        canvas[index] = 0     // R
        canvas[index + 1] = 0 // G  
        canvas[index + 2] = 0 // B
        canvas[index + 3] = 255 // A
      }
    }
  }
  
  // Convert to base64 (simplified mock)
  const mockBase64 = btoa(`mock-qr-code-${Date.now()}`)
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="white"/>
      <text x="100" y="100" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12">
        Mock QR Code
      </text>
      <text x="100" y="120" text-anchor="middle" dy=".3em" font-family="monospace" font-size="8">
        Scan with WhatsApp
      </text>
    </svg>
  `)}`
}

function simulateConnectionProcess(supabase: any, session_id: string) {
  // Simulate a WhatsApp connection after 5-10 seconds
  const connectionDelay = 5000 + Math.random() * 5000 // 5-10 seconds
  
  setTimeout(async () => {
    try {
      console.log(`Simulating connection for session: ${session_id}`)
      
      // Update session as connected
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          connected: true,
          phone_number: '+98912345678', // Mock phone number
          status: 'connected',
          connected_at: new Date().toISOString()
        })
        .eq('session_id', session_id)
        
      if (error) {
        console.error('Failed to update session:', error)
      } else {
        console.log(`Session ${session_id} marked as connected`)
      }
    } catch (error) {
      console.error('Connection simulation failed:', error)
      
      // Mark session as failed
      await supabase
        .from('whatsapp_sessions')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('session_id', session_id)
    }
  }, connectionDelay)
}

async function checkConnectionStatus(supabase: any, session_id: string) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('session_id', session_id)
    .single()

  if (error) {
    throw new Error('Session not found')
  }

  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function getContacts(supabase: any, session_id: string) {
  // This would integrate with the active browser session
  // For now, returning mock data
  const contacts = [
    {
      id: '1',
      name: 'فروشگاه موبایل پارس',
      phone_number: '+98912xxxxxxx',
      last_message: 'iPhone 15 Pro 256GB آبی تیتانیوم 48,500,000 تومان',
      last_activity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      unread_count: 2
    }
  ]

  return new Response(
    JSON.stringify({ contacts }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function extractMessages(supabase: any, session_id: string, params: any) {
  const { contact_id, date_from, date_to, org_id } = params
  
  // This would integrate with the active browser session to extract real messages
  // For now, returning mock data
  const messages = [
    {
      chat_id: `chat_${contact_id}_${Date.now()}`,
      org_id,
      sender: '+98912xxxxxxx',
      text: 'پیام استخراج شده واقعی از واتس‌اپ',
      has_media: false,
      timestamp: new Date().toISOString()
    }
  ]

  return new Response(
    JSON.stringify({ messages }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}
