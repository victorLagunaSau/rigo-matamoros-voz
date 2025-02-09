require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER;
const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

const client = new twilio(accountSid, authToken);

app.use(express.json());

// Webhook para llamadas entrantes
app.post('/webhook', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Hola, esta es una llamada de prueba usando Twilio y VAPI', { language: 'es-MX' });
    res.type('text/xml');
    res.send(twiml.toString());
});

// Enviar un mensaje de WhatsApp
app.post('/send-whatsapp', async (req, res) => {
    try {
        const { to, message } = req.body;
        const response = await client.messages.create({
            body: message,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${to}`
        });
        res.json({ success: true, messageSid: response.sid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Realizar una llamada
app.post('/call', async (req, res) => {
    try {
        const { to } = req.body;
        const call = await client.calls.create({
            url: webhookUrl,
            to: to,
            from: twilioNumber
        });
        res.json({ success: true, callSid: call.sid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
