import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Ant Design theme customization — BDMTILES brand colors
const antdTheme = {
  token: {
    colorPrimary: '#FF5F03',
    colorLink: '#FF5F03',
    borderRadius: 8,
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    fontSize: 14,
  },
  components: {
    Button: {
      primaryColor: '#ffffff',
      borderRadius: 8,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#334155',
      rowHoverBg: '#fff7f0',
    },
    Menu: {
      itemSelectedBg: '#fff7f0',
      itemSelectedColor: '#FF5F03',
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={antdTheme}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
