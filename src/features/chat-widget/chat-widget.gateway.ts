import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatWidgetService } from './chat-widget.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your domains
    credentials: true,
  },
  namespace: '/widget',
})
export class ChatWidgetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatWidgetGateway.name);
  private connectedClients = new Map<string, { businessId: string; visitorId: string }>();

  constructor(private readonly chatWidgetService: ChatWidgetService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Widget client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Widget client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Initialize widget session
   */
  @SubscribeMessage('widget:init')
  async handleInit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { businessId: string; visitorId: string; pageUrl?: string },
  ) {
    try {
      const { businessId, visitorId, pageUrl } = data;

      // Store client info
      this.connectedClients.set(client.id, { businessId, visitorId });

      // Join room for this visitor
      const roomName = `${businessId}:${visitorId}`;
      client.join(roomName);

      // Get conversation history and config
      const result = await this.chatWidgetService.initWidget(businessId, visitorId, pageUrl);

      client.emit('widget:initialized', result);

      this.logger.log(`Widget initialized for visitor ${visitorId} in business ${businessId}`);
    } catch (error) {
      this.logger.error('Error initializing widget:', error);
      client.emit('widget:error', { message: 'Failed to initialize chat' });
    }
  }

  /**
   * Handle incoming message from visitor
   */
  @SubscribeMessage('widget:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      businessId: string;
      visitorId: string;
      message: string;
      visitorName?: string;
      visitorEmail?: string;
      pageUrl?: string;
      pageTitle?: string;
    },
  ) {
    try {
      this.logger.log(`Received message from visitor ${data.visitorId}: ${data.message}`);

      // Process message through service
      const result = await this.chatWidgetService.processMessage(data);

      // Emit confirmation back to sender
      client.emit('widget:message:sent', {
        id: result.messageId,
        text: data.message,
        sender: 'lead',
        timestamp: result.timestamp,
        tempId: data['tempId'], // If client sent a temporary ID
      });

      // Emit typing indicator
      const roomName = `${data.businessId}:${data.visitorId}`;
      this.server.to(roomName).emit('widget:typing', { sender: 'bot' });

      this.logger.log(`Message processed and sent to AI: ${result.messageId}`);
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('widget:error', { message: 'Failed to send message' });
    }
  }

  /**
   * Update visitor information
   */
  @SubscribeMessage('widget:update-info')
  async handleUpdateInfo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      businessId: string;
      visitorId: string;
      name?: string;
      email?: string;
      phone?: string;
    },
  ) {
    try {
      await this.chatWidgetService.updateVisitorInfo(data);
      client.emit('widget:info-updated', { success: true });
    } catch (error) {
      this.logger.error('Error updating visitor info:', error);
      client.emit('widget:error', { message: 'Failed to update information' });
    }
  }

  /**
   * Get conversation history
   */
  @SubscribeMessage('widget:get-history')
  async handleGetHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { businessId: string; visitorId: string },
  ) {
    try {
      const messages = await this.chatWidgetService.getConversationHistory(
        data.businessId,
        data.visitorId,
      );

      client.emit('widget:history', messages);
    } catch (error) {
      this.logger.error('Error getting history:', error);
      client.emit('widget:error', { message: 'Failed to load history' });
    }
  }

  /**
   * Send bot response to visitor (called by AI processor or agents)
   */
  async sendBotResponse(businessId: string, visitorId: string, message: string) {
    try {
      const roomName = `${businessId}:${visitorId}`;

      // Stop typing indicator
      this.server.to(roomName).emit('widget:typing', { sender: null });

      // Send message
      this.server.to(roomName).emit('widget:message:received', {
        id: Date.now().toString(),
        text: message,
        sender: 'business',
        senderName: 'Support Bot',
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Sent bot response to visitor ${visitorId}`);
    } catch (error) {
      this.logger.error('Error sending bot response via WebSocket:', error);
    }
  }

  /**
   * Broadcast typing indicator
   */
  async sendTypingIndicator(businessId: string, visitorId: string, isTyping: boolean) {
    try {
      const roomName = `${businessId}:${visitorId}`;
      this.server.to(roomName).emit('widget:typing', {
        sender: isTyping ? 'bot' : null
      });
    } catch (error) {
      this.logger.error('Error sending typing indicator:', error);
    }
  }
}
