import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG = {
  PUBLIC_KEY: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '',
  SERVICE_ID: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
  TEMPLATE_ID: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
};

interface SendOTPParams {
  to_email: string;
  to_name: string;
  otp_code: string;
  expiry_time: string;
}

export const sendOTPEmail = async (params: SendOTPParams): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!EMAILJS_CONFIG.PUBLIC_KEY || !EMAILJS_CONFIG.SERVICE_ID || !EMAILJS_CONFIG.TEMPLATE_ID) {
      console.error('EmailJS Config Missing:', {
        hasPublicKey: !!EMAILJS_CONFIG.PUBLIC_KEY,
        hasServiceId: !!EMAILJS_CONFIG.SERVICE_ID,
        hasTemplateId: !!EMAILJS_CONFIG.TEMPLATE_ID
      });
      return { success: false, error: 'EmailJS belum dikonfigurasi' };
    }

    const result = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      {
        to_email: params.to_email,
        to_name: params.to_name,
        otp_code: params.otp_code,
        expiry_time: params.expiry_time,
      },
      EMAILJS_CONFIG.PUBLIC_KEY
    );

    console.log('✅ Email terkirim:', result);
    return result.status === 200 ? { success: true } : { success: false, error: 'Failed' };
  } catch (error: any) {
    console.error('❌ EmailJS Error:', error);
    return { success: false, error: error.text || error.message };
  }
};