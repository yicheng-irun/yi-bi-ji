import { Suspense } from 'react'
import { NavLink, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { Layout, Main, TopBar } from './styles'
import { Loading } from './components/Loading'

export default function App() {
  return (
    <Layout>
      <TopBar>
        <span className="brand">bi-ji</span>
        <nav>
          <NavLink to="/" end>笔记</NavLink>
          <NavLink to="/changes">变更</NavLink>
          <NavLink to="/conversations">会话</NavLink>
          <NavLink to="/ai-logs">AI 记录</NavLink>
        </nav>
        <div id="topbar-slot" className="slot" />
      </TopBar>
      <Main>
        <Suspense fallback={<Loading />}>{useRoutes(routes)}</Suspense>
      </Main>
    </Layout>
  )
}
