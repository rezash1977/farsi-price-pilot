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
    // Initialize Puppeteer
    const puppeteer = await import('https://deno.land/x/puppeteer@16.2.0/mod.ts')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    const page = await browser.newPage()
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // Navigate to WhatsApp Web
    console.log('Navigating to WhatsApp Web...')
    await page.goto('https://web.whatsapp.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    })

    // Wait for QR code to appear
    console.log('Waiting for QR code...')
    const qrCodeSelector = 'canvas[aria-label="Scan me!"]'
    await page.waitForSelector(qrCodeSelector, { timeout: 30000 })

    // Get QR code as base64
    const qrCodeElement = await page.$(qrCodeSelector)
    const qrCodeBase64 = await qrCodeElement?.screenshot({ encoding: 'base64' })
    
    if (!qrCodeBase64) {
      throw new Error('Failed to capture QR code')
    }

    const qrCodeDataUrl = `data:image/png;base64,${qrCodeBase64}`

    // Store session in Supabase
    const { error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        session_id,
        user_id,
        qr_code: qrCodeDataUrl,
        connected: false,
        status: 'waiting_for_scan',
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Database error:', error)
    }

    // Keep checking for connection in background
    checkConnectionInBackground(browser, page, session_id, supabase)

    return new Response(
      JSON.stringify({ 
        session_id,
        qr_code: qrCodeDataUrl,
        status: 'waiting_for_scan'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Puppeteer error:', error)
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

async function checkConnectionInBackground(browser: any, page: any, session_id: string, supabase: any) {
  try {
    // Wait for connection (when QR code disappears and chat interface appears)
    await Promise.race([
      page.waitForSelector('div[data-testid="chat-list"]', { timeout: 120000 }),
      page.waitForSelector('div[title="Chats"]', { timeout: 120000 })
    ])

    console.log('WhatsApp connected successfully')

    // Get phone number if available
    let phone_number = null
    try {
      const profileElement = await page.$('span[title*="+"]')
      if (profileElement) {
        phone_number = await page.evaluate(el => el.textContent, profileElement)
      }
    } catch (e) {
      console.log('Could not extract phone number')
    }

    // Update session as connected
    await supabase
      .from('whatsapp_sessions')
      .update({
        connected: true,
        phone_number,
        status: 'connected',
        connected_at: new Date().toISOString()
      })
      .eq('session_id', session_id)

    // Keep browser alive for future operations
    // In production, you'd want to implement proper session management
    
  } catch (error) {
    console.error('Connection check failed:', error)
    
    await supabase
      .from('whatsapp_sessions')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('session_id', session_id)
  } finally {
    // Close browser after some time or when session expires
    setTimeout(async () => {
      await browser.close()
    }, 1800000) // 30 minutes
  }
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
