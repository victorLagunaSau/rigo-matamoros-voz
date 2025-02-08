const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

const app = express();

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware para manejar formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Almacenar el contexto de cada llamada
const conversations = {};

app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const userMessage = req.body.SpeechResult || '';

  if (!conversations[callSid]) {
    conversations[callSid] = {
      context: [],
      iterationCount: 0,
    };
  }

  const conversation = conversations[callSid];

  try {
    if (conversation.context.length === 0) {
      const greeting = "¡Hola! Soy Rigo, asistente virtual del gobierno de Matamoros.";
      conversation.context.push({ role: 'system', content: greeting });

      const audioUrl = await generateTTS(greeting, callSid);
      twiml.play(audioUrl);

      const gather = twiml.gather({
        input: 'speech',
        timeout: 5,
        action: '/webhook',
        language: 'es-MX',
      });
      gather.play(audioUrl);

      res.type('text/xml');
      return res.send(twiml.toString());
    }

    if (userMessage) {
      conversation.context.push({ role: 'user', content: userMessage });

      const response = await openai.chat.completions.create({
        model: process.env.GPT_MODEL,
        messages: conversation.context,
      });

      if (response.choices && response.choices.length > 0) {
        const chatGptResponse = response.choices[0].message.content;
        conversation.context.push({ role: 'assistant', content: chatGptResponse });
        conversation.iterationCount++;

        const audioUrl = await generateTTS(chatGptResponse, callSid);
        twiml.play(audioUrl);

        if (conversation.iterationCount < 4) {
          const gather = twiml.gather({
            input: 'speech',
            timeout: 5,
            action: '/webhook',
            language: 'es-MX',
          });
          gather.play(audioUrl);
        } else {
          const farewell = "Gracias por llamar. Hasta luego.";
          const farewellAudioUrl = await generateTTS(farewell, callSid);
          twiml.play(farewellAudioUrl);
          twiml.hangup();
          delete conversations[callSid];
        }
      } else {
        const errorMessage = "No pude procesar tu solicitud. Por favor, intenta de nuevo.";
        const errorAudioUrl = await generateTTS(errorMessage, callSid);
        twiml.play(errorAudioUrl);
      }
    } else {
      const noAudioMessage = "No escuché nada. Por favor, intenta de nuevo.";
      const noAudioUrl = await generateTTS(noAudioMessage, callSid);
      twiml.play(noAudioUrl);
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = "Hubo un error procesando tu solicitud. Intenta nuevamente más tarde.";
    const errorAudioUrl = await generateTTS(errorMessage, callSid);
    twiml.play(errorAudioUrl);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Función para generar audio con OpenAI TTS y subirlo a Cloudinary
async function generateTTS(text, callSid) {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.join(__dirname, `${callSid}.mp3`);
    fs.writeFileSync(filePath, buffer);

    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
      resource_type: "video", // Cloudinary maneja audios como videos
      folder: "twilio_audio",
    });

    fs.unlinkSync(filePath); // Eliminar el archivo local después de subirlo

    return cloudinaryResponse.secure_url;
  } catch (error) {
    console.error("Error generando TTS:", error);
    return ""; // Devuelve una cadena vacía en caso de error
  }
}

module.exports = app;
