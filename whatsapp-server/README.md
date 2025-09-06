# WhatsApp Web Automation Server

این سرور برای اتصال واقعی به واتس‌اپ وب استفاده می‌شود. شما باید این سرور را به صورت جداگانه راه‌اندازی کنید.

## نصب و راه‌اندازی

### 1. نصب Dependencies

```bash
npm init -y
npm install whatsapp-web.js qrcode-terminal ws express
```

### 2. فایل server.js ایجاد کنید

```javascript
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const WebSocket = require('ws');
const express = require('express');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = new Map();

class WhatsAppSession {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.client = null;
        this.websockets = new Set();
        this.qrCode = null;
        this.isReady = false;
        this.init();
    }

    init() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: this.sessionId
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.client.on('qr', (qr) => {
            this.qrCode = qr;
            console.log(`QR code generated for session ${this.sessionId}`);
            this.broadcast({ type: 'qr', qr });
        });

        this.client.on('ready', () => {
            this.isReady = true;
            console.log(`WhatsApp session ${this.sessionId} is ready!`);
            this.broadcast({ 
                type: 'ready', 
                phoneNumber: this.client.info.wid.user 
            });
        });

        this.client.on('authenticated', () => {
            console.log(`Session ${this.sessionId} authenticated`);
            this.broadcast({ type: 'authenticated' });
        });

        this.client.on('auth_failure', (msg) => {
            console.error(`Authentication failed for session ${this.sessionId}:`, msg);
            this.broadcast({ type: 'auth_failure', message: msg });
        });

        this.client.on('disconnected', (reason) => {
            console.log(`Session ${this.sessionId} disconnected:`, reason);
            this.broadcast({ type: 'disconnected', reason });
            this.cleanup();
        });

        this.client.initialize();
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        this.websockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });
    }

    addWebSocket(ws) {
        this.websockets.add(ws);
        
        // Send current state
        if (this.qrCode && !this.isReady) {
            ws.send(JSON.stringify({ type: 'qr', qr: this.qrCode }));
        } else if (this.isReady) {
            ws.send(JSON.stringify({ 
                type: 'ready', 
                phoneNumber: this.client.info.wid.user 
            }));
        }
    }

    removeWebSocket(ws) {
        this.websockets.delete(ws);
    }

    async getContacts() {
        if (!this.isReady) {
            throw new Error('Session not ready');
        }
        return await this.client.getContacts();
    }

    async getMessages(contactId, limit = 50) {
        if (!this.isReady) {
            throw new Error('Session not ready');
        }
        const chat = await this.client.getChatById(contactId);
        return await chat.fetchMessages({ limit });
    }

    cleanup() {
        if (this.client) {
            this.client.destroy();
        }
        this.websockets.clear();
        sessions.delete(this.sessionId);
    }
}

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.pathname.split('/').pop();
    
    console.log(`New WebSocket connection for session: ${sessionId}`);

    let session = sessions.get(sessionId);
    if (!session) {
        session = new WhatsAppSession(sessionId);
        sessions.set(sessionId, session);
    }

    session.addWebSocket(ws);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Received action: ${data.action} for session ${sessionId}`);

            switch (data.action) {
                case 'initialize':
                    // Already handled in constructor
                    break;
                case 'getContacts':
                    const contacts = await session.getContacts();
                    ws.send(JSON.stringify({ type: 'contacts', contacts }));
                    break;
                case 'getMessages':
                    const messages = await session.getMessages(data.contactId, data.limit);
                    ws.send(JSON.stringify({ type: 'messages', messages }));
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log(`WebSocket disconnected for session: ${sessionId}`);
        session.removeWebSocket(ws);
        
        // Cleanup session if no more connections
        if (session.websockets.size === 0) {
            setTimeout(() => {
                if (session.websockets.size === 0) {
                    session.cleanup();
                }
            }, 60000); // Wait 1 minute before cleanup
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`WhatsApp automation server running on port ${PORT}`);
});
```

### 3. اجرای سرور

```bash
node server.js
```

### 4. Deploy روی Vercel

برای deploy کردن روی Vercel:

1. فایل `vercel.json` ایجاد کنید:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/session/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

2. دستورات deploy:

```bash
npm install -g vercel
vercel --prod
```

### 5. آدرس سرور را در Edge Function تنظیم کنید

در فایل `supabase/functions/whatsapp-connect/index.ts` خط زیر را با آدرس سرور خود جایگزین کنید:

```javascript
const wsUrl = `wss://your-whatsapp-server.vercel.app/session/${this.sessionId}`
```

## نکات مهم

- اطمینان حاصل کنید که سرور همیشه در دسترس باشد
- برای production استفاده، سرور را روی پلتفرم قابل اعتماد deploy کنید
- QR code هر بار که سرور restart شود باید دوباره اسکن شود
- جلسات واتس‌اپ تا زمانی که logout نکنید باقی می‌مانند

## عیب‌یابی

- اگر QR code نمایش داده نمی‌شود، بررسی کنید سرور در حال اجرا باشد
- اگر اتصال برقرار نمی‌شود، فایروال و تنظیمات شبکه را بررسی کنید
- برای مشاهده جزئیات خطاها، console logs را چک کنید