import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { Erangel } from '@/pages/Erangel';
import { Miramar } from '@/pages/Miramar';
import { Rondo } from '@/pages/Rondo';

function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/erangel" element={<Erangel />} />
          <Route path="/miramar" element={<Miramar />} />
          <Route path="/rondo" element={<Rondo />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
