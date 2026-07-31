import { useMemo } from 'react'
import { marked } from 'marked'
import styled from 'styled-components'

marked.setOptions({ gfm: true, breaks: true })

const Body = styled.div`
  font-size: 14px; line-height: 1.6; color: var(--text);
  min-width: 0; max-width: 100%;
  overflow-wrap: break-word; word-break: break-word;

  > :first-child { margin-top: 0; }
  > :last-child { margin-bottom: 0; }

  h1, h2, h3, h4, h5, h6 {
    line-height: 1.35; margin: .9em 0 .4em; font-weight: 700; color: var(--text);
  }
  h1 { font-size: 1.1em; }
  h2 { font-size: 1.05em; }
  h3, h4, h5, h6 { font-size: 1em; }

  p { margin: .5em 0; }

  ul, ol { padding-left: 1.5em; margin: .5em 0; }
  li { margin: .2em 0; }
  li > p { margin: .2em 0; }

  blockquote {
    margin: .6em 0; padding: .3em .8em; color: var(--text-secondary);
    border-left: 3px solid var(--border); background: var(--bg-hover);
    border-radius: 0 var(--radius) var(--radius) 0;
  }

  code {
    font-family: var(--font-mono); font-size: .88em;
    background: var(--bg-hover); padding: .12em .35em; border-radius: 4px;
  }
  pre {
    margin: .7em 0; padding: 10px 12px; overflow-x: auto; max-width: 100%;
    background: #1e293b; color: #e2e8f0; border-radius: var(--radius);
    line-height: 1.5;
  }
  pre code { background: transparent; padding: 0; color: inherit; font-size: .85em; white-space: pre; }

  hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }

  table { border-collapse: collapse; margin: .7em 0; display: block; max-width: 100%; overflow-x: auto; }
  th, td { border: 1px solid var(--border); padding: 4px 8px; text-align: left; }
  th { background: var(--bg-hover); font-weight: 600; }

  img { max-width: 100%; height: auto; border-radius: var(--radius); }
  a { color: var(--accent); overflow-wrap: break-word; }
`

export function ChatMarkdown({ content }: { content: string }) {
  const html = useMemo(
    () => marked.parse(content || '', { async: false }) as string,
    [content],
  )
  return <Body dangerouslySetInnerHTML={{ __html: html }} />
}
