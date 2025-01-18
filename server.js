/* eslint-disable no-undef */
import express from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting for SMS and Call Endpoints
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many SMS requests from this IP, please try again later.',
});

const callLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many call requests from this IP, please try again later.',
});

// Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

if (!accountSid || !authToken || !process.env.TWILIO_PHONE_NUMBER) {
  console.error('Missing Twilio configuration in .env');
  process.exit(1);
}

// Routes
app.get('/', (req, res) => {
  res.send('Hello user, server is running');
});

// Send SMS Endpoint
app.post('/send-sms', smsLimiter, (req, res) => {
  const { message, to } = req.body;

  if (!message || !to) {
    return res.status(400).json({ success: false, error: 'Message and recipient number are required.' });
  }

  const formattedTo = to.startsWith('+') ? to : `+91${to}`;

  client.messages
    .create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo,
    })
    .then((message) => {
      res.status(200).json({ success: true, messageSid: message.sid });
    })
    .catch((err) => {
      console.error('Twilio SMS Error:', err);
      res.status(500).json({ success: false, error: err.message });
    });
});

// Make Call Endpoint
app.post('/make-call', callLimiter, (req, res) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, error: 'Recipient number is required.' });
  }

  const formattedTo = to.startsWith('+') ? to : `+91${to}`;

  client.calls
    .create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo,
      url: 'http://demo.twilio.com/docs/voice.xml', // TwiML URL for call instructions
    })
    .then((call) => {
      res.status(200).json({ success: true, callSid: call.sid });
    })
    .catch((err) => {
      console.error('Twilio Call Error:', err);
      res.status(500).json({ success: false, error: err.message });
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
