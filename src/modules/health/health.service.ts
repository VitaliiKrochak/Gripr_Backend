import { Injectable } from '@nestjs/common';
import { HealthStatusDto } from './health-status.dto';

@Injectable()
export class HealthService {
  getStatus(): HealthStatusDto {
    return { status: 'ok' };
  }
}
