import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import { SendMessageDto } from "./dto/send-message.dto";

@Controller("whatsapp")
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post("send")
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }

  @Post("send-bulk")
  async sendBulkMessages(@Body() messages: SendMessageDto[]) {
    return this.whatsappService.sendBulkMessages(messages);
  }

  @Get("status/:messageId")
  async getMessageStatus(@Param("messageId") messageId: string) {
    return this.whatsappService.getMessageStatus(messageId);
  }
}
