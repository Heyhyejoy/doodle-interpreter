// scripts/llm.js
// Calls an LLM to interpret the doodle summary


window.OPENAI_API_KEY = ""; 

// Calls an LLM to interpret the doodle
async function interpretDoodle(featureSummary) {
  const apiKey = window.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("No OpenAI API key set.");
    return null;
  }


  const systemPrompt = `
You are a gentle journaling companion.
You receive a technical summary of a doodle (colors, strokes, shapes, energy, etc.).
You must return JSON with two fields:

{
  "reflection": "...",   // 3–6 sentences, soft emotional reflection
  "encouragement": "..." // 1 short supportive sentence, friendly but not cheesy
}

Do not add any other keys. Do not add explanation outside JSON.
`.trim();

  const userPrompt = `
Here is the doodle summary:

${featureSummary}

Return only JSON as described above.
`.trim();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    console.error("OpenAI error:", await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "";

  try {
    const parsed = JSON.parse(content);
    return {
      reflection: parsed.reflection || "",
      encouragement: parsed.encouragement || "",
    };
  } catch (e) {
    // fallback: treat whole message as reflection only
    console.warn("JSON parse failed, using raw content as reflection.");
    return {
      reflection: content,
      encouragement: "",
    };
  }
}
