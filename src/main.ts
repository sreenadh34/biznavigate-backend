import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as express from "express";
import { join } from "path";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  // Security: Helmet middleware for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for Swagger UI
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for widget embedding
    })
  );

  // Configure body parser with raw body for webhook signature verification
  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    })
  );

  // Enable CORS with restrictions
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3006', 'https://hoppscotch.io/'];

  app.enableCors({
    // origin: (origin, callback) => {
    //   // Allow requests with no origin (mobile apps, Postman, etc.)
    //   if (!origin) return callback(null, true);

    //   // In development, allow all localhost origins
    //   if (isDevelopment && origin.startsWith('http://localhost')) {
    //     return callback(null, true);
    //   }

    //   // Check against allowed origins list
    //   if (allowedOrigins.indexOf(origin) !== -1) {
    //     callback(null, true);
    //   } else {
    //     console.warn(`CORS blocked origin: ${origin}`);
    //     callback(new Error('Not allowed by CORS'));
    //   }
    // },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Static files
  app.use("/public", express.static(join(__dirname, "..", "public")));

  // Widget static files (for widget.js and styles.css)
  app.use("/widget", express.static(join(__dirname, "..", "public", "widget")));

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
    .addTag("Chat Widget", "Website chat widget integration")
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
