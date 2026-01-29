import express from "express";
import fetch from "node-fetch";
import cors from "cors";
const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/generate/stream", async (req, res) => {
  const { prompt } = req.body;
  console.log("Received prompt for streaming:", prompt);

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await fetch("http://localhost:8000/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    // Pipe the stream from Python backend to frontend
    response.body.pipe(res);
  } catch (error) {
    console.error("Error streaming:", error);
    res.status(500).json({ error: "Failed to generate project" });
  }
});

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  console.log("Received prompt:", prompt);

  const response = await fetch("http://localhost:8000/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const data = await response.json();
  res.json(data);
});

app.listen(3000, () => {
  console.log("Node API running on port 3000");
});

