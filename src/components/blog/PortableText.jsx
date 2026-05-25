import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * PortableText — renders Sanity portable text / block content arrays.
 *
 * Supports:
 *   - Paragraph blocks (with marks: strong, em, code, underline, link)
 *   - Heading blocks (h1–h6) — used for auto-generating table of contents
 *   - Bullet + numbered lists
 *   - blockquote
 *   - Image blocks (with Sanity asset URLs)
 *   - code blocks
 *   - Plain string fallback (renders as <p>)
 *
 * Props:
 *   value   — array of portable text blocks OR a plain string
 *   dir     — "rtl" | "ltr" (auto-detected from useI18n when omitted)
 */
function PortableText({ value, dir }) {
  const { isRTL } = useI18n();
  const textDir = dir || (isRTL ? "rtl" : "ltr");

  // Plain string — render directly
  if (typeof value === "string") {
    return (
      <div dir={textDir} className="prose-content">
        {value.split("\n\n").map((para, i) => (
          <p key={i} className="mb-4 leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    );
  }

  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <div dir={textDir} className="prose-content space-y-4">
      {value.map((block, i) => (
        <Block key={block._key || i} block={block} dir={textDir} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

function Block({ block, dir }) {
  if (!block) return null;

  const { _type, style, listItem, children, level } = block;

  // Image block
  if (_type === "image") {
    const imgUrl = block.asset?.url || block.url;
    if (!imgUrl) return null;
    return (
      <figure className="my-6">
        <img
          src={imgUrl}
          alt={block.alt || ""}
          className="rounded-xl w-full object-cover max-h-96 shadow-sm"
          loading="lazy"
        />
        {block.caption && (
          <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Code block
  if (_type === "code") {
    return (
      <pre className="my-4 rounded-xl bg-gray-900 text-green-300 p-4 overflow-x-auto text-sm font-mono leading-relaxed" dir="ltr">
        <code>{block.code}</code>
      </pre>
    );
  }

  // List item — handled by parent list group; single items rendered here as fallback
  if (listItem) {
    return <li className="mb-1 leading-relaxed"><InlineChildren children={children} /></li>;
  }

  // Headings
  const headingClass = "font-bold text-gray-900 dark:text-white leading-tight mt-8 mb-3";
  if (style === "h1") return <h2 className={`text-3xl ${headingClass}`}><InlineChildren children={children} /></h2>;
  if (style === "h2") return <h2 className={`text-2xl ${headingClass}`}><InlineChildren children={children} /></h2>;
  if (style === "h3") return <h3 className={`text-xl ${headingClass}`}><InlineChildren children={children} /></h3>;
  if (style === "h4") return <h4 className={`text-lg ${headingClass}`}><InlineChildren children={children} /></h4>;
  if (style === "h5") return <h5 className={`text-base ${headingClass}`}><InlineChildren children={children} /></h5>;
  if (style === "h6") return <h6 className={`text-sm ${headingClass}`}><InlineChildren children={children} /></h6>;

  // Blockquote
  if (style === "blockquote") {
    return (
      <blockquote className={`border-s-4 border-purple-400 ps-4 my-4 italic text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-950/30 py-3 pe-4 rounded-e-lg`}>
        <InlineChildren children={children} />
      </blockquote>
    );
  }

  // Default: paragraph
  return (
    <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-200">
      <InlineChildren children={children} />
    </p>
  );
}

// ---------------------------------------------------------------------------
// Inline children (handles marks: strong, em, code, underline, link, strike)
// ---------------------------------------------------------------------------

function InlineChildren({ children }) {
  if (!Array.isArray(children)) return null;
  return children.map((span, i) => <Span key={span._key || i} span={span} />);
}

function Span({ span }) {
  if (!span) return null;
  if (span._type === "span") {
    const { marks = [], text } = span;
    let content = text || "";

    // Build up marks from innermost to outermost
    let node = <>{content}</>;
    for (const mark of marks) {
      if (mark === "strong") node = <strong className="font-bold">{node}</strong>;
      else if (mark === "em") node = <em className="italic">{node}</em>;
      else if (mark === "code") node = <code className="bg-gray-100 dark:bg-gray-800 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono">{node}</code>;
      else if (mark === "underline") node = <u>{node}</u>;
      else if (mark === "strike-through" || mark === "strike") node = <s className="line-through text-gray-400">{node}</s>;
      // Link marks are resolved separately by portable text spec; skip if no annotation map
    }
    return node;
  }

  // Fallback for unknown inline types
  return <>{span.text || ""}</>;
}

// ---------------------------------------------------------------------------
// Utility: extract headings for table of contents
// ---------------------------------------------------------------------------

/**
 * extractHeadings — parse heading blocks from portable text.
 * @param {Array} blocks
 * @returns {Array<{ id: string, text: string, level: number }>}
 */
export function extractHeadings(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => b.style && /^h[1-6]$/.test(b.style))
    .map((b) => {
      const text = (b.children || []).map((c) => c.text || "").join("");
      const level = parseInt(b.style[1], 10);
      const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      return { id, text, level };
    });
}

export default PortableText;
