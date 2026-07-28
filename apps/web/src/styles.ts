import styled, { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #f6f7f9;
    color: #24292f;
  }
  a { color: #0969da; text-decoration: none; }
  button {
    font: inherit;
    cursor: pointer;
    border: 1px solid #d0d7de;
    background: #fff;
    border-radius: 6px;
    padding: 5px 12px;
  }
  button:hover { background: #f3f4f6; }
  button.primary { background: #1f883d; border-color: #1f883d; color: #fff; }
  button.primary:hover { background: #1a7f37; }
  button.danger { color: #cf222e; }
  input, textarea {
    font: inherit;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 6px 10px;
  }
`

export const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #d0d7de;
  font-weight: 600;
  nav {
    display: flex;
    gap: 12px;
    font-weight: 400;
  }
`

export const Main = styled.main`
  flex: 1;
  overflow: auto;
  padding: 20px;
`
