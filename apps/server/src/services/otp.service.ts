import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export enum OTPProvider {
  email = 'email',
  phone = 'phone',
}

@Injectable()
export class OTPService {
  private readonly logger = new Logger(OTPService.name);
  private readonly otpStore = new Map<string, { otp: string; expiresAt: Date }>();

  async sendOTP(options: {
    provider: OTPProvider | 'email' | 'phone';
    recipient: string;
    userName: string;
    purpose: string;
  }): Promise<{ message: string }> {
    const otp = '123456'; // standard OTP code for local development
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // expires in 5 minutes

    this.otpStore.set(options.recipient, { otp, expiresAt });
    this.logger.log(`🔑 Mock OTP generated for ${options.recipient}: ${otp} (Provider: ${options.provider}, Purpose: ${options.purpose})`);

    return { message: 'OTP sent successfully 👍' };
  }

  async verifyOTP(options: {
    provider: OTPProvider | 'email' | 'phone';
    recipient: string;
    otp: string;
  }): Promise<boolean> {
    const record = this.otpStore.get(options.recipient);
    if (!record) {
      throw new BadRequestException('No OTP request found for this recipient');
    }

    if (record.expiresAt < new Date()) {
      this.otpStore.delete(options.recipient);
      throw new BadRequestException('OTP has expired');
    }

    if (record.otp !== options.otp) {
      throw new BadRequestException('Invalid OTP code');
    }

    this.otpStore.delete(options.recipient);
    return true;
  }
}
