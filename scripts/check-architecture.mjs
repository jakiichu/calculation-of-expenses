import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const allowed = {
  domain: new Set(['domain']),
  data: new Set(['data', 'domain']),
  app: new Set(['app', 'domain']),
};
const errors = [];
for (const file of await readdir(root, { recursive: true })) {
  if (!/\.tsx?$/.test(file)) continue;
  const absolute = path.join(root, file);
  const layer = file.split(path.sep)[0];
  const normalizedFile = file.replaceAll(path.sep, '/');
  if (!allowed[layer]) errors.push(`${file}: unknown layer`);
  const source = ts.createSourceFile(
    file,
    await readFile(absolute, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function check(specifier) {
    if (!allowed[layer]) {
      errors.push(`${file}: unknown layer`);
      return;
    }
    if (!specifier.startsWith('.')) {
      const isReact = ['react', 'react-dom/client'].includes(specifier);
      if (!(layer === 'app' && isReact)) errors.push(`${file}: external dependency ${specifier}`);
      return;
    }
    const targetPath = path
      .relative(root, path.resolve(path.dirname(absolute), specifier))
      .replaceAll(path.sep, '/')
      .replace(/\.(tsx?|jsx?)$/, '');
    const target = targetPath.split('/')[0];
    const isCompositionImport = normalizedFile === 'app/create-services.ts' && target === 'data';
    if (!allowed[layer].has(target) && !isCompositionImport)
      errors.push(`${file}: ${layer} cannot import ${target} (${specifier})`);
    if (targetPath === 'app/create-services' && normalizedFile !== 'app/main.tsx')
      errors.push(`${file}: only main.tsx can import the composition root`);
    if (targetPath === 'app/main')
      errors.push(`${file}: application entrypoint cannot be imported`);
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      check(node.argument.literal.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) check(argument.text);
      else errors.push(`${file}: dynamic module path cannot be checked`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Architecture boundaries OK (including type imports and re-exports).');
