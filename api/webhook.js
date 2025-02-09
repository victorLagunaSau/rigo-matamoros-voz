const express = require('express');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

app.use(express.urlencoded({ extended: false })); // Importante para procesar datos Twilio

app.post('/webhook', (req, res) => {
    console.log('Llamada recibida:', req.body); // Verifica que Twilio está enviando datos

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Hola, esta es una llamada de prueba usando Twilio y VAPI');

    res.type('text/xml');
    res.send(twiml.toString());
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
