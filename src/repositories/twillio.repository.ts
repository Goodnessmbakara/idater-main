import twilio from 'twilio';
import { config } from '../config';

const {verify} = twilio(config.twillio.accountSid, config.twillio.authToken);


export class TwilioRepository {
  async sendOTP(phoneNumber: string): Promise<string> {
    const verification = await verify.v2.services.create({
      friendlyName: 'My Verification Service',
    });

    const verificationResult = await verify.v2.services(verification.sid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    return verificationResult.sid;
  }

  async verifyOTP(verificationId: string, otp: string): Promise<boolean> {
    const verificationCheck = await verify.v2.services(verificationId)
      .verificationChecks
      .create({ to: verificationId, code: otp });

    return verificationCheck.status === 'approved';
  }
}