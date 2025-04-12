const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

// API route for handling chat requests
app.post("/api/chat", async (req, res) => {
  try {
    const { model, messages, temperature } = req.body;

    // Forward the request to the OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, messages, temperature })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);
      return res.status(response.status).json({ error: data.error?.message });
    }

    // Send the OpenAI API response back to the client
    res.json(data);
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/narrate", async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || process.env.ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.9
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Narration API Error:", errorData);
      return res.status(500).json({ error: errorData });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("Narration Server Error:", err);
    res.status(500).json({ error: "Voice narration failed." });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
