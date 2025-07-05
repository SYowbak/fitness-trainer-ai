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
      if (!user || !database) return;
      
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
      if (!user || !database || messages.length === 0) return;
      
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!user || !database) return;
    
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
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-lg">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Чат з тренером</h2>
        <button
          onClick={clearChat}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Очистити чат
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 rounded-lg p-3">
              Тренер набирає повідомлення...
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Напишіть повідомлення..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-700"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Надіслати
          </button>
        </div>
        {isTyping && (
          <div className="text-sm text-gray-600 mt-1">
            Набираєте повідомлення...
          </div>
        )}
      </form>
    </div>
  );
};

export default TrainerChat; 