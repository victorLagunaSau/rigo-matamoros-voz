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
console.log('API Key de OpenAI:', process.env.OPENAI_API_KEY);
console.log('ID del Asistente:', process.env.OPENAI_ASSISTANT_ID);
// Números de contacto específicos de Matamoros
const emergencyContacts = {
  "policía": "Policía de Matamoros: 911 y (868) 810 8000",
  "bomberos": "Bomberos de Matamoros: 911",
  "cruz roja": "Cruz Roja Matamoros: (868) 812 0911",
  "protección civil": "Protección Civil Matamoros: (868) 810 8000 (pide conectar con el área correspondiente)",
};

// Asegúrate de que tu servidor puede manejar solicitudes de formulario
app.use(express.urlencoded({ extended: true }));

// Ruta para manejar POST en /webhook
app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();

  // Obtener el texto de la llamada de Twilio
  const userMessage = req.body.Body || 'Hola';

 try {
  // Crear el saludo predeterminado que deseas enviar siempre
  const greeting = "¡Hola! ¿Cómo puedo ayudarte hoy?";

  // Llamar a la API de OpenAI (ChatGPT) para generar una respuesta
  const response = await openai.chat.completions.create({
    model: process.env.GPT_MODEL, // Usar el modelo especificado en .env
    messages: [
      { role: 'system', content: greeting }, // Agregar el saludo
      { role: 'user', content: userMessage }
    ],
  });

  // Verificar si la respuesta tiene el formato esperado
  console.log('Respuesta de OpenAI:', response);

  if (response.choices && response.choices.length > 0) {
    const chatGptResponse = response.choices[0].message.content;
    twiml.say(chatGptResponse);
  } else {
    console.error('No se recibió una respuesta válida de OpenAI.');
    twiml.say('No pude entender tu mensaje.');
  }
} catch (error) {
  // Log el error detallado para la depuración
  console.error('Error al comunicarse con OpenAI:', error.response ? error.response.body : error);

  // Mandar el error a Twilio en la respuesta de voz
  twiml.say('Hubo un error al procesar tu solicitud. Inténtalo nuevamente más tarde.');
}

  // Enviar la respuesta a Twilio
  res.type('text/xml');
  res.send(twiml.toString());
});

// Exportar la app para que Vercel la use
module.exports = app;
