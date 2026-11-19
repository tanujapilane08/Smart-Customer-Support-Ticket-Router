import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Admin() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTickets = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await axios.get('http://localhost:8000/admin/tickets', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTickets(response.data);
      } catch (err) {
        setError('Failed to load tickets. Ensure backend is running.');
      }
    };

    fetchTickets();
  }, [navigate]);

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>IT Admin Dashboard - All Tickets</h2>
        <button onClick={() => navigate('/tickets')} style={{ padding: '5px 10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Back to Ticket Entry
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#007bff', color: 'white' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Department</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Original Query</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr><td colSpan="3" style={{ padding: '10px', textAlign: 'center' }}>No tickets found.</td></tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ticket.id}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{ticket.department}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ticket.original_query}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}