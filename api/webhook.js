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
  const userMessage = req.body.Body || 'Hola';

  try {
    // Crear el saludo predeterminado que deseas enviar siempre
    const greeting = "¡Hola! ¿Cómo puedo ayudarte hoy?";

    // Agregar el saludo al contexto de la conversación
    conversationContext.push({ role: 'system', content: greeting });

    // Agregar el mensaje del usuario al contexto de la conversación
    conversationContext.push({ role: 'user', content: userMessage });

    // Llamar a la API de OpenAI (ChatGPT) para generar una respuesta
    const response = await openai.chat.completions.create({
      model: process.env.GPT_MODEL, // Usar el modelo especificado en .env
      messages: conversationContext,
    });

    // Verificar si la respuesta tiene el formato esperado
    console.log('Respuesta de OpenAI:', response);

    if (response.choices && response.choices.length > 0) {
      const chatGptResponse = response.choices[0].message.content;

      // Agregar la respuesta de OpenAI al contexto de la conversación
      conversationContext.push({ role: 'assistant', content: chatGptResponse });

      // Responder a Twilio con la respuesta de ChatGPT, usando voz en español
      twiml.say({
        voice: 'Polly.Miguel', // Voz masculina en español (es-MX)
        language: 'es-MX' // Configuración para español (México)
      }, chatGptResponse);

      // Mantener la llamada activa y esperar más interacción
      const gather = twiml.gather({
        input: 'speech dtmf', // Permite capturar entrada por voz o teclas
        timeout: 10, // Tiempo para esperar por una respuesta
        numDigits: 1, // Limitar la cantidad de dígitos esperados
        action: '/webhook' // Redirige la solicitud para continuar la conversación
      });

      gather.say('Dime algo más o cuelga si terminaste.');

      // Si no se recibe input, la llamada finalizará
      twiml.redirect('/webhook'); // Vuelve a llamar al webhook para seguir la conversación
    } else {
      console.error('No se recibió una respuesta válida de OpenAI.');
      twiml.say('No pude entender tu mensaje.');
    }
  } catch (error) {
    console.error('Error al comunicarse con OpenAI:', error.response ? error.response.body : error);
    twiml.say('Hubo un error al procesar tu solicitud. Inténtalo nuevamente más tarde.');
  }

  // Enviar la respuesta a Twilio
  res.type('text/xml');
  res.send(twiml.toString());
});

// Exportar la app para que Vercel la use
module.exports = app;
