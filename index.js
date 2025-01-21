const express = require('express');
const { VoiceResponse } = require('twilio').twiml;

const app = express();

app.use(express.urlencoded({ extended: true }));

// Ruta para manejar POST en /voice-webhook
app.post('/voice-webhook', (req, res) => {
    const twiml = new VoiceResponse();
    twiml.say('Hola, esta es una prueba de Twilio con Vercel y Node.js.');
    res.type('text/xml');
    res.send(twiml.toString());
});

// Exportar la app para que Vercel la use
module.exports = app;