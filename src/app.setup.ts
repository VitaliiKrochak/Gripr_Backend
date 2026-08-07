import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { getAllowedFrontendOrigins } from './shared/origins/frontend.origin';
import { setupSwagger } from './swagger';

export function setupApp(app: INestApplication): void {
  const frontendOrigins = getAllowedFrontendOrigins();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    credentials: true,
    origin: frontendOrigins,
  });
  app.setGlobalPrefix('api');
  setupSwagger(app);
}
