import React from 'react';

/**
 * Strip YAML frontmatter (---\n...\n---) from markdown content
 */
export function stripFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

/**
 * Lightweight markdown renderer for SKILL.md files.
 * Handles: headers, bold, inline code, code blocks, lists, tables, blockquotes, links, paragraphs.
 */
export const SkillMarkdown: React.FC<{ content: string }> = ({ content }) => {
    const clean = stripFrontmatter(content);
    const elements = parseMarkdown(clean);
    return <div className="skill-markdown">{elements}</div>;
};

function parseMarkdown(text: string): React.ReactNode[] {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Fenced code block
        if (line.trim().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            elements.push(
                <div key={key++} className="my-3 rounded-lg overflow-hidden border border-black/5">
                    {lang && (
                        <div className="px-3 py-1 bg-gray-100 border-b border-black/5 text-[10px] font-mono font-bold text-text-muted/50 uppercase tracking-wider">
                            {lang}
                        </div>
                    )}
                    <pre className="p-4 bg-gray-50 overflow-x-auto text-xs leading-relaxed">
                        <code className="text-text-main font-mono">{codeLines.join('\n')}</code>
                    </pre>
                </div>
            );
            continue;
        }

        // Headers
        if (line.startsWith('# ')) {
            elements.push(<h1 key={key++} className="text-xl font-bold text-text-main mt-6 mb-3 first:mt-0 font-display tracking-tight">{renderInline(line.slice(2))}</h1>);
            i++;
            continue;
        }
        if (line.startsWith('## ')) {
            elements.push(<h2 key={key++} className="text-lg font-bold text-text-main mt-5 mb-2 first:mt-0 font-display tracking-tight">{renderInline(line.slice(3))}</h2>);
            i++;
            continue;
        }
        if (line.startsWith('### ')) {
            elements.push(<h3 key={key++} className="text-sm font-bold text-text-main mt-4 mb-2 first:mt-0 uppercase tracking-widest">{renderInline(line.slice(4))}</h3>);
            i++;
            continue;
        }
        if (line.startsWith('#### ')) {
            elements.push(<h4 key={key++} className="text-sm font-bold text-text-muted mt-3 mb-1.5 first:mt-0">{renderInline(line.slice(5))}</h4>);
            i++;
            continue;
        }

        // Table
        if (line.includes('|') && lines[i + 1]?.match(/^\|[\s-:|]+\|/)) {
            const tableLines: string[] = [line];
            i++;
            // Skip separator line
            i++;
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                tableLines.push(lines[i]);
                i++;
            }

            const headers = tableLines[0].split('|').map(c => c.trim()).filter(Boolean);
            const rows = tableLines.slice(1).map(row => row.split('|').map(c => c.trim()).filter(Boolean));

            elements.push(
                <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-black/5">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 border-b border-black/5">
                                {headers.map((h, hi) => (
                                    <th key={hi} className="px-3 py-2 text-left font-bold text-text-main uppercase tracking-wider text-[10px]">
                                        {renderInline(h)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-black/3 last:border-0">
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="px-3 py-2 text-text-muted font-medium">
                                            {renderInline(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // Blockquote
        if (line.startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('>')) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            elements.push(
                <blockquote key={key++} className="my-3 pl-4 border-l-2 border-primary/30 text-sm text-text-muted italic leading-relaxed">
                    {renderInline(quoteLines.join(' '))}
                </blockquote>
            );
            continue;
        }

        // Unordered list
        if (line.match(/^(\s*)[-*]\s/)) {
            const listItems: { indent: number; text: string }[] = [];
            while (i < lines.length && lines[i].match(/^(\s*)[-*]\s/)) {
                const match = lines[i].match(/^(\s*)[-*]\s(.*)/)!;
                listItems.push({ indent: match[1].length, text: match[2] });
                i++;
            }
            elements.push(
                <ul key={key++} className="my-2 space-y-1.5">
                    {listItems.map((item, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-text-muted leading-relaxed" style={{ paddingLeft: `${Math.min(item.indent, 8) * 8}px` }}>
                            <span className="text-primary/40 mt-1.5 shrink-0 text-[6px]">●</span>
                            <span className="flex-1">{renderInline(item.text)}</span>
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // Ordered list
        if (line.match(/^\d+\.\s/)) {
            const listItems: string[] = [];
            while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
                listItems.push(lines[i].replace(/^\d+\.\s/, ''));
                i++;
            }
            elements.push(
                <ol key={key++} className="my-2 space-y-1.5 list-none">
                    {listItems.map((item, idx) => (
                        <li key={idx} className="flex gap-2.5 text-sm text-text-muted leading-relaxed">
                            <span className="text-primary font-bold text-xs mt-0.5 shrink-0 w-4 text-right">{idx + 1}.</span>
                            <span className="flex-1">{renderInline(item)}</span>
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        // Horizontal rule
        if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) {
            elements.push(<hr key={key++} className="my-4 border-gray-100" />);
            i++;
            continue;
        }

        // Paragraph — collect consecutive non-special lines
        {
            const paraLines: string[] = [line];
            i++;
            while (
                i < lines.length &&
                lines[i].trim() !== '' &&
                !lines[i].startsWith('#') &&
                !lines[i].startsWith('```') &&
                !lines[i].startsWith('>') &&
                !lines[i].match(/^(\s*)[-*]\s/) &&
                !lines[i].match(/^\d+\.\s/) &&
                !lines[i].match(/^(-{3,}|_{3,}|\*{3,})$/) &&
                !(lines[i].includes('|') && lines[i + 1]?.match(/^\|[\s-:|]+\|/))
            ) {
                paraLines.push(lines[i]);
                i++;
            }
            elements.push(
                <p key={key++} className="my-2 text-sm text-text-muted leading-relaxed">
                    {renderInline(paraLines.join(' '))}
                </p>
            );
        }
    }

    return elements;
}

/**
 * Render inline markdown: bold, inline code, links, strikethrough
 */
function renderInline(text: string): React.ReactNode {
    if (!text) return null;

    // Split on inline patterns and build fragments
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let fragKey = 0;

    while (remaining.length > 0) {
        // Find the earliest match of any inline pattern
        const patterns: { regex: RegExp; type: string }[] = [
            { regex: /`([^`]+)`/, type: 'code' },
            { regex: /\*\*([^*]+)\*\*/, type: 'bold' },
            { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
            { regex: /~~([^~]+)~~/, type: 'strike' },
        ];

        let earliest: { index: number; match: RegExpExecArray; type: string } | null = null;
        for (const p of patterns) {
            const m = p.regex.exec(remaining);
            if (m && (earliest === null || m.index < earliest.index)) {
                earliest = { index: m.index, match: m, type: p.type };
            }
        }

        if (!earliest) {
            parts.push(remaining);
            break;
        }

        // Add text before match
        if (earliest.index > 0) {
            parts.push(remaining.slice(0, earliest.index));
        }

        // Add formatted element
        const { match, type } = earliest;
        switch (type) {
            case 'code':
                parts.push(
                    <code key={fragKey++} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono font-semibold text-primary/80 border border-black/5">
                        {match[1]}
                    </code>
                );
                break;
            case 'bold':
                parts.push(
                    <strong key={fragKey++} className="font-bold text-text-main">{match[1]}</strong>
                );
                break;
            case 'link':
                parts.push(
                    <a key={fragKey++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 hover:decoration-primary font-semibold">
                        {match[1]}
                    </a>
                );
                break;
            case 'strike':
                parts.push(
                    <del key={fragKey++} className="text-text-muted/40">{match[1]}</del>
                );
                break;
        }

        remaining = remaining.slice(earliest.index + match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}
