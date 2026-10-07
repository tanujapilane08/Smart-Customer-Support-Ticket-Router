import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Settings, Upload, FileText, Send, Bot, User } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hello! 👋\nI can answer questions from company documents.' }]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const suggestedQuestions = [
    "What is the leave policy?",
    "How many casual leaves are allowed?",
    "What is the work-from-home policy?"
  ];

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`);
      setDocuments(res.data);
    } catch (error) {
      console.error("Error fetching docs", error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/upload`, formData);
      fetchDocuments();
    } catch (error) {
      alert("Error uploading document");
    }
    setIsUploading(false);
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, { query: text });
      setMessages([...newMessages, { role: 'assistant', text: res.data.response }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', text: 'Sorry, I encountered an error connecting to the server.' }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="font-bold text-gray-800 flex items-center gap-2">
            🏢 AI Assistant
          </h1>
          <Settings className="w-5 h-5 text-gray-500 cursor-pointer" />
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            📚 Documents
          </h2>
          <ul className="space-y-2">
            {documents.length === 0 ? (
              <li className="text-sm text-gray-400">No documents yet</li>
            ) : (
              documents.map((doc, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-center gap-2 p-2 hover:bg-gray-100 rounded-md cursor-pointer">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="truncate">{doc.filename}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="p-4 border-t border-gray-200">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt" />
          <button 
            onClick={() => fileInputRef.current.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : '+ Upload Document'}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white text-center text-gray-600 font-medium">
          Company AI Assistant 🤖
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[70%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`p-4 rounded-lg whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-500 p-4 rounded-lg rounded-tl-none shadow-sm">
                Thinking...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            
            {messages.length === 1 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 border border-gray-200 transition-colors"
                    >
                      • {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Ask about company policies..."
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
              <button 
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;