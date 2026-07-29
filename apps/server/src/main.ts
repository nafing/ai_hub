import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.SERVER_LOGGER === "true",
    }),
  );

  const globalPrefix = process.env.SERVER_GLOBAL_PREFIX ?? "/api";
  app.setGlobalPrefix(globalPrefix);

  // Capacitor WebView is https://localhost → http://127.0.0.1 API (cross-origin).
  // GET often works without preflight; DELETE/PUT/PATCH need full CORS.
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Requested-With",
      "Origin",
    ],
    exposedHeaders: ["Content-Disposition"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const host = process.env.SERVER_HOST || "0.0.0.0";
  const port = Number(process.env.SERVER_PORT) || 5174;

  await app.listen(
    { host, port },
    (err, address) => {
      if (err) console.error(err);
      console.log(`Server is running on ${address}`);
    },
  );
}

bootstrap();
