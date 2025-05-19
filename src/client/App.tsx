import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        fetch('/message')
            .then(res => res.text())
            .then(data => setMessage(data))
            .catch(err => console.error('Failed to fetch message:', err));
    }, []);

    return (
        <div>
            <h1>Vite + React + Express</h1>
            <p>Message from server: {message}</p>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
