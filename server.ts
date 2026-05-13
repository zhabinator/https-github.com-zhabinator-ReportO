import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Инициализация Gemini на сервере
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // API эндпоинт для извлечения данных
  app.post("/api/extract", async (req, res) => {
    try {
      const { text, imageBase64 } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Ключ API не настроен на сервере" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `Проанализируй документ (решение/протокол об утверждении годового отчета ООО).
        Извлеки:
        1. Название компании (только название, без 'ООО', но сохрани кавычки, если они есть в названии). 
           Если написано 'Общество с ограниченной ответственностью "Ромашка"', верни '"Ромашка"'.
        2. Год, за который утверждается годовой отчет (например, 2023, 2024, 2025). 
           Ищи фразу "утвердить годовой отчет за 20... год".
        
        Верни ответ строго в формате JSON.
        
        ${text ? `Текст документа для анализа:
        ${text.substring(0, 15000)}` : 'Проанализируй приложенное изображение документа.'}`;

      const parts: any[] = [{ text: prompt }];
      
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64
          }
        });
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              year: { type: Type.STRING }
            },
            required: ["companyName", "year"]
          }
        }
      });

      const response = JSON.parse(result.response.text());
      res.json(response);
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Ошибка при обработке документа ИИ" });
    }
  });

  // Настройка Vite для разработки или статики для продакшена
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
