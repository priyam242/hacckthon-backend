import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS Enabled
  app.enableCors({ origin: '*' });

  // Global RFC 7807 Exception Filter
  app.useGlobalFilters(new ProblemDetailsFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[NestJS Backend] Listening on http://localhost:${port}`);
}
bootstrap();
