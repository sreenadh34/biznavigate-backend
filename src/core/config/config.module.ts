import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "../../config/app.config";
import aiConfig from "../../config/ai.config";
import envConfig from "src/config/env.config";
import instagramConfig from "../../config/instagram.config";
import whatsappConfig from "../../config/whatsapp.config";
import twilioConfig from "../../config/twilio.config";
import encryptionConfig from "../../config/encryption.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, aiConfig, envConfig, instagramConfig, whatsappConfig, twilioConfig, encryptionConfig],
      envFilePath: [".env.local", ".env"],
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class AppConfigModule {}
