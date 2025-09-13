const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode-terminal');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active WhatsApp clients
const clients = new Map();
const sessions = new Map();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.pathname.split('/')[2]; // /session/{sessionId}
  
  console.log(`New WebSocket connection for session: ${sessionId}`);
  
  if (!sessionId) {
    ws.close(1000, 'Session ID required');
    return;
  }

  // Store WebSocket connection
  sessions.set(sessionId, ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received message for session ${sessionId}:`, data);

      switch (data.action) {
        case 'initialize':
          await initializeWhatsAppClient(sessionId, ws);
          break;
        case 'getContacts':
          await getContacts(sessionId, ws);
          break;
        case 'getMessages':
          await getMessages(sessionId, ws, data);
          break;
        case 'sendMessage':
          await sendMessage(sessionId, ws, data);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for session: ${sessionId}`);
    sessions.delete(sessionId);
    
    // Cleanup client if exists
    const client = clients.get(sessionId);
    if (client) {
      client.destroy();
      clients.delete(sessionId);
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
  });
});

async function initializeWhatsAppClient(sessionId, ws) {
  try {
    // Create new WhatsApp client with session-specific auth
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    // Store client
    clients.set(sessionId, client);

    // Event handlers
    client.on('qr', (qr) => {
      console.log(`QR Code generated for session ${sessionId}`);
      
      // Generate QR code as base64 data URL
      const qrCodeDataURL = require('qrcode').toDataURL(qr, (err, url) => {
        if (err) {
          console.error('QR Code generation error:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to generate QR code' }));
          return;
        }
        
        ws.send(JSON.stringify({ 
          type: 'qr', 
          qr: url,
          sessionId: sessionId
        }));
      });
    });

    client.on('authenticated', () => {
      console.log(`WhatsApp authenticated for session ${sessionId}`);
      ws.send(JSON.stringify({ type: 'authenticated', sessionId: sessionId }));
    });

    client.on('ready', () => {
      console.log(`WhatsApp client ready for session ${sessionId}`);
      
      // Get phone number
      const number = client.info?.wid?.user;
      
      ws.send(JSON.stringify({ 
        type: 'ready', 
        sessionId: sessionId,
        phoneNumber: number ? `+${number}` : null,
        clientInfo: {
          pushname: client.info?.pushname,
          platform: client.info?.platform
        }
      }));
    });

    client.on('message', async (message) => {
      // Forward new messages to WebSocket
      ws.send(JSON.stringify({
        type: 'new_message',
        message: {
          id: message.id._serialized,
          from: message.from,
          to: message.to,
          body: message.body,
          timestamp: message.timestamp,
          hasMedia: message.hasMedia,
          isGroupMsg: message.isGroupMsg
        }
      }));
    });

    client.on('auth_failure', (msg) => {
      console.error(`Auth failure for session ${sessionId}:`, msg);
      ws.send(JSON.stringify({ type: 'auth_failure', message: msg }));
    });

    client.on('disconnected', (reason) => {
      console.log(`WhatsApp disconnected for session ${sessionId}:`, reason);
      ws.send(JSON.stringify({ type: 'disconnected', reason: reason }));
      clients.delete(sessionId);
    });

    // Initialize the client
    await client.initialize();

  } catch (error) {
    console.error(`Failed to initialize WhatsApp client for session ${sessionId}:`, error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function getContacts(sessionId, ws) {
  try {
    const client = clients.get(sessionId);
    if (!client || !client.pupPage) {
      throw new Error('WhatsApp client not ready');
    }

    const contacts = await client.getContacts();
    
    // Filter and format contacts
    const formattedContacts = contacts
      .filter(contact => contact.isMyContact && !contact.isGroup)
      .slice(0, 50) // Limit to 50 contacts for performance
      .map(contact => ({
        id: contact.id._serialized,
        name: contact.name || contact.pushname || contact.number,
        number: contact.number,
        pushname: contact.pushname,
        profilePicUrl: null, // Will be fetched separately if needed
        isMyContact: contact.isMyContact,
        isUser: contact.isUser,
        isGroup: contact.isGroup
      }));

    ws.send(JSON.stringify({ 
      type: 'contacts', 
      contacts: formattedContacts 
    }));

  } catch (error) {
    console.error(`Error getting contacts for session ${sessionId}:`, error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function getMessages(sessionId, ws, data) {
  try {
    const { contactId, dateFrom, dateTo } = data;
    const client = clients.get(sessionId);
    
    if (!client || !client.pupPage) {
      throw new Error('WhatsApp client not ready');
    }

    // Get chat by contact ID
    const chat = await client.getChatById(contactId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    // Fetch messages within date range
    const messages = await chat.fetchMessages({ limit: 1000 });
    
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    // Filter messages by date range
    const filteredMessages = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp * 1000);
      return msgDate >= fromDate && msgDate <= toDate;
    });

    // Format messages
    const formattedMessages = [];
    
    for (const message of filteredMessages) {
      const formattedMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        hasMedia: message.hasMedia,
        mediaType: message.type,
        isGroupMsg: message.isGroupMsg,
        author: message.author,
        isForwarded: message.isForwarded
      };

      // Handle media download if needed
      if (message.hasMedia && ['image', 'video', 'document'].includes(message.type)) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            formattedMessage.media = {
              data: media.data,
              mimetype: media.mimetype,
              filename: media.filename
            };
          }
        } catch (mediaError) {
          console.error('Error downloading media:', mediaError);
          formattedMessage.mediaError = 'Failed to download media';
        }
      }

      formattedMessages.push(formattedMessage);
    }

    ws.send(JSON.stringify({ 
      type: 'messages', 
      messages: formattedMessages,
      totalCount: filteredMessages.length,
      chatId: contactId
    }));

  } catch (error) {
    console.error(`Error getting messages for session ${sessionId}:`, error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function sendMessage(sessionId, ws, data) {
  try {
    const { contactId, message, mediaPath } = data;
    const client = clients.get(sessionId);
    
    if (!client || !client.pupPage) {
      throw new Error('WhatsApp client not ready');
    }

    let sentMessage;
    
    if (mediaPath) {
      // Send media message
      const media = MessageMedia.fromFilePath(mediaPath);
      sentMessage = await client.sendMessage(contactId, media, { caption: message });
    } else {
      // Send text message
      sentMessage = await client.sendMessage(contactId, message);
    }

    ws.send(JSON.stringify({ 
      type: 'message_sent', 
      messageId: sentMessage.id._serialized,
      timestamp: sentMessage.timestamp
    }));

  } catch (error) {
    console.error(`Error sending message for session ${sessionId}:`, error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// REST API endpoints for external integration
app.post('/api/session/create', (req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({ 
    sessionId: sessionId,
    websocketUrl: `/session/${sessionId}`,
    status: 'created'
  });
});

app.get('/api/session/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const client = clients.get(sessionId);
  const ws = sessions.get(sessionId);
  
  if (!client) {
    return res.json({ connected: false, status: 'not_initialized' });
  }

  const status = {
    connected: client.pupPage ? true : false,
    authenticated: client.info ? true : false,
    phoneNumber: client.info?.wid?.user ? `+${client.info.wid.user}` : null,
    clientInfo: client.info || null,
    websocketConnected: ws ? true : false
  };

  res.json(status);
});

app.delete('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // Close WebSocket
  const ws = sessions.get(sessionId);
  if (ws) {
    ws.close();
    sessions.delete(sessionId);
  }

  // Destroy client
  const client = clients.get(sessionId);
  if (client) {
    client.destroy();
    clients.delete(sessionId);
  }

  res.json({ status: 'session_terminated' });
});

// Cleanup old sessions periodically
setInterval(() => {
  console.log(`Active sessions: ${sessions.size}, Active clients: ${clients.size}`);
  
  // Remove clients without WebSocket connections
  for (const [sessionId, client] of clients.entries()) {
    if (!sessions.has(sessionId)) {
      console.log(`Cleaning up orphaned client: ${sessionId}`);
      client.destroy();
      clients.delete(sessionId);
    }
  }
}, 30 * 60 * 1000); // Every 30 minutes

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`WhatsApp Web Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/session/{sessionId}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WhatsApp Web Server...');
  
  // Close all clients
  for (const [sessionId, client] of clients.entries()) {
    console.log(`Destroying client: ${sessionId}`);
    client.destroy();
  }
  
  // Close all WebSocket connections
  for (const [sessionId, ws] of sessions.entries()) {
    console.log(`Closing WebSocket: ${sessionId}`);
    ws.close();
  }
  
  server.close(() => {
    console.log('WhatsApp Web Server stopped');
    process.exit(0);
  });
});