import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Tickets() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        'http://localhost:8000/tickets',
        { query: userText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages((prev) => [...prev, { 
        sender: 'ai', 
        text: response.data.ai_suggested_fix,
        department: response.data.assigned_department
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Connection to AI Core lost. Please retry.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '12px', height: '12px', background: '#00f2fe', borderRadius: '50%', boxShadow: '0 0 15px #00f2fe, 0 0 30px #00f2fe', animation: 'pulseDot 2s infinite' }}></div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>Smart Support Router</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/admin')} style={{ padding: '8px 16px', background: 'rgba(0, 255, 255, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 255, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: '0.3s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 255, 255, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'}>
            Database View
          </button>
          <button onClick={() => navigate('/upload')} style={{ padding: '8px 16px', background: 'rgba(0, 255, 255, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 255, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: '0.3s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 255, 255, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'}>
            Upload Manuals
          </button>
          <button onClick={() => { localStorage.removeItem('access_token'); navigate('/login'); }} style={{ padding: '8px 16px', background: 'rgba(255, 0, 85, 0.1)', color: '#ff0055', border: '1px solid rgba(255, 0, 85, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div style={{ flex: 1, padding: '25px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.length === 0 && (
          <div className="msg-anim" style={{ margin: 'auto', textAlign: 'center' }}>
            <h3 style={{ color: '#00f2fe', textShadow: '0 0 15px rgba(0,255,255,0.4)', fontSize: '24px' }}>System Initialized</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>Awaiting IT support queries...</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className="msg-anim" style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ 
              maxWidth: '75%', 
              padding: '16px 20px', 
              borderRadius: msg.sender === 'user' ? '20px 0 20px 20px' : '0 20px 20px 20px',
              background: msg.sender === 'user' ? 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' : 'rgba(0, 0, 0, 0.5)',
              border: msg.sender === 'user' ? 'none' : '1px solid rgba(0, 255, 255, 0.3)',
              color: 'white',
              fontSize: '15px',
              lineHeight: '1.6',
              boxShadow: msg.sender === 'user' ? '0 10px 20px rgba(0, 114, 255, 0.3)' : '0 5px 15px rgba(0,0,0,0.5)'
            }}>
              {msg.sender === 'ai' && msg.department && (
                <div style={{ fontSize: '12px', color: '#00f2fe', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Target Department: {msg.department}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg-anim" style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(0, 255, 255, 0.3)', padding: '16px 24px', borderRadius: '0 20px 20px 20px' }}>
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px', background: 'rgba(0, 0, 0, 0.3)', borderTop: '1px solid rgba(0, 255, 255, 0.1)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '15px' }}>
          <input 
            type="text" 
            className="glow-input"
            placeholder="Initialize support sequence..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1, padding: '16px 20px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 255, 255, 0.2)', color: 'white', fontSize: '15px', borderRadius: '12px' }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} style={{ padding: '0 30px', background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '16px', boxShadow: '0 0 20px rgba(0, 114, 255, 0.4)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            SEND
          </button>
        </form>
      </div>
      
    </div>
  );
}