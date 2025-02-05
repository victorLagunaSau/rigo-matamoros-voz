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

// Middleware para manejar formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Para almacenar el contexto de la conversación
let conversationContext = [];

app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();

  // Capturar entrada del usuario
  const userMessage = req.body.SpeechResult || '';

  try {
    // Saludo inicial si el contexto está vacío
    if (conversationContext.length === 0) {
      const greeting = "¡Hola! Soy Rigo, asistente virtual del gobierno de Matamoros.";
      conversationContext.push({ role: 'system', content: greeting });

      twiml.say({
        voice: 'Google.es-MX-Wavenet-D',
        language: 'es-MX',
      }, `<speak>${greeting} <break time="700ms"/> ¿Cómo puedo ayudarte?</speak>`);

      const gather = twiml.gather({
        input: 'speech',
        timeout: 5,
        action: '/webhook',
        language: 'es-MX',
      });

      gather.say({
        voice: 'Google.es-MX-Wavenet-D',
        language: 'es-MX',
      }, `<speak>¿Cómo puedo ayudarte?</speak>`);

      res.type('text/xml');
      console.log("Twilio Response:", twiml.toString());
      return res.send(twiml.toString());
    }

    // Si hay un mensaje del usuario
    if (userMessage) {
      conversationContext.push({ role: 'user', content: userMessage });

      // Generar respuesta con OpenAI
      const response = await openai.chat.completions.create({
        model: process.env.GPT_MODEL,
        messages: conversationContext,
      });

      if (response.choices && response.choices.length > 0) {
        const chatGptResponse = response.choices[0].message.content;
        conversationContext.push({ role: 'assistant', content: chatGptResponse });

        // Responder al usuario con WaveNet
        twiml.say({
          voice: 'Google.es-MX-Wavenet-D',
          language: 'es-MX',
        }, `<speak>${chatGptResponse} <break time="1s"/> Gracias por llamar. Hasta luego.</speak>`);

        // Cerrar la llamada
        twiml.hangup();
      } else {
        // Si OpenAI no genera respuesta
        twiml.say({
          voice: 'Google.es-MX-Wavenet-D',
          language: 'es-MX',
        }, `<speak>No pude procesar tu solicitud. <break time="500ms"/> Por favor, intenta de nuevo.</speak>`);

        const gather = twiml.gather({
          input: 'speech',
          timeout: 5,
          action: '/webhook',
          language: 'es-MX',
        });
        gather.say({
          voice: 'Google.es-MX-Wavenet-D',
          language: 'es-MX',
        }, `<speak>¿Cómo puedo ayudarte?</speak>`);
      }
    } else {
      // Si no hubo entrada de voz del usuario
      twiml.say({
        voice: 'Google.es-MX-Wavenet-D',
        language: 'es-MX',
      }, `<speak>No escuché nada. <break time="500ms"/> Por favor, intenta de nuevo.</speak>`);

      const gather = twiml.gather({
        input: 'speech',
        timeout: 5,
        action: '/webhook',
        language: 'es-MX',
      });

      gather.say({
        voice: 'Google.es-MX-Wavenet-D',
        language: 'es-MX',
      }, `<speak>¿Cómo puedo ayudarte?</speak>`);
    }
  } catch (error) {
    console.error('Error:', error);
    twiml.say({
      voice: 'Google.es-MX-Wavenet-D',
      language: 'es-MX',
    }, `<speak>Hubo un error procesando tu solicitud. <break time="500ms"/> Intenta nuevamente más tarde.</speak>`);
  }

  // Enviar respuesta a Twilio
  res.type('text/xml');
  console.log("Twilio Response:", twiml.toString());
  res.send(twiml.toString());
});

// Exportar la app para Vercel
module.exports = app;
