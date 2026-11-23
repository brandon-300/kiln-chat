import { useMemo, type ReactNode } from "react";

type Block =
  | { type: "code"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const parts = source.split("```");
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const nl = part.indexOf("\n");
      const text = nl === -1 ? part : part.slice(nl + 1);
      blocks.push({ type: "code", text: text.replace(/\n$/, "") });
      return;
    }
    const paras = part.split(/\n{2,}/);
    for (const para of paras) {
      const lines = para.split("\n").filter((line) => line.trim().length > 0);
      if (lines.length === 0) continue;
      const unordered = lines.every((line) => /^[-*]\s+/.test(line.trim()));
      const ordered = lines.every((line) => /^\d+[.)]\s+/.test(line.trim()));
      if (unordered) {
        blocks.push({ type: "list", ordered: false, items: lines.map((l) => l.trim().replace(/^[-*]\s+/, "")) });
      } else if (ordered) {
        blocks.push({
          type: "list",
          ordered: true,
          items: lines.map((l) => l.trim().replace(/^\d+[.)]\s+/, "")),
        });
      } else {
        blocks.push({ type: "p", text: lines.join("\n") });
      }
    }
  });
  return blocks;
}

function inlineNodes(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(token);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="text-accent underline">
            {link[1]}
          </a>,
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  if (!text.trim()) return null;
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm leading-relaxed text-fg"
            >
              {block.text}
            </pre>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className={block.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="mb-1">
                  {inlineNodes(item, `${index}-${itemIndex}`)}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {inlineNodes(block.text, String(index))}
          </p>
        );
      })}
    </div>
  );
}
