import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AppConfigModule } from "./core/config/config.module";
// import { PrismaModule } from "./core/prisma/prisma.module";
import { LoggerModule } from "./core/logging/logger.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TransformResponseInterceptor } from "./common/interceptors/transform-response.interceptor";

import { PrismaModule } from "./prisma/prisma.module";
import { CacheModule } from "@nestjs/cache-manager";
// import { RedisOptions } from "./config/redis.config";
import * as redisStore from "cache-manager-ioredis";
import { BullMQModule } from "./config/bullmq.module";
import { TenantsModule } from "./features/tenants/tenants.module";
import { BusinessesModule } from "./features/business/business.module";
import { SubscriptionsModule } from "./features/subscriptions/subscription.module";
import { RolesModule } from "./features/roles/role.module";
import { UsersModule } from "./features/users/user.module";
import { LeadModule } from "./features/lead/lead.module";
import { AuthModule } from "./features/auth/auth.module";
// import { KafkaModule } from "./features/kafka/kafka.module"; // Temporarily disabled - Kafka server not running
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { ProductsModule } from "./features/products/products.module";
import { CustomersModule } from "./features/customers/customers.module";
import { OrdersModule } from "./features/orders/orders.module";
// import { PaymentsModule } from "./features/payments/payments.module"; // Temporarily disabled - Razorpay credentials not configured
import { NotificationsModule } from "./features/notifications/notifications.module";
import { InventoryModule } from "./features/inventory/inventory.module";
import { AnalyticsModule } from "./features/analytics/analytics.module";
import { CampaignsModule } from "./features/campaigns/campaigns.module";
import { TemplatesModule } from "./features/notification-templates/templates.module";
import { MessagesModule } from "./features/messages/messages.module";

@Module({
  imports: [
    AppConfigModule,
    CacheModule.register({
      store: redisStore,
      host: "localhost", // update with your Redis host
      port: 6379,
      ttl: 60 * 60 * 24, // Cache expiry in seconds (24 hours)
    }),
    LoggerModule,
    PrismaModule,
    BullMQModule,
    AuthModule,
    TenantsModule,
    BusinessesModule,
    SubscriptionsModule,
    RolesModule,
    UsersModule,
    LeadModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    // PaymentsModule, // Temporarily disabled - Razorpay credentials not configured
    NotificationsModule,
    InventoryModule,
    AnalyticsModule,
    CampaignsModule,
    TemplatesModule,
    MessagesModule,
    // KafkaModule, // Kafka integration for AI services
   // WhatsAppModule//
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
  ],
})
export class AppModule {
  constructor() {
    console.log(__dirname, "public");
  }
}
 
