import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { generateTrainerResponse } from '../services/trainerChatService';
import { UI_TEXT } from '../constants';
import { database } from '../config/firebase';
import { ref, set, get, remove } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface TrainerChatProps {
  userProfile: UserProfile;
  currentWorkoutPlan?: any[] | null;
  activeDay?: number | null;
  onWorkoutPlanModified?: (modifiedPlan: any) => void;
}

const TrainerChat: React.FC<TrainerChatProps> = ({
  userProfile,
  currentWorkoutPlan = null,
  activeDay = null,
  onWorkoutPlanModified
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = () => {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user) return;
      
      try {
        const chatRef = ref(database, `users/${user.uid}/chatHistory`);
        const snapshot = await get(chatRef);
        
        if (snapshot.exists()) {
          const chatData = snapshot.val();
          // Convert old format to new format if needed
          const formattedMessages = Array.isArray(chatData) 
            ? chatData.map((msg, index) => ({
                id: msg.id || `msg_${Date.now()}_${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp || Date.now()
              }))
            : Object.values(chatData as Record<string, ChatMessage>).map((msg, index) => ({
                id: msg.id || `msg_${Date.now()}_${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp || Date.now()
              }));
          setMessages(formattedMessages);
        } else {
          const welcomeMessage: ChatMessage = {
            id: `welcome_${Date.now()}`,
            role: 'assistant',
            content: `Вітаю, ${userProfile.gender === 'male' ? 'друже' : 'подруго'}! Я твій персональний AI-тренер. Як я можу тобі допомогти сьогодні?`,
            timestamp: Date.now()
          };
          setMessages([welcomeMessage]);
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
    
    const newUserMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await generateTrainerResponse({
        userProfile,
        userMessage,
        conversationHistory: messages.map(msg => ({ role: msg.role, content: msg.content })),
        currentWorkoutPlan,
        activeDay
      });

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Handle workout modifications
      if (response.modifiedPlan && onWorkoutPlanModified) {
        console.log('🔧 [TrainerChat] Отримано modifiedPlan:', {
          hasModifiedPlan: !!response.modifiedPlan,
          day: response.modifiedPlan?.day,
          exercisesCount: response.modifiedPlan?.exercises?.length,
          firstExercise: response.modifiedPlan?.exercises?.[0]?.name
        });
        
        onWorkoutPlanModified(response.modifiedPlan);
        
        // Add a system notification about the modification
        const notificationMessage: ChatMessage = {
          id: `notification_${Date.now()}`,
          role: 'assistant',
          content: `✅ План тренування оновлено! Зміни вступили в силу.`,
          timestamp: Date.now()
        };
        
        setTimeout(() => {
          setMessages(prev => [...prev, notificationMessage]);
        }, 500);
      }
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
      const welcomeMessage: ChatMessage = {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: `Вітаю, ${userProfile.gender === 'male' ? 'друже' : 'подруго'}! Я твій персональний AI-тренер. Як я можу тобі допомогти сьогодні?`,
        timestamp: Date.now()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error clearing chat:', error);
      setError('Помилка очищення чату');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    
    try {
      const updatedMessages = messages.filter(msg => msg.id !== messageId);
      setMessages(updatedMessages);
      
      const chatRef = ref(database, `users/${user.uid}/chatHistory`);
      await set(chatRef, updatedMessages);
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Помилка видалення повідомлення');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-3 sm:p-4 border-b border-fitness-gold-600/30 flex justify-between items-center bg-fitness-dark-800/80">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-fitness-gold-300">Чат з тренером</h2>
          <p className="text-xs text-gray-400">{messages.length} повідомлень</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (confirm('Ви впевнені, що хочете очистити всю історію чату?')) {
                clearChat();
              }
            }}
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors px-3 py-1 rounded border border-gray-600 hover:border-gray-500"
            title="Очистити всю історію"
          >
            <i className="fas fa-trash mr-1"></i>
            Очистити
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            <div className="flex items-start space-x-2 max-w-[85%] sm:max-w-[80%]">
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-fitness-gold-600 rounded-full flex items-center justify-center mt-1">
                  <i className="fas fa-dumbbell text-white text-xs"></i>
                </div>
              )}
              
              <div className="flex flex-col space-y-1">
                <div
                  className={`rounded-lg p-3 text-sm sm:text-base break-words relative ${
                    message.role === 'user'
                      ? 'bg-fitness-gold-600 text-white'
                      : 'bg-gray-700 text-gray-200 border border-gray-600'
                  }`}
                >
                  {message.content}
                  
                  {/* Delete button */}
                  <button
                    onClick={() => setShowDeleteConfirm(message.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 hover:bg-gray-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
                    title="Видалити повідомлення"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                  
                  {/* Delete confirmation popup */}
                  {showDeleteConfirm === message.id && (
                    <div className="absolute -top-10 -right-2 bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-lg z-10">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            deleteMessage(message.id);
                            setShowDeleteConfirm(null);
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Так
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Ні
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <div className={`text-xs text-gray-400 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
              
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mt-1">
                  <i className="fas fa-user text-white text-xs"></i>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2 max-w-[85%] sm:max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 bg-fitness-gold-600 rounded-full flex items-center justify-center mt-1">
                <i className="fas fa-dumbbell text-white text-xs"></i>
              </div>
              <div className="bg-gray-700 text-gray-200 rounded-lg p-3 border border-gray-600 text-sm sm:text-base">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-fitness-gold-400"></div>
                  <span>Тренер набирає повідомлення...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-gray-400 text-sm p-2 bg-gray-800/50 rounded border border-gray-600">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-fitness-gold-600/30 bg-gray-800/50">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <textarea
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Напишіть повідомлення..."
            className="flex-1 p-2 sm:p-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-fitness-gold-500 bg-gray-700 text-white placeholder-gray-400 resize-none min-h-[40px] max-h-[120px] text-sm sm:text-base"
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
            className="px-4 py-2 sm:py-3 bg-fitness-gold-600 text-white rounded-lg hover:bg-fitness-gold-700 focus:outline-none focus:ring-2 focus:ring-fitness-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
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