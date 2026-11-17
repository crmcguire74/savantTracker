// 📄 A small Markdown renderer for the User Guide. It covers what the guide uses: headings,
// paragraphs, nested lists, tables, block quotes, code, rules, bold, italic, inline code and links.
// It builds React elements, never HTML strings, so nothing in the file can inject markup.

import { Fragment, type ReactNode } from 'react'

/** "8. The tracker and monday.com" -> "8-the-tracker-and-mondaycom", the same ids GitHub makes. */
export const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

export interface Heading {
  level: number
  text: string
  id: string
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }

interface ListItem {
  text: string
  children: ListItem[]
  ordered: boolean
}

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

/** Lines -> blocks. Pure, so it can be tested without a DOM. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }
    if (line.trim().startsWith('```')) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) body.push(lines[index++])
      index += 1
      blocks.push({ kind: 'code', text: body.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'rule' })
      index += 1
      continue
    }
    if (line.trim().startsWith('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1])) {
      const head = cells(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].trim().startsWith('|')) rows.push(cells(lines[index++]))
      blocks.push({ kind: 'table', head, rows })
      continue
    }
    if (line.trim().startsWith('>')) {
      const body: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) body.push(lines[index++].trim().replace(/^>\s?/, ''))
      blocks.push({ kind: 'quote', text: body.join(' ') })
      continue
    }
    if (LIST.test(line)) {
      const items: Array<{ indent: number; ordered: boolean; text: string }> = []
      while (index < lines.length) {
        const match = LIST.exec(lines[index])
        if (match) {
          items.push({ indent: match[1].length, ordered: /\d/.test(match[2]), text: match[3] })
          index += 1
        } else if (lines[index].trim() && /^\s{2,}/.test(lines[index]) && items.length > 0) {
          items[items.length - 1].text += ` ${lines[index].trim()}`
          index += 1
        } else break
      }
      blocks.push({ kind: 'list', ordered: items[0].ordered, items: nest(items) })
      continue
    }
    const body: string[] = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s/.test(lines[index]) && !LIST.test(lines[index]) && !lines[index].trim().startsWith('|') && !lines[index].trim().startsWith('```') && !lines[index].trim().startsWith('>')) {
      body.push(lines[index++].trim())
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') })
  }
  return blocks
}

function nest(flat: Array<{ indent: number; ordered: boolean; text: string }>): ListItem[] {
  const root: ListItem[] = []
  const stack: Array<{ indent: number; children: ListItem[] }> = [{ indent: -1, children: root }]
  for (const entry of flat) {
    while (stack.length > 1 && entry.indent <= stack[stack.length - 1].indent) stack.pop()
    const item: ListItem = { text: entry.text, children: [], ordered: entry.ordered }
    stack[stack.length - 1].children.push(item)
    stack.push({ indent: entry.indent, children: item.children })
  }
  return root
}

export const headingsOf = (source: string): Heading[] =>
  parseMarkdown(source)
    .filter((block): block is Extract<Block, { kind: 'heading' }> => block.kind === 'heading')
    .map((block) => ({ level: block.level, text: stripInline(block.text), id: slug(stripInline(block.text)) }))

const stripInline = (text: string): string => text.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g

function inline(text: string, onAnchor: (id: string) => void): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{inline(part.slice(2, -2), onAnchor)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('#')) {
        return (
          <a
            key={index}
            href={href}
            onClick={(event) => {
              event.preventDefault()
              onAnchor(href.slice(1))
            }}
          >
            {label}
          </a>
        )
      }
      // Links to repository files (README.md) mean nothing inside the app; show the words only.
      if (!/^https?:/i.test(href)) return <Fragment key={index}>{label}</Fragment>
      return (
        <a key={index} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>
    return <Fragment key={index}>{part}</Fragment>
  })
}

function List({ items, ordered, onAnchor }: { items: ListItem[]; ordered: boolean; onAnchor: (id: string) => void }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag>
      {items.map((item, index) => (
        <li key={index}>
          {inline(item.text, onAnchor)}
          {item.children.length > 0 && <List items={item.children} ordered={item.children[0].ordered} onAnchor={onAnchor} />}
        </li>
      ))}
    </Tag>
  )
}

export function Markdown({ source, onAnchor }: { source: string; onAnchor: (id: string) => void }) {
  return (
    <>
      {parseMarkdown(source).map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2'
            return (
              <Tag key={index} id={`guide-${slug(stripInline(block.text))}`}>
                {inline(block.text, onAnchor)}
              </Tag>
            )
          }
          case 'paragraph':
            return <p key={index}>{inline(block.text, onAnchor)}</p>
          case 'list':
            return <List key={index} items={block.items} ordered={block.ordered} onAnchor={onAnchor} />
          case 'table':
            return (
              <div key={index} className="guide-table">
                <table>
                  <thead>
                    <tr>
                      {block.head.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col">
                          {inline(cell, onAnchor)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{inline(cell, onAnchor)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'quote':
            return <blockquote key={index}>{inline(block.text, onAnchor)}</blockquote>
          case 'code':
            return (
              <pre key={index}>
                <code>{block.text}</code>
              </pre>
            )
          case 'rule':
            return <hr key={index} />
        }
      })}
    </>
  )
}
