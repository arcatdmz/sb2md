export interface ConvertOptions {
  internalLinkBase?: string | null;
}

interface ParseResult {
  markdown: string;
  next: number;
}

const imageExtensions = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const urlPattern = /^https?:\/\//i;
const imageStart = "\uE000";
const imageEnd = "\uE001";

export function convert(source: string | string[], options: ConvertOptions = {}): string {
  const lines = Array.isArray(source) ? source.slice() : source.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const blocks: string[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i] ?? "";
    if (line.startsWith("code:")) {
      const result = parseCodeBlock(lines, i);
      blocks.push(result.markdown);
      i = result.next;
      continue;
    }
    if (line.startsWith("table:")) {
      const result = parseTableBlock(lines, i, options);
      blocks.push(result.markdown);
      i = result.next;
      continue;
    }
    blocks.push(convertLine(line, options));
    i += 1;
  }
  return blocks
    .join("\n")
    .replace(/^[\t ]+/gm, (indent) => indent.replace(/\t/g, "  "))
    .replace(/[ \t]+$/gm, "");
}

export const sb2md = convert;

function parseCodeBlock(lines: string[], start: number): ParseResult {
  const title = lines[start].slice("code:".length).trim();
  const lang = codeLanguage(title);
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line !== "" && !/^[\t ]/.test(line)) break;
    body.push(line.replace(/^[\t ]/, ""));
    i += 1;
  }
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  return {
    markdown: `\`\`\`${lang}\n${body.join("\n")}\n\`\`\``,
    next: i,
  };
}

function parseTableBlock(lines: string[], start: number, options: ConvertOptions): ParseResult {
  const rows: string[][] = [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line === "" || line.startsWith("code:") || line.startsWith("table:")) break;
    if (!line.includes("\t")) break;
    rows.push(line.replace(/^[\t ]/, "").split("\t").map((cell) => convertInline(cell.trim(), options)));
    i += 1;
  }
  if (rows.length === 0) {
    return { markdown: `<!-- ${escapeHtmlComment(lines[start])} -->`, next: start + 1 };
  }

  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => Array.from({ length: width }, (_, idx) => escapeTableCell(row[idx] ?? "")));
  const header = normalized[0];
  const body = normalized.slice(1);
  const markdown = [
    tableRow(header),
    tableRow(header.map(() => "---")),
    ...body.map(tableRow),
  ].join("\n");
  return { markdown, next: i };
}

function convertLine(line: string, options: ConvertOptions): string {
  const indent = line.match(/^[\t ]*/)?.[0] ?? "";
  const body = line.slice(indent.length);
  const indentMarkdown = indent.length > 0 ? `${"  ".repeat(indent.length)}- ` : "";

  if (body.startsWith(">")) {
    const quote = body.slice(1).replace(/^[\t ]?/, "");
    return formatInlineLine(`${indentMarkdown}> `, quote, options);
  }

  return formatInlineLine(indentMarkdown, body, options);
}

function convertInline(text: string, options: ConvertOptions): string {
  return stripImageMarkers(convertInlineMarked(text, options));
}

function convertInlineMarked(text: string, options: ConvertOptions): string {
  let out = "";
  for (let i = 0; i < text.length;) {
    if (text[i] === "`") {
      const result = readCodeSpan(text, i);
      out += result.markdown;
      i = result.next;
      continue;
    }
    if (text[i] === "[") {
      const result = readBracket(text, i, options);
      if (result) {
        out += result.markdown;
        i = result.next;
        continue;
      }
    }
    if (text[i] === "#" && isHashLinkStart(text, i)) {
      const result = readHashLink(text, i, options);
      out += result.markdown;
      i = result.next;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function readCodeSpan(text: string, start: number): ParseResult {
  let tickCount = 1;
  while (text[start + tickCount] === "`") tickCount += 1;
  const fence = "`".repeat(tickCount);
  const end = text.indexOf(fence, start + tickCount);
  if (end < 0) return { markdown: text[start], next: start + 1 };
  const code = text.slice(start + tickCount, end);
  return { markdown: `${fence}${code}${fence}`, next: end + tickCount };
}

function readBracket(text: string, start: number, options: ConvertOptions): ParseResult | null {
  if (text.startsWith("[[", start)) {
    const end = text.indexOf("]]", start + 2);
    if (end < 0) return null;
    return {
      markdown: `**${convertInlineMarked(text.slice(start + 2, end), options)}**`,
      next: end + 2,
    };
  }

  const end = findBracketEnd(text, start);
  if (end < 0) return null;
  const raw = text.slice(start + 1, end);
  if (raw === "") return { markdown: "[]", next: end + 1 };

  const styled = raw.match(/^([*_/$-]+)\s+([\s\S]*)$/);
  if (styled) {
    const [, marker, content] = styled;
    const body = convertInlineMarked(content, options);
    return { markdown: formatStyled(marker, body), next: end + 1 };
  }

  return { markdown: convertLink(raw, options), next: end + 1 };
}

function findBracketEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "[") depth += 1;
    if (text[i] === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function formatStyled(marker: string, body: string): string {
  const kind = marker[0];
  switch (kind) {
    case "*":
      return `**${body}**`;
    case "-":
      return `~~${body}~~`;
    case "_":
      return `<u>${body}</u>`;
    case "/":
      return `*${body}*`;
    case "$":
      return `$${body}$`;
    default:
      return `[${marker} ${body}]`;
  }
}

function convertLink(raw: string, options: ConvertOptions): string {
  const segments = raw.trim().split(/\s+/);
  const first = segments[0] ?? "";
  const last = segments[segments.length - 1] ?? "";

  if (segments.length > 1 && urlPattern.test(first)) {
    const href = first;
    const label = raw.trim().slice(first.length).trim();
    return markdownLink(label || href, href);
  }
  if (segments.length > 1 && urlPattern.test(last)) {
    const href = last;
    const label = raw.trim().slice(0, -last.length).trim();
    return markdownLink(label || href, href);
  }
  if (urlPattern.test(raw.trim())) {
    const href = raw.trim();
    return imageMarkdown(href) ?? markdownLink(href, href);
  }
  if (raw.startsWith("/")) {
    const [, project = "", ...pageParts] = raw.split("/");
    const page = pageParts.join("/");
    const href = `https://scrapbox.io/${encodeURIComponent(project)}${page ? `/${encodePath(page)}` : ""}`;
    return markdownLink(raw, href);
  }

  return markdownLink(raw, internalHref(raw, options));
}

function readHashLink(text: string, start: number, options: ConvertOptions): ParseResult {
  let end = start + 1;
  while (end < text.length && !/[\s\])},.;:!?]/.test(text[end])) end += 1;
  const keyword = text.slice(start + 1, end);
  return { markdown: markdownLink(`#${keyword}`, internalHref(keyword, options)), next: end };
}

