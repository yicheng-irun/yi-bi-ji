import { Suspense } from 'react'
import { Link, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { Layout, Main, TopBar } from './styles'

export default function App() {
  return (
    <Layout>
      <TopBar>
        <span>bi-ji</span>
        <nav>
          <Link to="/">笔记</Link>
          <Link to="/changes">变更</Link>
          <Link to="/conversations">会话</Link>
        </nav>
      </TopBar>
      <Main>
        <Suspense fallback={<p>加载中…</p>}>{useRoutes(routes)}</Suspense>
      </Main>
    </Layout>
  )
}
