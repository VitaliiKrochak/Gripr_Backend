import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { setupSwagger } from './swagger';

export function setupApp(app: INestApplication): void {
  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (frontendUrls.includes('*')) {
    throw new Error(
      'FRONTEND_URL cannot use a wildcard origin when credentials are enabled',
    );
  }

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
