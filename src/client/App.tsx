import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/client/components/ui/button";
import { ThemeProvider } from "@/client/components/theme-provider"

import "./index.css";

const App: React.FC = () => {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetch('/message')
      .then(res => res.text())
      .then(data => setMessage(data))
      .catch(err => console.error('Failed to fetch message:', err));
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">

      <div>
        <h1>Vite + React + Express</h1>
        <p>Message from server: {message}</p>
        <Button>lol</Button>
      </div>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
