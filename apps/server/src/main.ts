import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import multipart from "@fastify/multipart";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.SERVER_LOGGER === "true",
    }),
  );

  const globalPrefix = process.env.SERVER_GLOBAL_PREFIX ?? "/api";
  app.setGlobalPrefix(globalPrefix);

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

  await app.listen(
    {
      host: process.env.SERVER_HOST,
      port: Number(process.env.SERVER_PORT) || 5174,
    },
    (err, address) => {
      if (err) console.error(err);
      console.log(`Server is running on ${address}`);
    },
  );
}

bootstrap();
