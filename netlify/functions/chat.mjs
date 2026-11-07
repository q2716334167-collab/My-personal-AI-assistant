
export default async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "没有找到 Gemini API Key，请检查 Netlify 环境变量。" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const contents = messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-16)
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 8000) }]
      }));

    if (
      !contents.length ||
      contents[contents.length - 1].role !== "user"
    ) {
      return Response.json(
        { error: "请先发送一条消息。" },
        { status: 400 }
      );
    }

    const model =
      process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "你是小智 AI，一个友好、聪明、耐心的中文智能助手。请认真理解用户的问题，使用用户的语言回答，提供准确清晰的解释和实用建议。"
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "Gemini 请求失败。" },
        { status: response.status }
      );
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return Response.json(
        { error: "AI 暂时没有返回回答，请稍后重试。" },
        { status: 502 }
      );
    }

    return Response.json({ reply });

  } catch (error) {
    return Response.json(
      { error: "服务器错误，请检查部署配置。" },
      { status: 500 }
    );
  }
};
