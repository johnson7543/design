import type { ReactNode, Ref } from 'react';

type CodeLanguage = 'html' | 'shell' | 'tsx';

const CODE_TOKEN_PATTERN = /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][A-Za-z0-9.-]*|\b[A-Za-z_$][A-Za-z0-9_$-]*\b|\b\d+(?:\.\d+)?\b|[{}[\]()<>=:;,.?/+*-]/g;
const CODE_KEYWORDS = new Set([
  'async', 'await', 'const', 'export', 'from', 'function', 'import',
  'let', 'new', 'return', 'satisfies', 'type',
]);
const CODE_LITERALS = new Set(['false', 'null', 'true', 'undefined']);

function syntaxTokenClass(token: string, source: string, endIndex: number, language: CodeLanguage): string | null {
  if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('<!--')) return 'comment';
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return 'string';
  if (token.startsWith('<')) return 'tag';
  if (/^\d/.test(token)) return 'number';
  if (CODE_KEYWORDS.has(token)) return 'keyword';
  if (CODE_LITERALS.has(token)) return 'literal';

  if (language === 'shell') {
    if (token === 'npm') return 'keyword';
    if (token === 'install') return 'property';
    return 'string';
  }

  const remainder = source.slice(endIndex);
  if (/^\s*=/.test(remainder) || /^\s*:/.test(remainder)) return 'property';
  if (/^[A-Z]/.test(token)) return 'tag';
  if (/^[{}[\]()<>=:;,.?/+*-]$/.test(token)) return 'punctuation';
  return null;
}

export function HighlightedCode({ code, language }: { code: string; language: CodeLanguage }): ReactNode[] {
  const result: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of code.matchAll(CODE_TOKEN_PATTERN)) {
    const start = match.index;
    if (start > cursor) result.push(code.slice(cursor, start));
    const token = match[0];
    const kind = syntaxTokenClass(token, code, start + token.length, language);
    result.push(kind ? <span className={`syntax-token syntax-${kind}`} key={key}>{token}</span> : token);
    cursor = start + token.length;
    key += 1;
  }

  if (cursor < code.length) result.push(code.slice(cursor));
  return result;
}

interface CodeViewProps {
  code: string;
  language: CodeLanguage;
  ariaLabel: string;
  className?: string;
  wrapLines?: boolean;
  ref?: Ref<HTMLPreElement>;
}

export function CodeView({ code, language, ariaLabel, className = '', wrapLines, ref }: CodeViewProps) {
  return (
    <pre ref={ref} className={`share-code-view${className ? ` ${className}` : ''}`}
      role="region" aria-label={ariaLabel} data-language={language} data-wrap={wrapLines} tabIndex={0}>
      <code><HighlightedCode code={code} language={language} /></code>
    </pre>
  );
}
