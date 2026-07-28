import { Suspense } from 'react'
import { NavLink, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { Layout, Main, TopBar } from './styles'

export default function App() {
  return (
    <Layout>
      <TopBar>
        <span className="brand">bi-ji</span>
        <nav>
          <NavLink to="/" end>笔记</NavLink>
          <NavLink to="/changes">变更</NavLink>
          <NavLink to="/conversations">会话</NavLink>
        </nav>
      </TopBar>
      <Main>
        <Suspense fallback={<p>加载中…</p>}>{useRoutes(routes)}</Suspense>
      </Main>
    </Layout>
  )
}
