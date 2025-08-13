import { useState, useEffect, useRef, useCallback } from 'react';
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, SpeechSynthesisErrorEvent, Message, GenerateContentResponse } from '../types';

// Polyfill for webkitSpeechRecognition
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useJarvis = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isApiReady = true; // API is now proxied through a secure backend function.
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultCallbackRef = useRef<(transcript: string) => void>((_) => {});
  const utteranceQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const isCancelingRef = useRef(false);

  const isBrowserSupported = !!SpeechRecognitionApi && !!window.speechSynthesis;
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback((onResultCallback: (transcript: string) => void) => {
    if (isListening || isSpeaking || !isBrowserSupported) return;

    onResultCallbackRef.current = onResultCallback;
    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      onResultCallbackRef.current(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isListening, isSpeaking, isBrowserSupported]);


  const getJarvisResponseStream = useCallback(async (message: string, history: Message[]): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Error from Jarvis service: ${response.status} ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer) console.warn('Stream ended with incomplete data in buffer.', buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');

        // Process all complete messages
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            const jsonString = line.substring(6);
            if (jsonString) {
              try {
                yield JSON.parse(jsonString);
              } catch (e) {
                console.error('Failed to parse JSON from stream chunk:', jsonString, e);
              }
            }
          }
        }
        
        // The last part of the buffer might be an incomplete message, so we keep it.
        buffer = lines[lines.length - 1];
      }
    }

    return streamGenerator();
  }, []);

  const processQueue = useCallback(() => {
    if (window.speechSynthesis.speaking || utteranceQueueRef.current.length === 0) {
      return;
    }
    const utterance = utteranceQueueRef.current.shift();
    if (utterance) {
      isCancelingRef.current = false;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!isBrowserSupported || !text.trim()) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 3.0; // Increased speech rate by 2x from 1.5

    utterance.onstart = () => setIsSpeaking(true);

    utterance.onend = () => {
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (e) => {
      const errorEvent = e as SpeechSynthesisErrorEvent;
      if (errorEvent.error === 'interrupted' && isCancelingRef.current) {
        // This is an intentional cancellation, do not log an error.
        isCancelingRef.current = false;
      } else {
        console.error(`Speech synthesis error: ${errorEvent.error}`);
      }
      
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utteranceQueueRef.current.push(utterance);
    processQueue();
  }, [isBrowserSupported, processQueue]);

  const cancelSpeech = useCallback(() => {
    if (isBrowserSupported) {
      isCancelingRef.current = true;
      utteranceQueueRef.current = [];
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isBrowserSupported]);

  return { 
    isListening, 
    startListening, 
    stopListening, 
    isSpeaking, 
    speak,
    isApiReady,
    isBrowserSupported,
    getJarvisResponseStream,
    cancelSpeech,
  };
};