# Chat Widget Integration

AI-powered chat widget that can be embedded on any website to enable real-time conversations with visitors.

## Features

✅ **Real-time Messaging** - WebSocket-based instant communication
✅ **AI Integration** - Automatic AI responses via Kafka pipeline
✅ **Lead Tracking** - Automatic lead creation and conversation history
✅ **HTTP Fallback** - Works even without WebSocket support
✅ **Customizable** - Brand colors, position, welcome message
✅ **Mobile Responsive** - Works seamlessly on all devices
✅ **Lightweight** - Vanilla JavaScript, minimal dependencies
✅ **Secure** - CORS configuration and input validation

## Quick Start

### 1. Get Embed Code

```bash
GET /widget/embed/:businessId
```

### 2. Add to Website

Paste before closing `</body>` tag:

```html
<!-- Socket.io (required) -->
<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

<!-- Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['ChatWidget']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'cw', 'http://localhost:8000/widget/script/YOUR_BUSINESS_ID'));

  cw('init', { businessId: 'YOUR_BUSINESS_ID' });
</script>
```

### 3. Done!

The widget will appear on your website automatically.

## File Structure

```
src/features/chat-widget/
├── dto/
│   └── widget-message.dto.ts       # Message DTOs
├── chat-widget.controller.ts       # HTTP endpoints
├── chat-widget.service.ts          # Business logic
├── chat-widget.gateway.ts          # WebSocket gateway
├── chat-widget.module.ts           # Module definition
└── README.md                       # This file

public/widget/
├── widget.js                       # Client-side JavaScript
├── styles.css                      # Widget styles
└── example.html                    # Demo page
```

## API Endpoints

### REST API

- `GET /widget/script/:businessId` - Get widget JavaScript
- `GET /widget/config/:businessId` - Get widget configuration
- `GET /widget/embed/:businessId` - Get embed code
- `POST /widget/init` - Initialize session
- `POST /widget/message` - Send message
- `GET /widget/history` - Get conversation history
- `POST /widget/visitor/update` - Update visitor info

### WebSocket Events

**Client → Server:**
- `widget:init` - Initialize session
- `widget:message` - Send message
- `widget:update-info` - Update visitor info
- `widget:get-history` - Request history

**Server → Client:**
- `widget:initialized` - Session ready
- `widget:message:sent` - Message confirmed
- `widget:message:received` - Bot response
- `widget:typing` - Typing indicator
- `widget:error` - Error occurred

## Database Schema

Uses existing tables:

**leads**
- `source: 'website_chat'`
- `platform_user_id: visitorId`

**lead_conversations**
- `channel: 'website_chat'`
- `status: 'active'`

**lead_messages**
- `sender_type: 'lead' | 'business'`
- `message_type: 'text'`

## Configuration

### Environment Variables

```env
API_URL=http://localhost:8000
WS_URL=ws://localhost:8000
PORT=8000
```

### Widget Options

```javascript
cw('init', {
  businessId: 'xxx',           // Required
  primaryColor: '#0084FF',     // Optional
  position: 'bottom-right',    // Optional
  welcomeMessage: 'Hi!',       // Optional (from DB)
  botName: 'Support Bot',      // Optional (from DB)
  showBranding: true           // Optional
});
```

### Customization

Colors are extracted from `businesses.brand_colors`:

```json
{
  "primary": "#667eea",
  "secondary": "#764ba2"
}
```

## AI Integration

### Message Flow

1. Visitor sends message → Widget
2. Widget → WebSocket Gateway
3. Gateway → Chat Widget Service
4. Service → Kafka (`ai-message-processor` topic)
5. AI Processor → Generates response
6. Response → WebSocket → Widget

### Kafka Message Format

```json
{
  "lead_id": "uuid",
  "business_id": "uuid",
  "message_id": "uuid",
  "message_text": "Hello",
  "direction": "inbound",
  "channel": "website_chat",
  "metadata": {
    "visitorId": "visitor_xxx",
    "visitorName": "John Doe",
    "pageUrl": "https://example.com",
    "pageTitle": "Home",
    "conversationId": "uuid"
  }
}
```

### Sending Responses

From your AI processor:

```typescript
// Inject services
constructor(
  private readonly chatWidgetGateway: ChatWidgetGateway,
  private readonly chatWidgetService: ChatWidgetService
) {}

// Send response
async sendAIResponse(
  businessId: string,
  visitorId: string,
  conversationId: string,
  message: string
) {
  // Store in database
  await this.chatWidgetService.sendBotResponse(conversationId, message);

  // Send via WebSocket
  await this.chatWidgetGateway.sendBotResponse(businessId, visitorId, message);
}
```

## Testing

### Local Testing

1. Start backend:
```bash
npm run start:dev
```

2. Open test page:
```
http://localhost:8000/widget/example.html
```

3. Update `YOUR_BUSINESS_ID` with actual business ID

4. Click chat button and send message

### WebSocket Testing

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8000/widget

# Send init event
{"event":"widget:init","data":{"businessId":"xxx","visitorId":"test123"}}
```

## Troubleshooting

### Widget not appearing

- Check browser console for errors
- Verify Socket.io CDN is loaded
- Check businessId is valid
- Ensure backend is running

### WebSocket not connecting

- Check WS_URL environment variable
- Verify port 8000 is open
- Check CORS configuration
- Try HTTP fallback

### Messages not sending

- Check backend logs
- Verify Kafka is running
- Test with HTTP endpoints
- Check database tables

### AI not responding

- Verify AI processor is running
- Check Kafka topic: `ai-message-processor`
- Ensure ChatWidgetGateway is injected
- Check WebSocket rooms

## Performance

- Widget loads asynchronously (non-blocking)
- CSS and JS are cached
- WebSocket reduces HTTP overhead
- Messages stored for offline sync

## Security

- Input validation on all endpoints
- CORS configured for allowed domains
- Rate limiting recommended
- Visitor ID stored in localStorage (client-side)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Production Deployment

1. Set production environment variables
2. Use HTTPS/WSS for secure connections
3. Configure CORS with specific domains
4. Add rate limiting
5. Monitor WebSocket connections
6. Set up CDN for static files

## Documentation

Full setup guide: `/CHAT_WIDGET_SETUP_GUIDE.md`

## Support

- Check logs: `biznavigate-backend/logs`
- API docs: `http://localhost:8000/api/docs`
- Test WebSocket: `wscat -c ws://localhost:8000/widget`
