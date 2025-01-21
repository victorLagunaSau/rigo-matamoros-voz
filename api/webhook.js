const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.urlencoded({ extended: true }));

// Estado temporal para mantener el historial de conversación por usuario
let conversationState = {};

// Ruta para manejar las llamadas de Twilio
app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();
  const caller = req.body.From; // Número del usuario
  const userMessage = req.body.SpeechResult || ''; // Texto captado del usuario

  if (!conversationState[caller]) {
    conversationState[caller] = [];
    // Primera interacción: Saludo
    twiml.say(
      { language: 'es-MX', voice: 'man' },
      'Hola, soy RIGO. ¿En qué puedo ayudarte?'
    );
    // Esperar entrada del usuario
    twiml.gather({
      input: 'speech',
      timeout: 10,
      language: 'es-MX',
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    // Procesar mensaje del usuario y agregar al historial
    conversationState[caller].push({ role: 'user', content: userMessage });

    // Llamar a OpenAI para obtener respuesta
    const openaiResponse = await openai.chat.completions.create({
      model: process.env.GPT_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'Eres un asistente llamado RIGO que responde en español de manera amigable.' },
        ...conversationState[caller],
      ],
    });

    const assistantMessage = openaiResponse.choices[0].message.content.trim();
    conversationState[caller].push({ role: 'assistant', content: assistantMessage });

    // Responder al usuario con voz masculina
    twiml.say({ language: 'es-MX', voice: 'man' }, assistantMessage);

    // Esperar más entrada del usuario
    twiml.gather({
      input: 'speech',
      timeout: 10,
      language: 'es-MX',
    });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    twiml.say(
      { language: 'es-MX', voice: 'man' },
      'Lo siento, hubo un error al procesar tu solicitud. Inténtalo nuevamente.'
    );
  }

  res.type('text/xml');
  res.send(twiml.toString());
});
