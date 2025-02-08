const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Cargar variables de entorno
dotenv.config();

const app = express();

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Almacenar el contexto de cada llamada
const conversations = {};

// Ruta webhook para manejar llamadas de Twilio
app.post('/webhook', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const userMessage = req.body.SpeechResult || '';

  if (!conversations[callSid]) {
    conversations[callSid] = { context: [], iterationCount: 0 };
  }

  const conversation = conversations[callSid];

  try {
    if (conversation.context.length === 0) {
      const greeting = "¡Hola! Soy Rigo, asistente virtual del gobierno de Matamoros.";
      conversation.context.push({ role: 'system', content: greeting });

      const audioUrl = await generateTTS(greeting, callSid);

      if (audioUrl) {
        twiml.play(audioUrl);
      } else {
        twiml.say(greeting);
      }

      twiml.gather({
        input: 'speech',
        timeout: 5,
        action: '/webhook',
        language: 'es-MX',
      });

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

        if (audioUrl) {
          twiml.play(audioUrl);
        } else {
          twiml.say(chatGptResponse);
        }

        if (conversation.iterationCount < 4) {
          twiml.gather({
            input: 'speech',
            timeout: 5,
            action: '/webhook',
            language: 'es-MX',
          });
        } else {
          const farewell = "Gracias por llamar. Hasta luego.";
          const farewellAudioUrl = await generateTTS(farewell, callSid);

          if (farewellAudioUrl) {
            twiml.play(farewellAudioUrl);
          } else {
            twiml.say(farewell);
          }

          twiml.hangup();
          delete conversations[callSid];
        }
      } else {
        twiml.say("No pude procesar tu solicitud. Por favor, intenta de nuevo.");
      }
    } else {
      twiml.say("No escuché nada. Por favor, intenta de nuevo.");
    }
  } catch (error) {
    console.error('Error:', error);
    twiml.say("Hubo un error procesando tu solicitud. Intenta nuevamente más tarde.");
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
      resource_type: "video",
      folder: "twilio_audio",
      format: "mp3", // Forzar MP3 para evitar problemas
    });

    fs.unlinkSync(filePath);

    return cloudinaryResponse.secure_url;
  } catch (error) {
    console.error("Error generando TTS:", error);
    return null;
  }
}

// Iniciar el servidor en el puerto 3000 o el puerto de entorno
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
