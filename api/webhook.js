const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

const app = express();

// Configuración de OpenAI usando process.env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Asegúrate de que tu servidor puede manejar solicitudes de formulario
app.use(express.urlencoded({ extended: true }));

// Para almacenar el contexto de la conversación (debe ser persistente en un almacenamiento adecuado en producción)
let conversationContext = [];

app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();

  // Capturar entrada del usuario
  const userMessage = req.body.SpeechResult || 'No entendí lo que dijiste.';

  try {
    // Crear saludo inicial
    const greeting = "¡Hola soy Rigo! ¿Cómo puedo ayudarte hoy?";
    if (conversationContext.length === 0) {
      conversationContext.push({ role: 'system', content: greeting });
    }

    // Agregar mensaje del usuario al contexto
    conversationContext.push({ role: 'user', content: userMessage });

    // Generar respuesta con OpenAI
    const response = await openai.chat.completions.create({
      model: process.env.GPT_MODEL,
      messages: conversationContext,
    });

    if (response.choices && response.choices.length > 0) {
      const chatGptResponse = response.choices[0].message.content;

      // Agregar respuesta de OpenAI al contexto
      conversationContext.push({ role: 'assistant', content: chatGptResponse });

      // Decir la respuesta al usuario
      twiml.say({
        voice: 'Polly.Miguel', // Voz masculina en español (es-MX)
        language: 'es-MX',
      }, chatGptResponse);

      // Mantener la interacción
      const gather = twiml.gather({
        input: 'speech dtmf',
        timeout: 10,
        action: '/webhook',
      });
      gather.say('¿Hay algo más en lo que te pueda ayudar? Si no, puedes colgar.');
    } else {
      twiml.say('No pude procesar tu solicitud. Por favor, intenta de nuevo.');
    }
  } catch (error) {
    console.error('Error:', error);
    twiml.say('Hubo un error procesando tu solicitud. Por favor, intenta nuevamente más tarde.');
  }

  // Enviar respuesta
  res.type('text/xml');
  res.send(twiml.toString());
});


// Exportar la app para que Vercel la use
module.exports = app;