function isHashLinkStart(text: string, index: number): boolean {
  const prev = index === 0 ? "" : text[index - 1];
  const next = text[index + 1] ?? "";
  if (!next || /\s/.test(next)) return false;
  if (prev && !/\s|[([{]/.test(prev)) return false;
  return true;
}

function internalHref(title: string, options: ConvertOptions): string {
  const encoded = encodePath(title);
  const base = options.internalLinkBase?.replace(/\/$/, "");
  return base ? `${base}/${encoded}` : `./${encoded}.md`;
}

function markdownLink(label: string, href: string): string {
  const image = imageMarkdown(href, label);
  if (image) return image;
  return `[${escapeLinkLabel(label)}](${escapeUrl(href)})`;
}

function imageMarkdown(href: string, label = href): string | null {
  if (isGyazoUrl(href)) {
    const thumb = `${href.replace(/\/$/, "")}/thumb/250`;
    const alt = label === href ? thumb : label;
    return markImage(`[![${escapeAlt(alt)}](${escapeUrl(thumb)})](${escapeUrl(href)})`);
  }
  if (imageExtensions.test(href)) {
    return markImage(`![${escapeAlt(label)}](${escapeUrl(href)})`);
  }
  return null;
}

function formatInlineLine(prefix: string, body: string, options: ConvertOptions): string {
  if (body === "" && prefix.trim() === ">") return prefix.trimEnd();
  const converted = convertInlineMarked(body, options);
  if (!converted.includes(imageStart)) return `${prefix}${stripImageMarkers(converted)}`.trimEnd();

  const lines = splitImageRuns(converted).map((segment) => `${prefix}${stripImageMarkers(segment)}`.trimEnd());
  return lines.join("\n");
}

function splitImageRuns(marked: string): string[] {
  const parts: { type: "image" | "text"; value: string }[] = [];
  let i = 0;
  while (i < marked.length) {
    const start = marked.indexOf(imageStart, i);
    if (start < 0) {
      if (i < marked.length) parts.push({ type: "text", value: marked.slice(i) });
      break;
    }
    if (start > i) parts.push({ type: "text", value: marked.slice(i, start) });
    const end = marked.indexOf(imageEnd, start + imageStart.length);
    if (end < 0) {
      parts.push({ type: "text", value: marked.slice(start) });
      break;
    }
    parts.push({ type: "image", value: marked.slice(start + imageStart.length, end) });
    i = end + imageEnd.length;
  }

  const lines: string[] = [];
  let imageRun = "";
  for (const part of parts) {
    if (part.type === "image") {
      imageRun += part.value;
      continue;
    }
    const text = part.value.trim();
    if (text) {
      if (imageRun) {
        lines.push(markImage(imageRun));
        imageRun = "";
      }
      lines.push(text);
    }
  }
  if (imageRun) lines.push(markImage(imageRun));
  return lines.length > 0 ? lines : [marked];
}

function markImage(markdown: string): string {
  return `${imageStart}${markdown}${imageEnd}`;
}

function stripImageMarkers(markdown: string): string {
  return markdown.replaceAll(imageStart, "").replaceAll(imageEnd, "");
}

function isGyazoUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return host === "gyazo.com" || host.endsWith(".gyazo.com");
  } catch {
    return false;
  }
}

function codeLanguage(title: string): string {
  const name = title.trim();
  const match = name.match(/\.([A-Za-z0-9_+-]+)$/);
  return match?.[1] ?? name;
}

function encodePath(path: string): string {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function escapeLinkLabel(label: string): string {
  return label.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function escapeAlt(label: string): string {
  return label.replace(/]/g, "\\]");
}

function escapeUrl(href: string): string {
  return href.replace(/\)/g, "%29");
}

function tableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function escapeTableCell(cell: string): string {
  return cell.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function escapeHtmlComment(text: string): string {
  return text.replace(/--/g, "==");
}
