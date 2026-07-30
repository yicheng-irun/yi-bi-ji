import { useMemo } from 'react'
import { marked } from 'marked'
import styled from 'styled-components'

marked.setOptions({ gfm: true, breaks: true })

const Body = styled.div`
  flex: 1; min-width: 0; min-height: 0; overflow: auto;
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  background: var(--bg-card); padding: 16px 24px;
  line-height: 1.75; font-size: 15px; color: var(--text);

  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.2em 0 .6em; font-weight: 700; }
  h1 { font-size: 1.7em; border-bottom: 1px solid var(--border); padding-bottom: .3em; }
  h2 { font-size: 1.4em; border-bottom: 1px solid var(--border); padding-bottom: .3em; }
  h3 { font-size: 1.2em; }
  h4 { font-size: 1.05em; }
  p { margin: .8em 0; }
  a { color: var(--accent); }
  ul, ol { padding-left: 1.6em; margin: .8em 0; }
  li { margin: .25em 0; }
  blockquote {
    margin: .8em 0; padding: .4em 1em; color: var(--text-secondary);
    border-left: 4px solid var(--border); background: var(--bg-hover); border-radius: 0 var(--radius) var(--radius) 0;
  }
  code {
    font-family: var(--font-mono); font-size: .88em;
    background: var(--bg-hover); padding: .15em .4em; border-radius: 4px;
  }
  pre {
    margin: .9em 0; padding: 14px 16px; overflow: auto;
    background: #1e293b; color: #e2e8f0; border-radius: var(--radius);
    line-height: 1.6;
  }
  pre code { background: transparent; padding: 0; color: inherit; font-size: .85em; }
  hr { border: none; border-top: 1px solid var(--border); margin: 1.4em 0; }
  table { border-collapse: collapse; margin: .9em 0; width: 100%; }
  th, td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
  th { background: var(--bg-hover); font-weight: 600; }
  img { max-width: 100%; border-radius: var(--radius); }
  > :first-child { margin-top: 0; }
  > :last-child { margin-bottom: 0; }
`

export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(
    () => marked.parse(content || '', { async: false }) as string,
    [content],
  )
  return <Body className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}
