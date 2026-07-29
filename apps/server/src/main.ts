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

  // Reflect any Origin (browser, Capacitor https://localhost, LAN devices).
  await app.register(cors, {
    origin: true,
    credentials: true,
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
