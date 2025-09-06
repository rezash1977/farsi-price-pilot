import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// WhatsApp Web session manager
class WhatsAppWebSession {
  private sessionId: string
  private isConnected: boolean = false
  private qrCode: string | null = null
  private phoneNumber: string | null = null
  private websocket: WebSocket | null = null

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async initializeSession(): Promise<{ qrCode: string; status: string }> {
    try {
      // Initialize WhatsApp Web connection using WebSocket to whatsapp-web.js server
      // This would connect to a separate Node.js server running whatsapp-web.js
      const wsUrl = `wss://whatsapp-server.vercel.app/session/${this.sessionId}`
      
      return new Promise((resolve, reject) => {
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          console.log(`WhatsApp session ${this.sessionId} connection opened`)
          this.websocket?.send(JSON.stringify({ action: 'initialize' }))
        }

        this.websocket.onmessage = (event) => {
          const data = JSON.parse(event.data)
          console.log('Received from WhatsApp server:', data)

          switch (data.type) {
            case 'qr':
              this.qrCode = data.qr
              resolve({ qrCode: data.qr, status: 'waiting_for_scan' })
              break
            case 'ready':
              this.isConnected = true
              this.phoneNumber = data.phoneNumber
              break
            case 'authenticated':
              this.isConnected = true
              break
            case 'disconnected':
              this.isConnected = false
              break
            case 'auth_failure':
              reject(new Error('Authentication failed'))
              break
          }
        }

        this.websocket.onerror = (error) => {
          console.error('WhatsApp WebSocket error:', error)
          reject(error)
        }

        // Timeout after 30 seconds if no QR code received
        setTimeout(() => {
          if (!this.qrCode) {
            reject(new Error('QR code generation timeout'))
          }
        }, 30000)
      })
    } catch (error) {
      console.error('Failed to initialize WhatsApp session:', error)
      throw error
    }
  }

  async getContacts(): Promise<any[]> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('WhatsApp session not connected')
    }

    return new Promise((resolve, reject) => {
      this.websocket?.send(JSON.stringify({ action: 'getContacts' }))
      
      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        if (data.type === 'contacts') {
          this.websocket?.removeEventListener('message', handleMessage)
          resolve(data.contacts)
        }
      }

      this.websocket?.addEventListener('message', handleMessage)
      
      setTimeout(() => {
        this.websocket?.removeEventListener('message', handleMessage)
        reject(new Error('Get contacts timeout'))
      }, 10000)
    })
  }

  async extractMessages(contactId: string, dateFrom: string, dateTo: string): Promise<any[]> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('WhatsApp session not connected')
    }

    return new Promise((resolve, reject) => {
      this.websocket?.send(JSON.stringify({ 
        action: 'getMessages',
        contactId,
        dateFrom,
        dateTo
      }))
      
      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        if (data.type === 'messages') {
          this.websocket?.removeEventListener('message', handleMessage)
          resolve(data.messages)
        }
      }

      this.websocket?.addEventListener('message', handleMessage)
      
      setTimeout(() => {
        this.websocket?.removeEventListener('message', handleMessage)
        reject(new Error('Extract messages timeout'))
      }, 30000)
    })
  }

  getStatus() {
    return {
      connected: this.isConnected,
      phoneNumber: this.phoneNumber,
      qrCode: this.qrCode
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    this.isConnected = false
  }
}

