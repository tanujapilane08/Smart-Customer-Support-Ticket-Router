import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const res = await axios.get('http://localhost:8000/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.post('http://localhost:8000/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setMessage(res.data.message);
      setFile(null);
      e.target.reset();
      fetchDocuments();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (docId) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`http://localhost:8000/documents/${docId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setViewingDoc(res.data);
    } catch (err) {
      alert('Could not load file content.');
    }
  };

  return (
    <div style={{ width: '90%', maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', padding: '30px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Upload Knowledge Base (PDF, DOCX, CSV)</h2>
        <button onClick={() => navigate('/tickets')} style={{ padding: '8px 14px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Back to Tickets
        </button>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.3)' }}>
        <input
          type="file"
          accept=".pdf,.docx,.csv"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ color: 'white' }}
          required
        />
        <button type="submit" disabled={loading || !file} style={{ padding: '12px', background: loading || !file ? '#475569' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: loading || !file ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          {loading ? 'Indexing to AI Database...' : 'Upload to AI Database'}
        </button>
      </form>

      {message && <p style={{ marginTop: '12px', color: '#34d399', fontWeight: 'bold' }}>{message}</p>}

      {/* Uploaded Files Count & Table */}
      <h3 style={{ marginTop: '30px', marginBottom: '12px' }}>
        Uploaded Files ({documents.length})
      </h3>

      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(59, 130, 246, 0.3)' }}>
              <th style={{ padding: '10px', borderBottom: '1px solid #334155' }}>File Name</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #334155' }}>Type</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #334155' }}>Uploaded</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #334155' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#94a3b8' }}>
                  No files uploaded yet.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '10px' }}>{doc.filename}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#60a5fa' }}>{doc.file_type}</td>
                  <td style={{ padding: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => handleView(doc.id)} style={{ padding: '5px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* File Content Preview Modal */}
      {viewingDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '90%', maxWidth: '700px', maxHeight: '80vh', background: '#1e293b', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #475569' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>{viewingDoc.filename}</h3>
              <button onClick={() => setViewingDoc(null)} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Close
              </button>
            </div>
            <div style={{ overflowY: 'auto', whiteSpace: 'pre-wrap', background: '#0f172a', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6', color: '#e2e8f0' }}>
              {viewingDoc.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}