import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class ExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // We can customize the behavior here, but delegating to the base filter
    // ensures standard NestJS adapter rendering is used.
    super.catch(exception, host);
  }
}
