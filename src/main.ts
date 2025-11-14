import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as express from "express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    })
  );

  // Enable CORS
  app.enableCors();

  // Static files
  app.use("/public", express.static(join(__dirname, "..", "public")));

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle("BizNavigate API")
    .setDescription(
      "Lead Management System API - Handles Instagram, WhatsApp, and website leads with AI-powered automation"
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("Authentication", "Authentication endpoints (signup, login, refresh, logout)")
    .addTag("Leads", "Lead management endpoints")
    .addTag("Tenants", "Tenant management endpoints")
    .addTag("Businesses", "Business management endpoints")
    .addTag("Users", "User management endpoints")
    .addTag("Roles", "Role management endpoints")
    .addTag("Subscriptions", "Subscription management endpoints")
    .addTag("Analytics", "Business analytics and reporting endpoints")
    .addTag("Campaigns", "Marketing campaign management with WhatsApp integration")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  const port = process.env.PORT || 8000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
