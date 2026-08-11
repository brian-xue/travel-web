import type { ReactNode } from "react";

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;

  for (const match of text.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }
    if (match[1] && match[2]) {
      nodes.push(
        <a href={match[2]} key={`${match[2]}-${index}`} rel="noreferrer" target="_blank">
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(<strong key={`strong-${index}`}>{match[3]}</strong>);
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function SafeMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n").filter((line, index, items) => line.trim() || items[index - 1]?.trim());

  return (
    <div className="markdown-block">
      {lines.map((line, index) => {
        if (line.startsWith("### ")) {
          return <h5 key={index}>{renderInline(line.slice(4))}</h5>;
        }
        if (line.startsWith("## ")) {
          return <h4 key={index}>{renderInline(line.slice(3))}</h4>;
        }
        if (line.startsWith("# ")) {
          return <h3 key={index}>{renderInline(line.slice(2))}</h3>;
        }
        if (line.startsWith("- ")) {
          return (
            <li className="markdown-list-item" key={index}>
              {renderInline(line.slice(2))}
            </li>
          );
        }
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
