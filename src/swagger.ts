import { createHash, timingSafeEqual } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE } from './shared/guards/auth.guard';

function swaggerAuth() {
  const username = process.env.SWAGGER_USERNAME;
  const password = process.env.SWAGGER_PASSWORD;

  if (!username || !password) {
    throw new Error('SWAGGER_USERNAME and SWAGGER_PASSWORD must be configured');
  }

  const expectedHash = createHash('sha256')
    .update(`${username}:${password}`)
    .digest();

  return (request: Request, response: Response, next: NextFunction): void => {
    const [scheme, value = ''] =
      request.headers.authorization?.split(' ') ?? [];
    const credentials =
      scheme?.toLowerCase() === 'basic'
        ? Buffer.from(value, 'base64').toString('utf8')
        : '';
    const credentialsHash = createHash('sha256').update(credentials).digest();

    if (timingSafeEqual(credentialsHash, expectedHash)) {
      next();
      return;
    }

    response.setHeader('WWW-Authenticate', 'Basic realm="Swagger"');
    response.sendStatus(401);
  };
}

export function setupSwagger(app: INestApplication): void {
  app.use(['/api/docs', '/api/docs-json', '/api/docs-yaml'], swaggerAuth());

  const config = new DocumentBuilder()
    .setTitle('Jewelry API')
    .setDescription('API for the jewelry store')
    .setVersion('1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE, undefined, 'access-token')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, documentFactory);
}
