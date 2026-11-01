import { Controller, GET } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @GET()
  getHealth() {
    return {
      status: 'healthy',
      framework: 'NestJS',
      service: 'hackathon-nestjs-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

