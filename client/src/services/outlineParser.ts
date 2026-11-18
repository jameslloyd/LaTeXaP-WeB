import type { DocumentOutlineItem } from '@shared/types/latex.js';

export function parseDocumentOutline(source: string): DocumentOutlineItem[] {
  const items: DocumentOutlineItem[] = [];
  const lines = (source || '').split(/\r?\n/);

  const sectionRe = /\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/;
  const cmdRe =
    /\\(NewDocumentCommand|ProvideDocumentCommand|DeclareDocumentCommand|NewExpandableDocumentCommand|cs_new(?:_protected)?:\w+)\s*\{?(\\[a-zA-Z0-9_:@]+)\}?/;
  const envRe = /\\(NewDocumentEnvironment|DeclareDocumentEnvironment)\s*\{([^}]+)\}/;
  const explOnRe = /\\ExplSyntaxOn\b/;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    const lineText = lines[i];
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('%')) continue;

    const secMatch = lineText.match(sectionRe);
    if (secMatch) {
      const kind = secMatch[1];
      const title = secMatch[2].trim();
      const level =
        kind === 'part' || kind === 'chapter' || kind === 'section'
          ? 1
          : kind === 'subsection'
            ? 2
            : 3;
      items.push({
        id: `outline-sec-${lineNum}`,
        title,
        level,
        line: lineNum,
        badge: kind,
      });
      continue;
    }

    const cmdMatch = lineText.match(cmdRe);
    if (cmdMatch) {
      const defType = cmdMatch[1];
      const cmdName = cmdMatch[2];
      items.push({
        id: `outline-cmd-${lineNum}`,
        title: cmdName,
        level: 2,
        line: lineNum,
        badge: defType.startsWith('cs_') ? 'expl3' : 'xparse',
      });
      continue;
    }

    const envMatch = lineText.match(envRe);
    if (envMatch) {
      items.push({
        id: `outline-env-${lineNum}`,
        title: `\\begin{${envMatch[2]}}`,
        level: 2,
        line: lineNum,
        badge: 'env',
      });
      continue;
    }

    if (explOnRe.test(lineText)) {
      items.push({
        id: `outline-expl3-${lineNum}`,
        title: 'ExplSyntaxOn Block',
        level: 2,
        line: lineNum,
        badge: 'expl3',
      });
    }
  }

  return items;
}
