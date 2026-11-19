import Link from "next/link"

import { parseBody, type Block, type Inline } from "../contracts/markdown"

/**
 * Renders the minimal markdown of an article. It maps the parsed tree to
 * React elements: no raw-HTML injection API is used, so raw HTML in the source is
 * shown as text. Links were already limited to http(s), mailto and relative
 * paths by the parser.
 */
function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return n.text
          case "code":
            return (
              <code key={i} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">
                {n.text}
              </code>
            )
          case "strong":
            return (
              <strong key={i} className="font-semibold">
                <Inlines nodes={n.children} />
              </strong>
            )
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.children} />
              </em>
            )
          case "link": {
            const cls = "text-primary underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
            return n.external ? (
              <a key={i} href={n.href} className={cls} target="_blank" rel="noopener noreferrer nofollow">
                <Inlines nodes={n.children} />
              </a>
            ) : (
              <Link key={i} href={n.href} className={cls}>
                <Inlines nodes={n.children} />
              </Link>
            )
          }
        }
      })}
    </>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 className="mt-2 text-lg font-semibold">
          <Inlines nodes={block.children} />
        </h2>
      ) : (
        <h3 className="mt-1 text-base font-semibold">
          <Inlines nodes={block.children} />
        </h3>
      )
    case "paragraph":
      return (
        <p className="text-sm leading-relaxed">
          <Inlines nodes={block.children} />
        </p>
      )
    case "quote":
      return (
        <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
          <Inlines nodes={block.children} />
        </blockquote>
      )
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
          <code>{block.text}</code>
        </pre>
      )
    case "list": {
      const items = block.items.map((it, i) => (
        <li key={i}>
          <Inlines nodes={it} />
        </li>
      ))
      return block.ordered ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed">{items}</ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">{items}</ul>
      )
    }
  }
}

export function RichText({ body }: { body: string }) {
  const blocks = parseBody(body)
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  )
}
