import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, WorkoutLog } from '../types';
import { generateTrainerResponse } from '../services/trainerChatService';
import { UI_TEXT } from '../constants';
import { database } from '../config/firebase';
import { ref, set, get, remove } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';

interface TrainerChatProps {
  userProfile: UserProfile;
  lastWorkoutLog: WorkoutLog | null;
  previousWorkoutLogs?: WorkoutLog[];
}

const TrainerChat: React.FC<TrainerChatProps> = ({
  userProfile,
  lastWorkoutLog,
  previousWorkoutLogs = []
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user) return;
      
      try {
        const chatRef = ref(database, `users/${user.uid}/chatHistory`);
        const snapshot = await get(chatRef);
        
        if (snapshot.exists()) {
          setMessages(snapshot.val());
        } else {
          setMessages([{
            role: 'assistant',
            content: `Вітаю, ${userProfile.gender === 'male' ? 'друже' : 'подруго'}! Я твій персональний AI-тренер. Як я можу тобі допомогти сьогодні?`
          }]);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        setError('Помилка завантаження історії чату');
      }
    };

    loadChatHistory();
  }, [user, userProfile.gender]);

  useEffect(() => {
    const saveChatHistory = async () => {
      if (!user || messages.length === 0) return;
      
      try {
        const chatRef = ref(database, `users/${user.uid}/chatHistory`);
        await set(chatRef, messages);
      } catch (error) {
        console.error('Error saving chat history:', error);
        setError('Помилка збереження історії чату');
      }
    };

    saveChatHistory();
  }, [messages, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await generateTrainerResponse({
        userProfile,
        lastWorkoutLog,
        previousWorkoutLogs,
        userMessage,
        conversationHistory: messages
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e: any) {
      console.error('Error in chat:', e);
      setError(e.message || UI_TEXT.errorOccurred);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    
    try {
      const chatRef = ref(database, `users/${user.uid}/chatHistory`);
      await remove(chatRef);
      setMessages([{
        role: 'assistant',
        content: `Вітаю, ${userProfile.gender === 'male' ? 'друже' : 'подруго'}! Я твій персональний AI-тренер. Як я можу тобі допомогти сьогодні?`
      }]);
    } catch (error) {
      console.error('Error clearing chat:', error);
      setError('Помилка очищення чату');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-3 sm:p-4 border-b border-purple-700 flex justify-between items-center bg-purple-900/80">
        <h2 className="text-lg sm:text-xl font-semibold text-purple-200">Чат з тренером</h2>
        <button
          onClick={clearChat}
          className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded"
        >
          Очистити
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-3 text-sm sm:text-base break-words ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-200 border border-gray-600'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-200 rounded-lg p-3 border border-gray-600 text-sm sm:text-base">
              Тренер набирає повідомлення...
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-900/50 rounded border border-red-700">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-purple-700 bg-gray-800/50">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <textarea
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Напишіть повідомлення..."
            className="flex-1 p-2 sm:p-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 text-white placeholder-gray-400 resize-none min-h-[40px] max-h-[120px] text-sm sm:text-base"
            disabled={isLoading}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
          >
            Надіслати
          </button>
        </div>
        {isTyping && (
          <div className="text-xs sm:text-sm text-gray-400 mt-2">
            Набираєте повідомлення...
          </div>
        )}
      </form>
    </div>
  );
};

export default TrainerChat; 