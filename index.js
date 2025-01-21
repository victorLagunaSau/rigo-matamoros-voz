const express = require('express');
const { VoiceResponse } = require('twilio').twiml;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

app.post('/voice-webhook', (req, res) => {
    const twiml = new VoiceResponse();
    twiml.say('Hola, esta es una prueba de Twilio con Vercel y Node.js.');
    res.type('text/xml');
    res.send(twiml.toString());
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});