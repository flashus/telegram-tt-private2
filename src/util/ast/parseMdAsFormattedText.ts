/* eslint-disable no-useless-escape */
import type { ApiFormattedText } from '../../api/types';
import type { DocumentNode } from './node';

import { Lexer } from './lexer';
import { normalizeTokens } from './normalizer';
import { Parser } from './parser';
import { Renderer } from './renderer';
import { EntityRenderer } from './rendererAstAsEntities';

export function cleanHtml(html: string) {
  let cleanedHtml = html.slice(0);

  // Strip redundant nbsp's
  cleanedHtml = cleanedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  cleanedHtml = cleanedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  cleanedHtml = cleanedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags
  cleanedHtml = cleanedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<\/div>/g, '');

  cleanedHtml = cleanedHtml.replace(/&gt;/g, '>');
  cleanedHtml = cleanedHtml.replace(/&lt;/g, '<');
  cleanedHtml = cleanedHtml.replace(/&amp;/g, '&');

  return cleanedHtml;
}

export function parseMarkdownToAST(inputText: string): DocumentNode | undefined {
  const cleanedHtml = cleanHtml(inputText);
  const lexer = new Lexer(cleanedHtml);
  const tokens = lexer.tokenize();

  console.log('tokens', tokens);

  const normalizedTokens = normalizeTokens(tokens);

  console.log('normalizedTokens', normalizedTokens);

  const parser = new Parser(normalizedTokens);
  let document: DocumentNode | undefined;
  try {
    document = parser.parseDocument();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
  return document;
}

export function renderASTToHTML(ast: DocumentNode): string {
  const renderer = new Renderer();
  return renderer.render(ast);
}

export function markdownToHTML(inputText: string): string {
  const ast = parseMarkdownToAST(inputText);
  if (!ast) {
    return inputText;
  }
  return renderASTToHTML(ast);
}

export function renderASTToEntities(ast: DocumentNode): ApiFormattedText {
  const renderer = new EntityRenderer();
  return renderer.render(ast);
}

export function parseMarkdownHtmlToEntities(inputText: string): ApiFormattedText {
  const ast = parseMarkdownToAST(inputText);
  if (!ast) {
    return { text: inputText, entities: [] };
  }
  return renderASTToEntities(ast);
}

export function parseMarkdownHtmlToEntitiesWithCursorSelection(
  inputText: string,
  cursorSelection: { start: number; end: number },
): ApiFormattedText {
  const ast = parseMarkdownToAST(inputText);
  if (!ast) {
    return { text: inputText, entities: [] };
  }
  return renderASTToEntities(ast);
}
