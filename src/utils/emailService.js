import emailjs from '@emailjs/browser';

/**
 * Configure these keys by creating a free account at https://www.emailjs.com/
 * 1. Create an Email Service (e.g., Gmail)
 * 2. Create an Email Template with variables: {{order_id}}, {{product}}, {{quantity}}, {{client}}
 * 3. Copy the keys and paste them below or in your .env file
 */

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

export const sendNewOrderNotification = async (orderData) => {
  try {
    // We only send if the keys are actually configured (not the default placeholders)
    if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
      console.log('EmailJS not configured. Skipping email notification.');
      return false;
    }

    const templateParams = {
      order_id: orderData.id,
      client: orderData.client_name,
      product: orderData.product_name,
      quantity: orderData.quantity,
      // You can hardcode the recipient email in the EmailJS template settings,
      // or pass it here if you configure a {{to_email}} variable in your template.
      to_email: 'design@basil.com, production@basil.com' 
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Email sent successfully!', response.status, response.text);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
};
