const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.urlencoded({ extended: true }));

// Estado temporal en memoria para mantener el historial de conversaciones
let conversationState = {};

// Ruta para manejar las solicitudes entrantes
app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();
  const caller = req.body.From; // Número de teléfono del usuario
  const userMessage = req.body.SpeechResult || ''; // Entrada del usuario por voz

  // Si no hay estado, inicializamos el historial de conversación
  if (!conversationState[caller]) {
    conversationState[caller] = [];
    // Primera interacción: Presentación
    twiml.say({ language: 'es-MX', voice: 'man' }, 'Hola, soy RIGO. ¿En qué puedo ayudarte?');
    twiml.gather({
      input: 'speech',
      timeout: 10, // Tiempo para esperar entrada del usuario
      language: 'es-MX',
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Si ya hay interacción previa
  try {
    // Agregar el mensaje del usuario al historial
    conversationState[caller].push({ role: 'user', content: userMessage });

    // Llamar a OpenAI para obtener respuesta
    const openaiResponse = await openai.chat.completions.create({
      model: process.env.GPT_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'Eres un asistente llamado RIGO, amable y útil, que responde en español.' },
        ...conversationState[caller],
      ],
    });

    const chatGptResponse = openaiResponse.choices[0].message.content.trim();

    // Agregar la respuesta del asistente al historial
    conversationState[caller].push({ role: 'assistant', content: chatGptResponse });

    // Responder con la voz masculina en español
    twiml.say({ language: 'es-MX', voice: 'man' }, chatGptResponse);

    // Permitir que el usuario hable nuevamente
    twiml.gather({
      input: 'speech',
      timeout: 10,
      language: 'es-MX',
    });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    twiml.say({ language: 'es-MX', voice: 'man' }, 'Hubo un problema procesando tu solicitud. Inténtalo nuevamente.');
  }

  // Enviar respuesta a Twilio
  res.type('text/xml');
  res.send(twiml.toString());
});
