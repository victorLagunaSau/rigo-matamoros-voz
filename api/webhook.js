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
    // Crear saludo inicial si el contexto está vacío
    if (conversationContext.length === 0) {
      const greeting = "¡Hola soy Rigo! ¿Cómo puedo ayudarte hoy?";
      conversationContext.push({ role: 'system', content: greeting });
      twiml.say({
        voice: 'Polly.Miguel', // Voz masculina en español (es-MX)
        language: 'es-MX',
      }, greeting);

      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        action: '/webhook',
      });
      gather.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'Estoy escuchando.');

      res.type('text/xml');
      return res.send(twiml.toString());
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
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, chatGptResponse);

      twiml.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'Gracias por llamar. Hasta luego.');
    } else {
      twiml.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'No pude procesar tu solicitud. Por favor, intenta de nuevo.');
    }
  } catch (error) {
    console.error('Error:', error);
    twiml.say({
      voice: 'Polly.Miguel',
      language: 'es-MX',
    }, 'Hubo un error procesando tu solicitud. Por favor, intenta nuevamente más tarde.');
  }

  // Enviar respuesta
  res.type('text/xml');
  res.send(twiml.toString());
});

// Exportar la app para que Vercel la use
module.exports = app;
