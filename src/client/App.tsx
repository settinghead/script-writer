import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/client/components/ui/button";
import { ThemeProvider } from "@/client/components/theme-provider"
import { useChat } from '@ai-sdk/react';

import "./index.css";

const App: React.FC = () => {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/llm-api/chat/completions',
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e, {
      body: {
        model: import.meta.env.VITE_DEEPSEEK_MODEL_NAME || 'deepseek-chat',
      }
    });
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
        <h1 className="text-2xl font-bold mb-4 text-center">Streaming Chat UI</h1>

        {error && (
          <div className="p-2 mb-2 text-sm text-red-700 bg-red-100 rounded-md">
            <p>Error: {error.message}</p>
          </div>
        )}

        <div className="flex-grow overflow-y-auto mb-4 p-3 space-y-2 bg-gray-100 dark:bg-gray-800 rounded-md">
          {messages.length > 0
            ? messages.map(m => (
              <div key={m.id} className={`whitespace-pre-wrap p-2 rounded-md ${m.role === 'user' ? 'bg-blue-500 text-white self-end' : 'bg-gray-300 dark:bg-gray-700 self-start'}`}>
                <strong>{`${m.role === 'user' ? 'User' : 'AI'}: `}</strong>
                {m.content}
              </div>
            ))
            : <p className="text-gray-500 dark:text-gray-400 text-center">No messages yet. Ask something!</p>}
        </div>

        <form onSubmit={onSubmit} className="flex items-center">
          <input
            className="flex-grow p-2 border border-gray-300 dark:border-gray-700 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
            value={input}
            placeholder="Say something..."
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading} className="rounded-l-none">
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
