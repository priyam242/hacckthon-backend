import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let detail = 'An unexpected internal error occurred.';
    let invalidParams = null;

    if (typeof exceptionResponse === 'string') {
      detail = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as any;
      detail = respObj.message || respObj.error || detail;
      if (Array.isArray(respObj.message)) {
        invalidParams = respObj.message.map((msg: string) => ({ reason: msg }));
        detail = 'Validation failed for request parameters.';
      }
    }

    const problem = {
      type: 'about:blank',
      title: status === 500 ? 'Internal Server Error' : 'Request Exception',
      status,
      detail,
      instance: request.url,
      ...(invalidParams ? { invalid_params: invalidParams } : {}),
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(problem);
  }
}
