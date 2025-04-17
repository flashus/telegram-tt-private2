/* eslint-disable no-useless-escape */
import type { ApiFormattedText } from '../../api/types';
import type { DocumentNode } from './node';
import type { Token } from './token';

import { TokenType } from './astEnums';
import { Lexer } from './lexer';
import { normalizeTokens } from './normalizer';
import { Parser } from './parser';
import { Renderer } from './renderer';
import { EntityRenderer } from './rendererAstAsEntities';

export type SelectionBounds = {
  start: number;
  end: number;
};

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

function spliceSelectionIntoTokens(tokens: Token[], start: number, end: number) {
  const tokensWithSelection: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== TokenType.TEXT) {
      tokensWithSelection.push(token);
      continue;
    }

    const isStartInText = start >= token.start && start <= token.end;
    const isEndInText = end >= token.start && end <= token.end;

    if (isStartInText && isEndInText) {
      let textLength = start - token.start;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(0, start - token.start),
          end: start,
        });
      }

      tokensWithSelection.push({
        type: TokenType.CARET_START,
        value: '',
        start,
        end: start,
      });

      textLength = end - start;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(start - token.start, end - token.start),
          start,
          end,
        });
      }

      tokensWithSelection.push({
        type: TokenType.CARET_END,
        value: '',
        start: end,
        end,
      });

      textLength = token.end - end;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(end - token.start),
          start: end,
          end: token.end,
        });
      }
      continue;
    }

    if (isStartInText) {
      let textLength = start - token.start;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(0, start - token.start),
          end: start,
        });
      }

      tokensWithSelection.push({
        type: TokenType.CARET_START,
        value: '',
        start,
        end: start,
      });

      textLength = token.end - start;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(start - token.start),
          start,
          end: token.end,
        });
      }
      continue;
    }

    if (isEndInText) {
      let textLength = end - token.start;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(0, end - token.start),
          end,
        });
      }

      tokensWithSelection.push({
        type: TokenType.CARET_END,
        value: '',
        start: end,
        end,
      });

      textLength = token.end - end;
      if (textLength > 0) {
        tokensWithSelection.push({
          ...token,
          value: token.value.slice(end - token.start),
          start: end,
          end: token.end,
        });
      }

      continue;
    }

    tokensWithSelection.push(token);
  }

  return tokensWithSelection;
}

export function parseMarkdownToAST(inputText: string, selection?: SelectionBounds): DocumentNode | undefined {
  const cleanedHtml = cleanHtml(inputText);
  const lexer = new Lexer(cleanedHtml);
  const tokens = lexer.tokenize();

  console.log('tokens', tokens);

  let tokensToParse = normalizeTokens(tokens);

  if (selection) {
    tokensToParse = spliceSelectionIntoTokens(tokensToParse, selection.start, selection.end);
  }

  console.log('normalizedTokens', tokensToParse);

  const parser = new Parser(tokensToParse);
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

export function parseMarkdownHtmlToEntitiesWithSelection(
  inputText: string,
  selection: SelectionBounds,
): ApiFormattedText {
  const ast = parseMarkdownToAST(inputText, selection);
  if (!ast) {
    return { text: inputText, entities: [] };
  }
  return renderASTToEntities(ast);
}
