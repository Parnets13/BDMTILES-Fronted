import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

// ═══════════════════════════════════════════════════════════
// GLOBAL: Prevent accidental value changes on number inputs
// Works with both native <input type="number"> and Ant Design <InputNumber>
// ═══════════════════════════════════════════════════════════

// 1. Mouse scroll on focused number input → blur it (prevents scroll changing value)
document.addEventListener(
  'wheel',
  (e) => {
    const el = document.activeElement;
    if (!el) return;
    // Native number inputs
    if (el.type === 'number') { el.blur(); return; }
    // Ant Design InputNumber uses input[role="spinbutton"] or wraps in .ant-input-number
    if (el.getAttribute('role') === 'spinbutton' || el.closest('.ant-input-number')) {
      el.blur();
    }
  },
  { passive: true, capture: true }
);

// 2. Focus on number input → auto-select all text (type new value directly replaces old)
document.addEventListener(
  'focus',
  (e) => {
    const el = e.target;
    if (!el) return;
    if (el.type === 'number' || el.getAttribute('role') === 'spinbutton' || el.closest('.ant-input-number')) {
      setTimeout(() => { try { el.select(); } catch(err) {} }, 0);
    }
  },
  { capture: true }
);

// 3. Block Arrow Up/Down keys on number inputs (prevents accidental increment)
document.addEventListener(
  'keydown',
  (e) => {
    const el = document.activeElement;
    if (!el) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (el.type === 'number' || el.getAttribute('role') === 'spinbutton' || el.closest('.ant-input-number')) {
        e.preventDefault();
      }
    }
  },
  { capture: true }
);

// 4. Block alphabets/special chars on number inputs — only allow digits, dot, minus, backspace, tab, arrows
document.addEventListener(
  'keydown',
  (e) => {
    const el = document.activeElement;
    if (!el) return;
    const isNumberInput = el.type === 'number' || el.getAttribute('role') === 'spinbutton' || el.closest('.ant-input-number');
    if (!isNumberInput) return;

    // Allow: backspace, delete, tab, escape, enter, home, end, left, right
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End', 'ArrowLeft', 'ArrowRight'];
    if (allowedKeys.includes(e.key)) return;

    // Allow Ctrl/Cmd + A, C, V, X (select all, copy, paste, cut)
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;

    // Allow: digits 0-9, decimal point, minus sign
    if (/^[0-9.\-]$/.test(e.key)) return;

    // Block everything else (alphabets, special chars)
    e.preventDefault();
  },
  { capture: true }
);

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

import { ConfirmProvider } from './components/ConfirmModal.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={antdTheme}>
          <ConfirmProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ConfirmProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
