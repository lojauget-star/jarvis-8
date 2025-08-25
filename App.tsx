import React, { useState, useEffect, useRef } from 'react';
import { useGoogleLogin, googleLogout, TokenResponse } from '@react-oauth/google';
import { JarvisOrb } from './components/JarvisOrb';
import { ChatLog } from './components/ChatLog';
import { CalendarDisplay } from './components/CalendarDisplay';
import { MicButton } from './components/MicButton';
import { useJarvis } from './hooks/useJarvis';
import { JarvisStatus, Message, GroundingChunk } from './types';
import { AlertTriangle, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [jarvisStatus, setJarvisStatus] = useState<JarvisStatus>(JarvisStatus.IDLE);
  const [error, setError] = useState<string>('');
  const interruptSignalRef = useRef(false);

  const {
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    isApiReady,
    isBrowserSupported,
    getJarvisResponseStream,
    cancelSpeech,
  } = useJarvis();

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
        console.log('Login Success:', tokenResponse);
        setToken(tokenResponse);
    },
    onError: () => {
        console.error('Login Failed');
        setError('Falha no login com o Google. Por favor, tente novamente.');
    },
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });

  const handleInteraction = () => {
    if (jarvisStatus === JarvisStatus.THINKING || jarvisStatus === JarvisStatus.SPEAKING) {
      interruptSignalRef.current = true;
      cancelSpeech();
      setJarvisStatus(JarvisStatus.IDLE);
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening(handleUserMessage);
    }
  };
  
  useEffect(() => {
    if (isListening) {
      setJarvisStatus(JarvisStatus.LISTENING);
    } else if (isSpeaking) {
      setJarvisStatus(JarvisStatus.SPEAKING);
    } else if (jarvisStatus !== JarvisStatus.THINKING) {
      setJarvisStatus(JarvisStatus.IDLE);
    }
  }, [isListening, isSpeaking, jarvisStatus]);

  const handleUserMessage = async (text: string) => {
    if (!text.trim() || !token) return;
    interruptSignalRef.current = false;
    setJarvisStatus(JarvisStatus.THINKING);
    const userMessage: Message = { role: 'user', text };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);

    try {
      const stream = await getJarvisResponseStream(text, messages, token.access_token);
      let fullResponseText = '';
      let speechBuffer = '';
      let collectedChunks: GroundingChunk[] = [];
      
      const modelMessage: Message = { role: 'model', text: '', sources: [] };
      setMessages(prev => [...prev, modelMessage]);

      for await (const chunk of stream) {
        if (interruptSignalRef.current) break;
        const chunkText = chunk.text;
        if(chunkText) {
          fullResponseText += chunkText;
          speechBuffer += chunkText;
        }
        const newGroundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (newGroundingChunks) {
            collectedChunks.push(...newGroundingChunks);
        }
        setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if(lastMessage && lastMessage.role === 'model') {
                lastMessage.text = fullResponseText;
                if (collectedChunks.length > 0) {
                  const validChunksWithUri = collectedChunks.filter(c => c.web?.uri);
                  const uniqueSources = Array.from(new Map(validChunksWithUri.map(item => [item.web!.uri!, item])).values());
                  lastMessage.sources = uniqueSources;
                }
            }
            return updated;
        });
        const sentences = speechBuffer.match(/[^.!?]+[.!?]+/g);
        if (sentences) {
          sentences.forEach(sentence => speak(sentence));
          speechBuffer = speechBuffer.substring(sentences.join('').length);
        }
      }
      if (speechBuffer.trim() && !interruptSignalRef.current) {
        speak(speechBuffer.trim());
      }
      if (!interruptSignalRef.current && !fullResponseText.trim()) {
        setJarvisStatus(JarvisStatus.IDLE);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
      setError(`Erro de Sistema Jarvis: ${errorMessage}`);
      const errorText = `Peço desculpas, Senhor. Encontrei um erro interno.`;
      setMessages(prev => [...prev, { role: 'model', text: errorText }]);
      speak(errorText);
      setJarvisStatus(JarvisStatus.IDLE);
    }
  };
  
  const handleLogout = () => {
    googleLogout();
    setToken(null);
    setMessages([]);
  };

  const backgroundStyle = {
    backgroundImage: `
      linear-gradient(rgba(0, 242, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 242, 255, 0.03) 1px, transparent 1px)
    `,
    backgroundSize: '30px 30px',
  };

  const LoginScreen: React.FC = () => (
    <div className="bg-jarvis-bg h-screen text-white font-mono flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0" style={backgroundStyle}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(12,58,94,0.15)_0%,_transparent_50%)]"></div>
      <div className="z-10 text-center">
        <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-jarvis-blue to-blue-400 mb-2">J.A.R.V.I.S.</h1>
        <p className="text-xl text-gray-300 mb-8">Just A Rather Very Intelligent System</p>
        <p className="text-gray-400 mb-6">É necessário conceder permissão à sua Agenda Google para continuar.</p>
        <button
          onClick={() => login()}
          className="bg-jarvis-blue hover:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-lg shadow-blue-500/20"
        >
          Conectar com o Google
        </button>
        {error && <div className="text-red-400 mt-4">{error}</div>}
      </div>
    </div>
  );

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="bg-jarvis-bg h-screen text-white font-mono flex flex-col items-center p-2 sm:p-4 relative overflow-hidden">
        <div className="absolute inset-0" style={backgroundStyle}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(12,58,94,0.15)_0%,_transparent_50%)]"></div>

        <div className="w-full max-w-7xl mx-auto z-10 flex justify-end absolute top-2 right-2">
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <LogOut size={20} />
            </button>
        </div>

        <header className="w-full max-w-7xl mx-auto z-10 flex flex-col items-center pt-4 pb-2 flex-shrink-0">
             <JarvisOrb status={jarvisStatus} onClick={handleInteraction} />
        </header>

        <main className="flex-grow w-full max-w-4xl z-10 overflow-y-auto mb-2 no-scrollbar flex flex-col">
            <CalendarDisplay token={token.access_token} />
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 p-4 flex flex-col items-center justify-center h-full">
                <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-jarvis-blue to-blue-400 mb-2">J.A.R.V.I.S.</h1>
                <p className="text-lg text-gray-300">Pronto para ajudar, Senhor.</p>
                <p className="mt-6 text-sm">Clique no orbe ou no microfone para começar.</p>
              </div>
            ) : <ChatLog messages={messages} isResponding={jarvisStatus === JarvisStatus.THINKING || jarvisStatus === JarvisStatus.SPEAKING} />}
        </main>

        <footer className="w-full max-w-3xl z-10 py-2 flex flex-col items-center flex-shrink-0">
            { !isBrowserSupported && <div className="text-yellow-400 flex items-center gap-2 mb-2 p-2 text-xs sm:text-sm bg-yellow-900/50 rounded-lg"><AlertTriangle size={16} /> A API de Fala da Web não é suportada por este navegador. A entrada de voz está desativada.</div>}
            { error && <div className="text-red-400 flex items-center gap-2 mb-2 p-2 text-xs sm:text-sm bg-red-900/50 rounded-lg"><AlertTriangle size={16} /> {error}</div>}
             <div className="flex items-center space-x-4">
                <MicButton
                    jarvisStatus={jarvisStatus}
                    onClick={handleInteraction}
                    disabled={!isApiReady || !isBrowserSupported}
                />
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Interface J.A.R.V.I.S v2.6 | Para assistência, fale claramente.
            </p>
        </footer>
    </div>
  );
};

export default App;