import styled, { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-body: #f5f5f7;
    --bg-card: #ffffff;
    --bg-hover: #f9fafb;
    --bg-active: #eef2ff;
    --border: #e5e7eb;
    --text: #111827;
    --text-secondary: #6b7280;
    --text-muted: #9ca3af;
    --accent: #4f46e5;
    --accent-hover: #4338ca;
    --accent-light: #eef2ff;
    --green: #059669;
    --green-hover: #047857;
    --green-bg: #ecfdf5;
    --red: #dc2626;
    --red-hover: #b91c1c;
    --orange: #d97706;
    --orange-bg: #fffbeb;
    --radius: 8px;
    --radius-lg: 12px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,.05);
    --shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.04);
    --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: var(--bg-body);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

  a { color: var(--accent); text-decoration: none; transition: color .15s; }
  a:hover { color: var(--accent-hover); }

  button {
    font: inherit;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text);
    border-radius: var(--radius);
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    transition: all .15s;
    white-space: nowrap;
  }
  button:hover { background: var(--bg-hover); border-color: #d1d5db; }
  button:active { transform: scale(.98); }
  button:disabled { opacity: .5; cursor: not-allowed; transform: none; }

  button.btn-primary {
    background: var(--accent); color: #fff; border-color: var(--accent);
  }
  button.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  button.btn-green {
    background: var(--green); color: #fff; border-color: var(--green);
  }
  button.btn-green:hover { background: var(--green-hover); border-color: var(--green-hover); }
  button.btn-danger {
    color: var(--red); border-color: transparent; background: transparent;
  }
  button.btn-danger:hover { background: #fef2f2; color: var(--red-hover); }

  input, textarea, select {
    font: inherit;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 12px;
    background: var(--bg-card);
    color: var(--text);
    transition: border-color .15s, box-shadow .15s;
    outline: none;
  }
  input:focus, textarea:focus, select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79,70,229,.1);
  }
  input::placeholder, textarea::placeholder { color: var(--text-muted); }
`

export const Layout = styled.div`
  display: flex; flex-direction: column; height: 100vh;
`

export const TopBar = styled.header`
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px; height: 52px;
  background: var(--bg-card); border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0; z-index: 10;

  .brand {
    font-size: 18px; font-weight: 700; color: var(--text);
    letter-spacing: -.02em;
    display: flex; align-items: center; gap: 8px;
    &::before {
      content: '📝'; font-size: 20px;
    }
  }

  nav { display: flex; gap: 4px; height: 100%; }

  nav a {
    display: flex; align-items: center; padding: 0 14px; height: 100%;
    font-size: 14px; font-weight: 500; color: var(--text-secondary);
    border-bottom: 2px solid transparent; transition: all .15s;
    position: relative; top: 1px;
  }
  nav a:hover { color: var(--text); background: var(--bg-hover); }
  nav a.active { color: var(--accent); border-bottom-color: var(--accent); }

  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
`

export const Main = styled.main`
  flex: 1; overflow: auto; padding: 24px;
`

export function pageWrap(css: ReturnType<typeof styled.div>) {
  return styled(css)``
}