// Store active sessions
const activeSessions = new Map<string, WhatsAppWebSession>()

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
  
  console.log(`Starting real WhatsApp Web session for user: ${user_id}`)
  
  try {
    // Create new WhatsApp session
    const whatsappSession = new WhatsAppWebSession(session_id)
    activeSessions.set(session_id, whatsappSession)

    // Initialize WhatsApp Web connection and get real QR code
    const { qrCode, status } = await whatsappSession.initializeSession()

    // Store session in Supabase with real QR code
    const { error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        session_id,
        user_id,
        qr_code: qrCode,
        connected: false,
        status: status,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Database error:', error)
      activeSessions.delete(session_id)
      throw error
    }

    console.log(`Real WhatsApp session ${session_id} created with QR code`)

    return new Response(
      JSON.stringify({ 
        session_id,
        qr_code: qrCode,
        status: status
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Real WhatsApp QR code generation error:', error)
    activeSessions.delete(session_id)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate real WhatsApp QR code',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

// Cleanup function for disconnected sessions
function cleanupSession(session_id: string) {
  const session = activeSessions.get(session_id)
  if (session) {
    session.disconnect()
    activeSessions.delete(session_id)
    console.log(`Cleaned up WhatsApp session: ${session_id}`)
  }
}

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  console.log('Cleaning up inactive WhatsApp sessions...')
  // In a real implementation, you'd check session activity and cleanup old ones
}, 30 * 60 * 1000)

async function checkConnectionStatus(supabase: any, session_id: string) {
  try {
    // Check active session status
    const whatsappSession = activeSessions.get(session_id)
    let realTimeStatus = null
    
    if (whatsappSession) {
      realTimeStatus = whatsappSession.getStatus()
      
      // Update database with real-time status
      if (realTimeStatus.connected) {
        await supabase
          .from('whatsapp_sessions')
          .update({
            connected: true,
            phone_number: realTimeStatus.phoneNumber,
            status: 'connected',
            connected_at: new Date().toISOString()
          })
          .eq('session_id', session_id)
      }
    }

    // Get stored session data
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (error) {
      throw new Error('Session not found')
    }

    // Merge real-time status with stored data
    const responseData = {
      ...data,
      ...(realTimeStatus && {
        connected: realTimeStatus.connected,
        phone_number: realTimeStatus.phoneNumber || data.phone_number
      })
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Check connection status error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function getContacts(supabase: any, session_id: string) {
  try {
    const whatsappSession = activeSessions.get(session_id)
    
    if (!whatsappSession) {
      throw new Error('WhatsApp session not found')
    }

    // Get real contacts from WhatsApp
    const realContacts = await whatsappSession.getContacts()
    
    // Transform WhatsApp contacts to our format
    const contacts = realContacts.map((contact: any) => ({
      id: contact.id._serialized || contact.id,
      name: contact.name || contact.pushname || contact.number,
      phone_number: contact.number,
      last_message: contact.lastMessage?.body || '',
      last_activity: contact.lastMessage?.timestamp ? 
        new Date(contact.lastMessage.timestamp * 1000).toISOString() : 
        new Date().toISOString(),
      unread_count: contact.unreadCount || 0,
      profile_pic: contact.profilePicUrl || null
    }))

    console.log(`Retrieved ${contacts.length} real contacts for session ${session_id}`)

    return new Response(
      JSON.stringify({ contacts }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Get real contacts error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get real contacts',
        details: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function extractMessages(supabase: any, session_id: string, params: any) {
  const { contact_id, date_from, date_to, org_id } = params
  
  try {
    const whatsappSession = activeSessions.get(session_id)
    
    if (!whatsappSession) {
      throw new Error('WhatsApp session not found')
    }

    console.log(`Extracting real messages for contact ${contact_id} from ${date_from} to ${date_to}`)
    
    // Get real messages from WhatsApp
    const realMessages = await whatsappSession.extractMessages(contact_id, date_from, date_to)
    
    // Transform and store messages
    const processedMessages = []
    
    for (const message of realMessages) {
      const messageData = {
        chat_id: contact_id,
        org_id,
        sender: message.from,
        text: message.body || '',
        has_media: message.hasMedia || false,
        timestamp: message.timestamp ? 
          new Date(message.timestamp * 1000).toISOString() : 
          new Date().toISOString()
      }

      // Store message in database
      const { data: savedMessage, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single()

      if (error) {
        console.error('Failed to save message:', error)
        continue
      }

      processedMessages.push(savedMessage)

      // Handle media files if present
      if (message.hasMedia) {
        try {
          const mediaData = await message.downloadMedia()
          if (mediaData) {
            // Store media file
            const mediaPath = `/media/${contact_id}_${Date.now()}.${mediaData.mimetype.split('/')[1]}`
            
            await supabase
              .from('media_files')
              .insert({
                org_id,
                message_id: savedMessage.id,
                storage_path: mediaPath,
                mime_type: mediaData.mimetype,
                ocr_status: 'queued'
              })
          }
        } catch (mediaError) {
          console.error('Failed to process media:', mediaError)
        }
      }
    }

    console.log(`Successfully extracted and stored ${processedMessages.length} real messages`)

    return new Response(
      JSON.stringify({ 
        messages: processedMessages,
        extracted_count: processedMessages.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Extract real messages error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to extract real messages',
        details: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}
