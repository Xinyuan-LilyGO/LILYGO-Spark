/// <reference types="vite/client" />

declare global {
  const __INCLUDE_WIN_FONTS__: boolean
}

declare module 'rss-parser/dist/rss-parser.min.js' {
  interface ParserItem {
    guid?: string
    link?: string
    title?: string
    contentSnippet?: string
    pubDate?: string
    content?: string
  }
  class Parser {
    parseURL(url: string): Promise<{ items: ParserItem[] }>
  }
  export default Parser
}

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    off: (channel: string, ...args: any[]) => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
  }
}
