# WhatsApp Web Automation Server

سرور Node.js برای اتصال واقعی به واتس‌اپ وب با استفاده از whatsapp-web.js

## ویژگی‌های کلیدی

- ✅ اتصال واقعی به واتس‌اپ وب
- ✅ تولید QR کد واقعی برای احراز هویت  
- ✅ استخراج مخاطبین واقعی
- ✅ دریافت پیام‌های واقعی با فیلتر تاریخ
- ✅ پشتیبانی از رسانه (عکس، ویدیو، سند)
- ✅ WebSocket API برای ارتباط real-time
- ✅ REST API برای مدیریت session ها
- ✅ مدیریت چندین session همزمان
- ✅ QR کد به صورت Base64 Data URL

## نصب و راه‌اندازی

### 1. نصب Dependencies

```bash
cd whatsapp-server
npm install
```

### 2. اجرای سرور (Development)

```bash
npm run dev
```

### 3. اجرای سرور (Production)

```bash
npm start
```

سرور روی پورت 3001 اجرا می‌شود (یا PORT environment variable).

## استقرار

### Option 1: Render.com (توصیه شده)

1. Repository خود را به Render متصل کنید
2. یک Web Service جدید ایجاد کنید
3. تنظیمات:

```
Build Command: cd whatsapp-server && npm install
Start Command: cd whatsapp-server && npm start
Environment: Node
Root Directory: whatsapp-server
```

4. Environment Variables:
```
PORT=10000
NODE_ENV=production
```

### Option 2: Railway

1. Repository خود را به Railway متصل کنید
2. Root Directory را `whatsapp-server` تنظیم کنید
3. Railway خودکار تشخیص می‌دهد

### Option 3: Heroku

1. Heroku CLI نصب کنید
2. دستورات:

```bash
cd whatsapp-server
git init
heroku create your-whatsapp-server
git add .
git commit -m "Deploy WhatsApp server"
git push heroku main
```

## API Documentation

### WebSocket Endpoint

```
wss://your-server.com/session/{sessionId}
```

### WebSocket Messages

#### شروع session:
```json
{
  "action": "initialize"
}
```

#### دریافت مخاطبین:
```json
{
  "action": "getContacts"
}
```

#### دریافت پیام‌ها:
```json
{
  "action": "getMessages",
  "contactId": "1234567890@c.us",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31"
}
```

#### ارسال پیام:
```json
{
  "action": "sendMessage",
  "contactId": "1234567890@c.us",
  "message": "Hello World",
  "mediaPath": "/path/to/file.jpg" // اختیاری
}
```

### Server Events

#### QR Code:
```json
{
  "type": "qr",
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "sessionId": "session_123"
}
```

#### آماده:
```json
{
  "type": "ready",
  "sessionId": "session_123",
  "phoneNumber": "+1234567890",
  "clientInfo": {
    "pushname": "My Name",
    "platform": "web"
  }
}
```

#### مخاطبین:
```json
{
  "type": "contacts",
  "contacts": [
    {
      "id": "1234567890@c.us",
      "name": "Contact Name",
      "number": "1234567890",
      "pushname": "Push Name"
    }
  ]
}
```

#### پیام‌ها:
```json
{
  "type": "messages",
  "messages": [
    {
      "id": "message_id",
      "from": "1234567890@c.us",
      "body": "Message text",
      "timestamp": 1640995200,
      "hasMedia": true,
      "media": {
        "data": "base64_data",
        "mimetype": "image/jpeg",
        "filename": "image.jpg"
      }
    }
  ],
  "totalCount": 25,
  "chatId": "1234567890@c.us"
}
```

### REST Endpoints

#### ایجاد Session:
```http
POST /api/session/create
Response: {
  "sessionId": "session_123",
  "websocketUrl": "/session/session_123",
  "status": "created"
}
```

#### وضعیت Session:
```http
GET /api/session/{sessionId}/status
Response: {
  "connected": true,
  "authenticated": true,
  "phoneNumber": "+1234567890",
  "websocketConnected": true
}
```

#### حذف Session:
```http
DELETE /api/session/{sessionId}
Response: {
  "status": "session_terminated"
}
```

#### Health Check:
```http
GET /health
Response: {
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## پیکربندی در Supabase

پس از استقرار سرور:

1. در Supabase Dashboard > Functions > Settings
2. Secret جدید `WHATSAPP_SERVER_URL` اضافه کنید:

**Render.com:**
```
wss://your-whatsapp-server.onrender.com
```

**Railway:**
```
wss://your-project.railway.app
```

**Heroku:**
```
wss://your-whatsapp-server.herokuapp.com
```

## مشکلات رایج

### 1. QR Code نمایش نمی‌شود
```bash
# بررسی لاگ‌های سرور
npm run dev

# تست WebSocket
wscat -c ws://localhost:3001/session/test123
```

### 2. Memory Issues
```javascript
// در package.json اضافه کنید:
"scripts": {
  "start": "node --max-old-space-size=1024 server.js"
}
```

### 3. Puppeteer در Production
```javascript
// اضافه کردن args بیشتر:
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
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
}
```

### 4. WebSocket Connection Issues
```javascript
// بررسی در browser console:
const ws = new WebSocket('wss://your-server.com/session/test123');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data));
```

## مانیتورینگ و لاگ‌ها

سرور اطلاعات زیر را لاگ می‌کند:
- اتصالات WebSocket جدید
- تولید QR Code
- وضعیت احراز هویت
- تعداد session های فعال
- خطاها و exceptions

## محدودیت‌ها و توجهات

- **منابع سرور:** حداقل 1GB RAM برای Puppeteer
- **Session Limit:** تعداد session محدود به منابع سرور
- **WhatsApp Rate Limits:** محدودیت‌های واتس‌اپ برای استفاده خودکار
- **Media Size:** محدودیت سایز فایل‌های رسانه
- **Network:** وابستگی به پایداری اتصال

## امنیت

- Session IDs منحصر به فرد و تصادفی
- Auto cleanup برای session های غیرفعال  
- CORS محافظت برای درخواست‌های cross-origin
- Local authentication برای هر session

## Performance Optimization

```javascript
// تنظیمات بهینه برای production:
const client = new Client({
  authStrategy: new LocalAuth({ clientId: sessionId }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // محدود کردن منابع:
    defaultViewport: { width: 1280, height: 720 },
    slowMo: 0
  }
});

// Cleanup job برای session های قدیمی:
setInterval(cleanupOldSessions, 30 * 60 * 1000); // هر 30 دقیقه
```

## Development Tips

```bash
# تست local:
npm run dev
# در browser دیگر:
http://localhost:3001/health

# Debug WebSocket:
npm install -g wscat
wscat -c ws://localhost:3001/session/debug123
```

## پشتیبانی

- لاگ‌های کامل در console
- Health check endpoint برای monitoring
- WebSocket events برای debugging
- REST API برای وضعیت session ها

برای گزارش مشکل یا ویژگی جدید، GitHub issue ایجاد کنید.