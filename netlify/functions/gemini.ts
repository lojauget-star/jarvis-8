import { GoogleGenAI, Content, Tool, Part, FunctionDeclaration, FunctionCallingMode } from "@google/genai";

// --- Type Definitions ---
interface SimpleMessage {
  role: 'user' | 'model';
  text: string;
}

interface RequestBody {
    message: string;
    history: SimpleMessage[];
    token: string;
}

// --- Tool and Model Configuration ---

const getCalendarEventsTool: FunctionDeclaration = {
    name: "get_calendar_events",
    description: "Get a list of upcoming events from the user's Google Calendar. Use this to answer any questions about the user's schedule, appointments, or meetings.",
    parameters: {
        type: "OBJECT",
        properties: {},
        required: []
    }
};

const tools: Tool[] = [{
    functionDeclarations: [getCalendarEventsTool],
    // Add other tools like googleSearch here if needed
    // googleSearch: {}
}];

const mapHistory = (history: SimpleMessage[]): Content[] => {
    return history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));
};

const startChat = (history: SimpleMessage[]) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set on the server.");
    }
    const ai = new GoogleGenAI({ apiKey });
    return ai.chats.create({
      model: 'gemini-1.5-flash', // Updated model for better function calling
      history: mapHistory(history),
      tools: tools,
      config: {
        systemInstruction: "Você é Jarvis, um assistente de IA espirituoso, sofisticado e incrivelmente prestativo, inspirado no de Homem de Ferro. Responda em português brasileiro com uma mistura de profissionalismo, charme e um toque de humor seco. Mantenha suas respostas concisas e diretas, mas não tenha medo de ser um pouco brincalhão. Seu objetivo é ajudar o usuário de forma eficiente, mantendo sua personalidade única. Dirija-se ao usuário como 'Senhor'. Ao usar informações da internet, seja sucinto.",
      },
    });
}

// --- Main Handler ---

export default async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { message, history, token } = await req.json() as RequestBody;

        if (!token) {
             return new Response(JSON.stringify({ error: "Authentication token not provided." }), { status: 401, headers: {'Content-Type': 'application/json'} });
        }

        const chat = startChat(history);
        let result = await chat.sendMessageStream({ message });

        // This ReadableStream will be returned to the client.
        const responseStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                // Process the stream from the AI
                for await (const chunk of result) {
                    const functionCalls = chunk.functionCalls();

                    if (functionCalls && functionCalls.length > 0) {
                        // --- Tool Call Logic ---
                        // Currently handles the first tool call found.
                        const call = functionCalls[0];

                        if (call.name === 'get_calendar_events') {
                            console.log("Tool call received: get_calendar_events");

                            // Call our other serverless function to get calendar data
                            const calendarApiUrl = `${process.env.URL}/.netlify/functions/google-calendar`;
                            const toolResponse = await fetch(calendarApiUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: token })
                            });

                            const calendarData = await toolResponse.json();

                            // Send the tool response back to the model
                            result = await chat.sendMessageStream({
                                tool_code_response: {
                                    name: 'get_calendar_events',
                                    response: calendarData,
                                }
                            });

                            // Now, process the new stream that contains the AI's final answer
                            for await (const finalChunk of result) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
                            }

                        } else {
                            // Handle other potential tool calls here if necessary
                             console.warn(`Unhandled tool call: ${call.name}`);
                        }

                    } else {
                        // --- Standard Response Logic ---
                        // If there's no tool call, just stream the response
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    }
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
