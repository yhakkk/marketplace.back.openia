import express from "express";
import axios from "axios";
import morgan from "morgan"; // Importar morgan
import OpenAI from "openai";
import dotenv from "dotenv";

const app = express();
const port = 3002;
dotenv.config();

// Middleware para manejar JSON en las solicitudes
app.use(express.json());

// Usar morgan para registrar las solicitudes HTTP
app.use(morgan("dev")); // 'dev' es el formato predeterminado para desarrollo

const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Ruta para hacer la búsqueda de productos
app.post("/buscar-producto", async (req, res) => {
  const { nombreProducto } = req.body; // Obtener el nombre del producto del body de la solicitud

  try {
    const response = await axios.post(
      "https://marketplaceapi.cabrera.ar/productos/productos/search/",
      {
        filter: { nombre: nombreProducto },
      }
    );

    const messageContent = {
      text: response.data,
      type: "text",
    };

    // Crear el hilo de conversación en OpenAI
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;

    console.log(JSON.stringify(messageContent, null, 2));

    // Agregar un mensaje al hilo

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: JSON.stringify(messageContent.text),
    });

    // Ejecutar el asistente
    const runResponse = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID2, // Asegúrate de tener el ASSISTANT_ID en tu .env
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
    const responseAsistant = assistantResponses
      .map((msg) =>
        msg.content
          .filter((contentItem) => contentItem.type === "text")
          .map((textContent) => textContent.text.value)
          .join("\n")
      )
      .join("\n");

    console.log(responseAsistant);

    res.json(responseAsistant.data);
  } catch (error) {
    // Manejar errores en caso de que la solicitud falle
    console.error("Error al consultar la API:", error);
    res.status(500).json({ error: "Error al consultar la API externa" });
  }
});

// Iniciar el servidor en el puerto 3002
app.listen(port, () => {
  console.log(`Middleware escuchando en http://localhost:${port}`);
});
