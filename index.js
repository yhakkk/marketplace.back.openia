import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";
import cors from 'cors';
import multer from "multer";  // Importar multer para manejar archivos
import sharp from "sharp";  // Importar sharp para la reducción de imágenes

dotenv.config(); // Cargar las variables de entorno desde el archivo .env

const app = express();
const port = process.env.PORT || 3000;

// Middleware para leer el cuerpo de las solicitudes en JSON
app.use(bodyParser.json());
app.use(cors());

const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Configurar multer para guardar las imágenes en la memoria (RAM)
const storage = multer.memoryStorage();  // Usamos memoryStorage para manejar el archivo en RAM
const upload = multer({ storage });  // Usar multer para gestionar el archivo

// Endpoint para usar el asistente
app.post('/generate-description', upload.single('imagen'), async (req, res) => {
  try {
    const { title } = req.body;
    const image = req.file;  // La imagen cargada desde el formulario


    if (!title) {
      return res.status(400).send({ error: "El título es requerido" });
    }

    
    // Enviar la imagen procesada a OpenAI (si es necesario) o manejarla en tu lógica
    // Aquí puedes convertirla a base64 o trabajar con el buffer según lo que necesites
    const imageBase64 = "data:image/jpeg;base64,"+image.buffer.toString("base64");

    const newFile = new File([image.buffer],image.originalname, {
      type: image.mimetype,
    });

    const send_image = await openai.files.create({ file: newFile, purpose: 'assistants' });
    console.log("asd",send_image)
    console.log("Este es imagen")
    console.log(imageBase64)
    // Crear el objeto de mensaje en formato JSON
    const messageObject = {
      text: title,
      type: "text"
    };


    // Crear el hilo de conversación en OpenAI
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;

    // Agregar un mensaje al hilo
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: [messageObject, {type:"image_file", image_file:{file_id:send_image.id}}],
  //    attachments:[imageBase64]
    });

    console.log(threadId);

    // Ejecutar el asistente
    const runResponse = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,  // Asegúrate de tener el ASSISTANT_ID en tu .env
    });

    // Comprobar el estado de la ejecución
    let run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
    while (run.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
    }

    // Mostrar la respuesta del asistente
    const messagesResponse = await openai.beta.threads.messages.list(threadId);
    const assistantResponses = messagesResponse.data.filter(
      (msg) => msg.role === "assistant"
    );
    const response = assistantResponses
      .map((msg) =>
        msg.content
          .filter((contentItem) => contentItem.type === "text")
          .map((textContent) => textContent.text.value)
          .join("\n")
      )
      .join("\n");

    console.log(response);
    res.json({ response });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: "Ha ocurrido un error en el servidor." });
  }
});

// Escuchar en el puerto especificado
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
