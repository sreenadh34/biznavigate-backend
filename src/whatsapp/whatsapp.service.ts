import { Injectable, Logger } from "@nestjs/common";
import { SendMessageDto } from "./dto/send-message.dto";

export interface MessageResponse {
  success: boolean;
  messageId: string;
  timestamp: string;
  to: string;
  message: string;
  status: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private messageCounter = 0;

  async sendMessage(dto: SendMessageDto): Promise<MessageResponse> {
    this.logger.log(`Mock sending WhatsApp message to ${dto.to}`);

    // Simulate a small delay like a real API would have
    await this.delay(100);

    this.messageCounter++;
    const messageId = `mock_msg_${Date.now()}_${this.messageCounter}`;

    const response: MessageResponse = {
      success: true,
      messageId,
      timestamp: new Date().toISOString(),
      to: dto.to,
      message: dto.message,
      status: "sent",
    };

    this.logger.log(`Message sent successfully: ${messageId}`);

    return response;
  }

  async sendBulkMessages(messages: SendMessageDto[]): Promise<MessageResponse[]> {
    this.logger.log(`Mock sending ${messages.length} WhatsApp messages`);

    const responses = await Promise.all(
      messages.map(msg => this.sendMessage(msg))
    );

    return responses;
  }

  async getMessageStatus(messageId: string): Promise<{ messageId: string; status: string; deliveredAt?: string }> {
    this.logger.log(`Mock getting status for message: ${messageId}`);

    await this.delay(50);

    // Mock different statuses randomly
    const statuses = ["sent", "delivered", "read"];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      messageId,
      status: randomStatus,
      deliveredAt: randomStatus !== "sent" ? new Date().toISOString() : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
