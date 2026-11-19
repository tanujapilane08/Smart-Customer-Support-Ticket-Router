import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Tickets from './Tickets';
import Upload from './Upload';
import Admin from './Admin'; // <-- Add this import

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/admin" element={<Admin />} /> {/* <-- Add this route */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;