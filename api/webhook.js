const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

const app = express();

// Configuración de Twilio usando process.env
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Configuración de OpenAI usando process.env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Asegúrate de que tu servidor puede manejar solicitudes de formulario
app.use(express.urlencoded({ extended: true }));

// Ruta para manejar POST en /webhook
app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();

  // Obtener el texto de la llamada de Twilio
  const userMessage = req.body.Body || 'Hola';

  try {
    // Llamar a la API de OpenAI (ChatGPT) para generar una respuesta
    const response = await openai.chat.completions.create({
      model: process.env.GPT_MODEL, // Usar el modelo especificado en .env
      messages: [{ role: 'user', content: userMessage }],
      assistant: process.env.OPENAI_ASSISTANT_ID // Usar el ID del asistente si es necesario
    });

    // Obtener la respuesta generada por ChatGPT
    const chatGptResponse = response.choices[0].message.content;

    // Usar la respuesta de ChatGPT en Twilio
    twiml.say(chatGptResponse);
  } catch (error) {
    console.error('Error al comunicarse con OpenAI:', error);
    twiml.say('Hubo un error al procesar tu solicitud.');
  }

  // Enviar la respuesta a Twilio
  res.type('text/xml');
  res.send(twiml.toString());
});

// Exportar la app para que Vercel la use
module.exports = app;
