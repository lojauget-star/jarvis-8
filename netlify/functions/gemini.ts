import { GoogleGenAI, Content } from "@google/genai";

// Types from the frontend to avoid pathing issues during build.
interface SimpleMessage {
  role: 'user' | 'model';
  text: string;
}

const mapHistory = (history: SimpleMessage[]): Content[] => {
    return history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));
};

const startChatWithHistory = (history: SimpleMessage[]) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set on the server.");
    }
    const ai = new GoogleGenAI({ apiKey });
    return ai.chats.create({
      model: 'gemini-2.5-flash',
      history: mapHistory(history),
      config: {
        systemInstruction: "Você é Jarvis, um assistente de IA espirituoso, sofisticado e incrivelmente prestativo, inspirado no de Homem de Ferro. Responda em português brasileiro com uma mistura de profissionalismo, charme e um toque de humor seco. Mantenha suas respostas concisas e diretas, mas não tenha medo de ser um pouco brincalhão. Seu objetivo é ajudar o usuário de forma eficiente, mantendo sua personalidade única. Dirija-se ao usuário como 'Senhor'. Ao usar informações da internet, seja sucinto.",
        thinkingConfig: { thinkingBudget: 0 },
        tools: [{googleSearch: {}}],
      },
    });
}

export default async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { message, history } = await req.json() as { message: string, history: SimpleMessage[]};
        const chat = startChatWithHistory(history);
        const stream = await chat.sendMessageStream({ message });

        const responseStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of stream) {
                    const chunkString = JSON.stringify(chunk);
                    controller.enqueue(encoder.encode(`data: ${chunkString}\n\n`));
                }
                controller.close();
            }
        });

        return new Response(responseStream, {
            headers: { 
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('Error in Gemini function:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: `An error occurred in the AI function: ${errorMessage}` }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }
};
