import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(options: {
    to: string;
    subject: string;
    templateName: string;
    context: any;
    attachments?: any[];
  }): Promise<any> {
    this.logger.log(`📧 Mock Email sent to ${options.to}`);
    this.logger.log(`Subject: "${options.subject}"`);
    this.logger.log(`Template: "${options.templateName}"`);
    this.logger.log(`Context: ${JSON.stringify(options.context)}`);
    return { sent: true, to: options.to, timestamp: new Date().toISOString() };
  }
}
