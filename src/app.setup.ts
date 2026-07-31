import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { setupSwagger } from './swagger';

export function setupApp(app: INestApplication): void {
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim());

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    credentials: true,
    origin: frontendUrls,
  });
  app.setGlobalPrefix('api');
  setupSwagger(app);
}
