import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')
      ? [target]
      : [];
  });
}

describe('paged HTTP transport contract', () => {
  it('never sends a paged API request with GET', { timeout: 60_000 }, () => {
    const violations: string[] = [];
    const root = path.resolve(process.cwd(), 'src');

    for (const file of sourceFiles(root)) {
      const sourceText = fs.readFileSync(file, 'utf8');
      const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text.toLowerCase() === 'get'
          && node.arguments[0]?.getText(source).toLowerCase().includes('paged')
        ) {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(`${path.relative(root, file)}:${position.line + 1}`);
        }
        ts.forEachChild(node, visit);
      };

      visit(source);
    }

    expect(violations, `GET kullanılan paged çağrılar: ${violations.join(', ')}`).toEqual([]);
  });
});
