import express from "express";

const app = express();
app.use(express.json());

const PORT = 3000;
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "qwen2.5-coder:7b";
const REQUEST_TIMEOUT_MS = 120_000;
const KEEP_ALIVE = "30m";
const MAX_RETRIES = 2;

let lastResponseHash = null;

function hashString(text) {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return hash;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        throw error;
      }

      console.log(`Tentativa ${attempt + 1} falhou. Tentando novamente...`);
      await sleep(1000);
    }
  }
}

async function preloadModel() {
  try {
    await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: "",
        keep_alive: KEEP_ALIVE,
      }),
    });

    console.log(`Modelo "${MODEL_NAME}" pré-carregado com sucesso.`);
  } catch (error) {
    console.log("Erro no preload do modelo:", error.message);
  }
}

async function streamOllamaResponse(ollamaResponse, res) {
  let fullResponse = "";
  let buffer = "";

  for await (const chunk of ollamaResponse.body) {
    buffer += chunk.toString();

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.response) {
          fullResponse += data.response;
          res.write(data.response);
        }
      } catch {
        // Ignora linhas parciais ou inválidas
      }
    }
  }

  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer);
      if (data.response) {
        fullResponse += data.response;
        res.write(data.response);
      }
    } catch {
      // Ignora resto incompleto do buffer
    }
  }

  return fullResponse;
}

app.post("/chat", async (req, res) => {
  const prompt = req.body?.prompt?.trim();

  if (!prompt) {
    return res.status(400).json({
      error: 'O campo "prompt" é obrigatório.',
    });
  }

  try {
    const ollamaResponse = await fetchWithRetry(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,
        stream: true,
        keep_alive: KEEP_ALIVE,
      }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();

      return res.status(500).json({
        error: "O Ollama retornou um erro.",
        details: errorText,
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const fullResponse = await streamOllamaResponse(ollamaResponse, res);
    const currentHash = hashString(fullResponse);

    if (currentHash === lastResponseHash) {
      console.log("Resposta duplicada detectada.");
    }

    lastResponseHash = currentHash;
    res.end();
  } catch (error) {
    console.error("Erro no endpoint /chat:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Erro ao conectar com o Ollama.",
        details: error.message,
      });
    }

    res.end();
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "online",
    model: MODEL_NAME,
  });
});

app.listen(PORT, async () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  await preloadModel();
});