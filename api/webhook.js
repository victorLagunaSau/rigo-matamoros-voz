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
    // Saludo inicial, si el contexto está vacío
    if (conversationContext.length === 0) {
      const greeting = "¡Hola soy Rigo, asistente virtual del gobierno de Matamoros! ¿Cómo puedo ayudarte?";
      conversationContext.push({ role: 'system', content: greeting });

      twiml.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, greeting);

      const gather = twiml.gather({
        input: 'speech',
        timeout: 10, // Ajusta el tiempo de espera para que el usuario responda
        action: '/webhook', // Vuelve a llamar al mismo endpoint después de la respuesta
        language: 'es-MX',
      });
      gather.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'Estoy escuchando.');

      // Enviar respuesta inicial
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Si el usuario envía un mensaje
    if (userMessage.trim()) {
      conversationContext.push({ role: 'user', content: userMessage });

      // Generar respuesta con OpenAI
      const response = await openai.chat.completions.create({
        model: process.env.GPT_MODEL,
        messages: conversationContext,
      });

      if (response.choices && response.choices.length > 0) {
        const chatGptResponse = response.choices[0].message.content;
        conversationContext.push({ role: 'assistant', content: chatGptResponse });

        // Responder al usuario
        twiml.say({
          voice: 'Polly.Miguel',
          language: 'es-MX',
        }, chatGptResponse);

        // Agregar el mensaje final de despedida
        twiml.say({
          voice: 'Polly.Miguel',
          language: 'es-MX',
        }, 'Gracias por llamar. Hasta luego.');

        // Cerrar la llamada
        twiml.hangup();
      } else {
        // Si OpenAI no genera respuesta
        twiml.say({
          voice: 'Polly.Miguel',
          language: 'es-MX',
        }, 'No pude procesar tu solicitud. Por favor, intenta de nuevo.');

        // Volver a escuchar una vez, si no hay entrada
        const gather = twiml.gather({
          input: 'speech',
          timeout: 10,
          action: '/webhook',
          language: 'es-MX',
        });
        gather.say({
          voice: 'Polly.Miguel',
          language: 'es-MX',
        }, 'Estoy escuchando.');
      }
    } else {
      // Si no hubo entrada de voz del usuario
      twiml.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'No escuché nada. Por favor, intenta de nuevo.');

      // Solicitamos nuevamente la entrada sin repetir la misma pregunta
      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        action: '/webhook',
        language: 'es-MX',
      });
      gather.say({
        voice: 'Polly.Miguel',
        language: 'es-MX',
      }, 'Estoy escuchando.');
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
