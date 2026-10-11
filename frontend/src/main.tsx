import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ThemeProvider, useTheme } from './lib/theme';
import { errorMessage } from './lib/api';
import { toast } from 'sonner';
import { installChunkErrorRecovery } from './lib/lazyWithRetry';

installChunkErrorRecovery();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  // Mutasyon hataları tek yerden toast olarak gösterilir (bileşen kendi hatasını yönetmiyorsa)
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (!mutation.options.onError && !mutation.meta?.silent) toast.error(errorMessage(error));
    },
  }),
});

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-right"
      closeButton
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-md)',
          fontFamily: 'var(--font-sans)',
        },
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
