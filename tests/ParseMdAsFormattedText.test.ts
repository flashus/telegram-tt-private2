/* eslint-disable no-useless-escape */
/* eslint-disable max-len */
// tests for ParseMdAsFormattedText.ts
import { ApiMessageEntityTypes } from '../src/api/types';

import { preparePastedHtml } from '../src/components/middle/composer/helpers/cleanHtml';
import { NodeType } from '../src/util/ast/astEnums';
import { Lexer } from '../src/util/ast/lexer';
import { normalizeTokens } from '../src/util/ast/normalizer';
import {
  cleanHtml, markdownToHTML, parseMarkdownToAST, renderASTToHTML,
} from '../src/util/ast/parseMdAsFormattedText';
import { Parser } from '../src/util/ast/parser';

function makeBlockQuote(input: string): string {
  // input = input.replace(/\n[>]+/g, '\n');
  return `<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\n${input}\n::after\n</blockquote>`;
}

describe('ParseMdAsFormattedText', () => {
  it('MD->AST', () => {
    const inputMarkdown = 'This is **bold** and __italic__ and `code`.';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);
    expect(htmlOutput).toBe('This is <b>bold</b> and <i>italic</i> and <code>code</code>.');
  });
});

const testCases = [
  ['Hello, world!', 'Hello, world!'],
  ['Hello, **bold** world!', 'Hello, <b>bold</b> world!'],
  ['Hello, __italic__ world!', 'Hello, <i>italic</i> world!'],
  ['Hello, ~~strikethrough~~ world!', 'Hello, <s>strikethrough</s> world!'],
  ['Hello, `inline code` world!', 'Hello, <code>inline code</code> world!'],
  ['Hello,\n```typescript\nconst x = 5;\n```\nworld!', 'Hello,\n<pre data-language="typescript">const x = 5;</pre>\nworld!'],
  ['Hello, ||spoiler|| world!', `Hello, <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler</span> world!`],
  ['Hello, [link](https://example.com) world!', 'Hello, <a href="https://example.com">link</a> world!'],
  ['Hello, **bold __italic__** world!', 'Hello, <b>bold <i>italic</i></b> world!'],
  ['**Bold** __Italic__ ~~Strikethrough~~ `Code` ||Spoiler||', `<b>Bold</b> <i>Italic</i> <s>Strikethrough</s> <code>Code</code> <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">Spoiler</span>`],
  ['This **is unclosed', 'This **is unclosed'],
  ['This \\**is not bold\\**', 'This \\**is not bold\\**'],
  ['This is a [link without URL]', 'This is a [link without URL]'],
  ['', ''],
  ['**Bold __Italic__ ~~Strike~~ `Code` ||Spoiler||** [Link](https://example.com)', `<b>Bold <i>Italic</i> <s>Strike</s> <code>Code</code> <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">Spoiler</span></b> <a href="https://example.com">Link</a>`],
  ['Code:\n```javascript\nconst x = "**bold**";\nconsole.log(x);\n```', 'Code:\n<pre data-language="javascript">const x = &quot;**bold**&quot;;\nconsole.log(x);</pre>'],
  ['**Bold****Still Bold**__Italic__', '<b>BoldStill Bold</b><i>Italic</i>'],
  ['**Bold at start** Middle **Bold at end**', '<b>Bold at start</b> Middle <b>Bold at end</b>'],
  ['[**Bold** and __Italic__ Link](https://example.com)', '<a href="https://example.com"><b>Bold</b> and <i>Italic</i> Link</a>'],
  ['**Bold __Italic ~~Strikethrough `Code`~~__**', '<b>Bold <i>Italic <s>Strikethrough <code>Code</code></s></i></b>'],
  ['First paragraph.\n\nSecond **bold** paragraph.\n\nThird __italic__ paragraph.', 'First paragraph.\n\nSecond <b>bold</b> paragraph.\n\nThird <i>italic</i> paragraph.'],
  ['Use `backticks` for `inline code with **formatting**`', 'Use <code>backticks</code> for <code>inline code with **formatting**</code>'],
  ['- Item 1\n  - Subitem 1a **bold**\n  - Subitem 1b __italic__\n- Item 2\n  - Subitem 2a ~~strike~~\n    - Subsubitem', '- Item 1\n  - Subitem 1a <b>bold</b>\n  - Subitem 1b <i>italic</i>\n- Item 2\n  - Subitem 2a <s>strike</s>\n    - Subsubitem'],
  ['| Header 1 | Header 2 |\n|----------|----------|\n| **Bold** | __Italic__ |\n| ~~Strike~~ | `Code` |', '| Header 1 | Header 2 |\n|----------|----------|\n| <b>Bold</b> | <i>Italic</i> |\n| <s>Strike</s> | <code>Code</code> |'],

  // ['> This is a **bold** quote\n> With __italic__ text\n>> And a nested quote\n> Back to first level', '<blockquote>This is a <b>bold</b> quote\nWith <i>italic</i> text\n<blockquote>And a nested quote</blockquote>\nBack to first level</blockquote>'],

  // ['Text before\n\n---\n\nText after', 'Text before\n\n<hr>\n\nText after'],
  // ['1. First item\n2. Second item\n   - Subitem a\n   - Subitem b\n3. Third item', '<ol>\n<li>First item</li>\n<li>Second item\n<ul>\n<li>Subitem a</li>\n<li>Subitem b</li>\n</ul>\n</li>\n<li>Third item</li>\n</ol>'],
  ['```javascript\nconst x = 5;\nconsole.log(x);\n```', '<pre data-language="javascript">const x = 5;\nconsole.log(x);</pre>'],

  ['Check out [**Google**](https://www.google.com "Search Engine") for more info.', 'Check out <a href="https://www.google.com" title="Search Engine"><b>Google</b></a> for more info.'],
  // ['- [ ] Unchecked task\n- [x] Checked task\n  - [ ] Nested unchecked task\n  - [x] Nested checked task', '<ul>\n<li><input type="checkbox" disabled> Unchecked task</li>\n<li><input type="checkbox" checked disabled> Checked task\n<ul>\n<li><input type="checkbox" disabled> Nested unchecked task</li>\n<li><input type="checkbox" checked disabled> Nested checked task</li>\n</ul>\n</li>\n</ul>'],
];

describe('Many tests md->html only, no ast check', () => {
  test.each(testCases)('should return %s for input %s', (input, result) => {
    expect(markdownToHTML(input)).toBe(result);
  });
});

describe('ParseItalic', () => {
  it('MD->AST Italic', () => {
    const [inputMarkdown, result] = ['Hello, __italic__ world!', 'Hello, <i>italic</i> world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.ITALIC);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('ParseUnderline', () => {
  it('MD->AST Underline', () => {
    const [inputMarkdown, result] = ['Hello, ++underline++ world!', 'Hello, <u>underline</u> world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.UNDERLINE);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST Unclosed (not) Underline', () => {
    const [inputMarkdown, result] = ['Hello, ++not underline world!', 'Hello, ++not underline world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST Unopened(not) Underline', () => {
    const [inputMarkdown, result] = ['Hello, not underline++ world!', 'Hello, not underline++ world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Code 1', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['```Code```', '<pre>Code</pre>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.CODE_BLOCK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Bold, Italic, Code 1', () => {
  it('MD->AST bold, italic, strike, code, spoiler', () => {
    const [inputMarkdown, result] = ['**Bold** __Italic__ ~~Strikethrough~~ ```Code``` ||Spoiler||', `<b>Bold</b> <i>Italic</i> <s>Strikethrough</s> <pre>Code</pre> <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">Spoiler</span>`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(10);
    expect(ast.children[0].type).toBe(NodeType.BOLD);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Brackets', () => {
  it('parse simple string with brackets []', () => {
    const [inputMarkdown, result] = ['def foo[]:\n  return bar', 'def foo[]:\n  return bar'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(6);
    expect(ast.children[0].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('parse simple string with brackets ()', () => {
    const [inputMarkdown, result] = ['def foo():\n  return bar', 'def foo():\n  return bar'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(7);
    expect(ast.children[0].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('parse simple string with bracket (', () => {
    const [inputMarkdown, result] = ['def foo(:\n  return bar', 'def foo(:\n  return bar'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(6);
    expect(ast.children[0].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('parse simple string with bracket )', () => {
    const [inputMarkdown, result] = ['def foo):\n  return bar', 'def foo):\n  return bar'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(6);
    expect(ast.children[0].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Code Block', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['Hello,\n```typescript\nconst x = 5;\n```\nworld!', 'Hello,\n<pre data-language="typescript">const x = 5;</pre>\nworld!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(6);
    expect(ast.children[0].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Code Block2', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['```typescript\nconst x = 5;\n```\nworld!', '<pre data-language="typescript">const x = 5;</pre>\nworld!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.CODE_BLOCK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Code Block with custom smiles', () => {
  it('MD code + custom smile->AST', () => {
    const [inputMarkdown, result] = ['```typescript\nconst x = 5;<img class="custom-emoji emoji emoji-small" draggable="false" alt="☕️" data-document-id="5440883077586893345" data-unique-id="m7cs9cftrfpm1w2eghr" data-entity-type="MessageEntityCustomEmoji" src="http://localhost:1234/blank.8dd283bceccca95a48d8.png">\n\n\n\n```\nworld!', '<pre data-language="typescript">const x = 5;<img class="custom-emoji emoji emoji-small" draggable="false" alt="☕️" data-document-id="5440883077586893345" data-unique-id="m7cs9cftrfpm1w2eghr" data-entity-type="MessageEntityCustomEmoji" src="http://localhost:1234/blank.8dd283bceccca95a48d8.png"></pre>\nworld!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.CODE_BLOCK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD code + inline md->AST', () => {
    const [inputMarkdown, result] = ['Code:\n```javascript\nconst x = "**bold**";\nconsole.log(x);\n```', 'Code:\n<pre data-language="javascript">const x = &quot;**bold**&quot;;\nconsole.log(x);</pre>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[2].type).toBe(NodeType.CODE_BLOCK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Link1', () => {
  it('MD->AST link without title', () => {
    const [inputMarkdown, result] = ['Hello, [link](https://example.com) world!', 'Hello, <a href="https://example.com">link</a> world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.LINK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST link without title with extra cpace on end', () => {
    const [inputMarkdown, result] = ['Hello, [link](https://example.com ) world!', 'Hello, <a href="https://example.com">link</a> world!'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.LINK);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Link2', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['This is a [link without URL]', 'This is a [link without URL]'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(3);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[2].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Link2', () => {
  it('MD->AST Link without URL', () => {
    const [inputMarkdown, result] = ['This is a [link without URL](http:\\\\dotcom.com', 'This is a [link without URL](http:\\\\dotcom.com'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(3);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[2].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST Link with bold text', () => {
    const [inputMarkdown, result] = ['Check out [**Google**](https://www.google.com "Search Engine") for more info.', 'Check out <a href="https://www.google.com" title="Search Engine"><b>Google</b></a> for more info.'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.LINK);
    expect(ast.children[2].type).toBe(NodeType.TEXT);
    expect(ast.children[3].type).toBe(NodeType.EOF);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges0', () => {
  it('MD->AST duplicates removed 1', () => {
    const [inputMarkdown, result] = ['**Bold****Still Bold**__Italic__', '<b>BoldStill Bold</b><i>Italic</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(3);
    expect(ast.children[0].type).toBe(NodeType.BOLD);
    // expect(ast.children[1].type).toBe(NodeType.BOLD);
    expect(ast.children[1].type).toBe(NodeType.ITALIC);
    expect(ast.children[2].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST duplicates removed 2', () => {
    const [inputMarkdown, result] = ['__**Bold****<i>Still Bold**</i> Italic__',
      '<i><b>BoldStill Bold</b> Italic</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.ITALIC);
    expect(ast.children[0]?.children?.[0].type).toBe(NodeType.BOLD);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges1', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['**Bold** __Italic__ ~~Strikethrough~~ `Code` ||Spoiler||', `<b>Bold</b> <i>Italic</i> <s>Strikethrough</s> <code>Code</code> <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">Spoiler</span>`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(10);
    expect(ast.children[0].type).toBe(NodeType.BOLD);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges2', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['This **is unclosed', 'This **is unclosed'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges3 unclosed blocks', () => {
  it('MD->AST unclosed bold/italic', () => {
    const [inputMarkdown, result] = ['This **is unclosed__', 'This **is unclosed__'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(5);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);
    expect(htmlOutput).toBe(result);
  });

  it('MD->AST unclosed inline code', () => {
    const [inputMarkdown, result] = ['This `**is unclosed__ inline code', 'This `**is unclosed__ inline code'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(7);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);
    expect(htmlOutput).toBe(result);
  });

  it('MD->AST unclosed code block', () => {
    const [inputMarkdown, result] = ['This ```**is unclosed__ code block', 'This ```**is unclosed__ code block'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(7);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);

    const htmlOutput = renderASTToHTML(ast);
    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges4', () => {
  it('MD->AST', () => {
    const [inputMarkdown, result] = ['This \\**is not bold\\**', 'This \\**is not bold\\**'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });
});

describe('Parse Edges4', () => {
  it('MD->AST bold, italic, strike, code, spoiler, link', () => {
    const [inputMarkdown, result] = ['**Bold __Italic__ ~~Strike~~ `Code` ||Spoiler||** [Link](https://example.com)', `<b>Bold <i>Italic</i> <s>Strike</s> <code>Code</code> <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">Spoiler</span></b> <a href="https://example.com">Link</a>`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.BOLD);
    expect(ast.children[0].children?.length).toBe(8);
    expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[2].type).toBe(NodeType.LINK);
    expect(ast.children[3].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote dead simple', () => {
    const [inputMarkdown, result] = ['> This is a quote\n> With text\n', `${makeBlockQuote(' This is a quote\n With text')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.length).toBe(3);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST dead simple html', () => {
    const [inputMarkdown, result] = ['text <b>bold</b>\n', 'text <b>bold</b>\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.BOLD);
    expect(ast.children[2].type).toBe(NodeType.TEXT);
    expect(ast.children[3].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote dead simple with html', () => {
    const [inputMarkdown, result] = ['> This is a quote\n> With text <b>bold</b>\n', `${makeBlockQuote(' This is a quote\n With text <b>bold</b>')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.length).toBe(4);
    expect(ast.children[0].children?.[3].type).toBe(NodeType.BOLD);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST not blockquote like a > b', () => {
    const [inputMarkdown, result] = ['Plain text, a > b!\n> This is a quote\n> With text\n', `Plain text, a &gt; b!\n${makeBlockQuote(' This is a quote\n With text')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    // expect(ast.children.length).toBe(3);
    expect(ast.children.length).toBe(6);
    expect(ast.children[0].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[2].type).toBe(NodeType.TEXT);
    expect(ast.children[3].type).toBe(NodeType.TEXT);

    expect(ast.children[4].type).toBe(NodeType.QUOTE);
    expect(ast.children[4].children?.length).toBe(3);
    // expect(ast.children[5].type).toBe(NodeType.TEXT);
    expect(ast.children[5].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote simple', () => {
    const [inputMarkdown, result] = ['> This is a **bold** quote\n> With __italic__ text\n', `${makeBlockQuote(' This is a <b>bold</b> quote\n With <i>italic</i> text')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.length).toBe(7);
    // expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote with > added to bold node', () => {
    const [inputMarkdown, result] = ['<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">Finally, to create a pull request private repo -> public repo:</blockquote><b>>Use the <i>GitHub UI</i> to create a fork</b> of the public repo (the small "Fork" button at the top right of the public repo page). Then:',
      `${makeBlockQuote('Finally, to create a pull request private repo -&gt; public repo:\n<b>Use the <i>GitHub UI</i> to create a fork</b> of the public repo (the small &quot;Fork&quot; button at the top right of the public repo page). Then:')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote simple nested', () => {
    const [inputMarkdown, result] = ['>This is a quote\n>With text\n>>And a nested quote\n>Back to first level',
      `${makeBlockQuote(`This is a quote\nWith text\n${makeBlockQuote('And a nested quote')}\nBack to first level`)}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    // expect(ast.children[0].children?.length).toBe(7);
    expect(ast.children[0].children?.length).toBe(6);
    expect(ast.children[0].children?.[4].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.[4].children?.length).toBe(1);
    // expect(ast.children[0].children?.[4].children?.length).toBe(2);
    expect(ast.children[0].children?.[1].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[2].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote NOT nested', () => {
    const [inputMarkdown, result] = ['>This is a quote\n>With text A >> B not a nested quote\n',
      `${makeBlockQuote('This is a quote\nWith text A &gt;&gt; B not a nested quote')}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.length).toBe(6);
    expect(ast.children[0].children?.[1].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[2].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[3].type).toBe(NodeType.TEXT);
    // expect(ast.children[1].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote nested', () => {
    const [inputMarkdown, result] = ['> This is a **bold** quote\n> With __italic__ text\n>> And a nested quote\n> Back to first level',
      `${makeBlockQuote(` This is a <b>bold</b> quote\n With <i>italic</i> text\n${makeBlockQuote(' And a nested quote')}\n Back to first level`)}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.length).toBe(10);
    expect(ast.children[0].children?.[8].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.[8].children?.length).toBe(1);
    expect(ast.children[0].children?.[1].type).toBe(NodeType.BOLD);
    expect(ast.children[0].children?.[2].type).toBe(NodeType.TEXT);
    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST bold/italic overlapped', () => {
    const [inputMarkdown, result] = ['**bold**plain__ital**bold-ital__bold**',
      // '<b>bold</b>plain__ital<b>bold-ital__bold</b>'];
      '<b>bold</b>plain<i>ital<b>bold-ital</b></i><b>bold</b>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST small blockquote with overlapped bold/italic', () => {
    const [inputMarkdown, result] = ['**bold__italic__\n>quoted text**\n',
      // `**bold<i>italic</i>\n${makeBlockQuote('quoted text**')}`];
      // `<b>bold<i>italic</i>\n${makeBlockQuote('quoted text')}</b>`];
      '<b>bold<i>italic</i></b>\n<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\n<b>quoted text</b>\n::after\n</blockquote>\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(4);
    expect(ast.children[0].type).toBe(NodeType.BOLD);
    expect(ast.children[1].type).toBe(NodeType.TEXT);
    // expect(ast.children[2].type).toBe(NodeType.ITALIC);
    // expect(ast.children[3].type).toBe(NodeType.TEXT);
    // expect(ast.children[4].type).toBe(NodeType.QUOTE);
    expect(ast.children[2].children?.length).toBe(1);
    expect(ast.children[2].children?.[0].type).toBe(NodeType.BOLD);
    // expect(ast.children[2].children?.[1].type).toBe(NodeType.TEXT);
    expect(ast.children[3].type).toBe(NodeType.EOF);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST small blockquote with overlapped bold/italic and plain', () => {
    const [inputMarkdown, result] = ['**bold__italic__\n>quoted text** plain text\n',
      '<b>bold<i>italic</i></b>\n<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\n<b>quoted text</b> plain text\n::after\n</blockquote>\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    // expect(ast.children.length).toBe(6);
    // expect(ast.children[0].type).toBe(NodeType.TEXT);
    // expect(ast.children[1].type).toBe(NodeType.TEXT);
    // expect(ast.children[2].type).toBe(NodeType.ITALIC);
    // expect(ast.children[3].type).toBe(NodeType.TEXT);
    // expect(ast.children[4].type).toBe(NodeType.QUOTE);
    // expect(ast.children[4].children?.length).toBe(2);
    // expect(ast.children[4].children?.[0].type).toBe(NodeType.TEXT);
    // expect(ast.children[4].children?.[1].type).toBe(NodeType.TEXT);
    // expect(ast.children[5].type).toBe(NodeType.EOF);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST multiple blockquote with overlapped vals', () => {
    const [inputMarkdown, result] = ['&gt; Коля:\n**kakdjlajd**aldklad__plsld;lasd**adjlaj__saldjlaskd**\n\n&gt; Ilya:\n&lt;br&gt;**kakdjlajd**aldklad__plsld;lasd**adjlaj__saldjlaskd**\n\n&gt; Ilya:\n**kakdjlajd**aldklad__plsld;lasd**adjlaj__saldjlaskd**\n\n&gt; Ilya:\n<b data-entity-type="MessageEntityBold">kakdjlajd</b>aldklad__plsld;lasd<b data-entity-type="MessageEntityBold">adjlaj__saldjlaskd</b>',
      '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Коля:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n<br/><b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(28);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('HTML->AST blockquote with overlapped md/html simplified', () => {
    const [inputMarkdown, result] = ['<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Nick:</blockquote><b>bold_text</b>plain text__italic-pretend<b>again bold__italic-pretend</b><br><br>',
      '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Nick:\n::after\n</blockquote>\n<b>bold_text</b>plain text<i>italic-pretend<b>again bold</b></i><b>italic-pretend</b>\n\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    // expect(ast.children.length).toBe(32);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST mixed styles', () => {
    const [inputMarkdown, result] = ['**bold_text**plain text__italic-pretend**bold_text__bold_text_pretend_italic**',
      '<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('HTML->AST mixed styles', () => {
    const [inputMarkdown, result] = ['<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</i>bold_text_pretend_italic</b>',
      // '<b>bold_text</b>plain text&lt;i&gt;italic-pretend<b>bold_text&lt;/i&gt;bold_text_pretend_italic</b>'];
      '<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('HTML->AST with overlapped md/html advanced', () => {
    const [inputMarkdown, result] = ['<b>bold_text</b>plain text__italic-pretend<b>bold_text__bold_text_pretend_italic</b><br><br>',
      '<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>\n\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  /*
  '<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Nick:</blockquote>
  <b>bold_text</b>plain text__italic-pretend<b>bold_text__bold_text_pretend_italic</b><br><br>
  <blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><br>
  <b>bold_text</b>plain text__italic-pretend<b>bold_text__bold_text_pretend_italic</b><br><br>',
  '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Nick:\n::after\n</blockquote>
  <b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>\n\n
  <blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n
  <b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>\n\n'];
  */
  it('HTML->AST blockquote with overlapped md/html advanced', () => {
    const [inputMarkdown, result] = ['<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Nick:</blockquote><b>bold_text</b>plain text__italic-pretend<b>bold_text__bold_text_pretend_italic</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><br><b>bold_text</b>plain text__italic-pretend<b>bold_text__bold_text_pretend_italic</b><br><br>',
      '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Nick:\n::after\n</blockquote>\n<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n\n<b>bold_text</b>plain text<i>italic-pretend<b>bold_text</b></i><b>bold_text_pretend_italic</b>\n\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('HTML->AST with overlapped md/html simple', () => {
    const [inputMarkdown, result] = ['<div>text<b>__bold italic</b>__</div>',
      '<div>text<b><i>bold italic</i></b></div>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('HTML->AST with overlapped md/html duplicates', () => {
    const [inputMarkdown, result] = ['<div>text**<b>__bold italic</b>__**</div>',
      '<div>text<b><i>bold italic</i></b></div>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  // it('HTML->AST with overlapped md duplicates', () => {
  //   const [inputMarkdown, result] = ['<div>text**__**bold italic**__**</div>',
  //     '<div>text<b><i>bold italic</i></b></div>'];
  //   const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
  //   expect(ast.type).toBe(NodeType.DOCUMENT);

  //   const htmlOutput = renderASTToHTML(ast);

  //   expect(htmlOutput).toBe(result);
  // });

  it('HTML->AST multiple blockquote with overlapped vals', () => {
    const [inputMarkdown, result] = ['<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Коля:</blockquote><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><br><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Коля:</blockquote>да, работает<img class="custom-emoji emoji emoji-small" draggable="false" alt="🥰" data-document-id="5276417969390362800" data-entity-type="MessageEntityCustomEmoji" src="blob:http://localhost:1234/7c81db32-e537-466e-a2bc-bbc272c850fe">',
      // '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Коля:\n::after\n</blockquote><b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote><b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote><b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>'];
      // '<blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Коля:</blockquote><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><br><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Ilya:</blockquote><b>kakdjlajd</b>aldklad__plsld;lasd<b>adjlaj__saldjlaskd</b><br><br><blockquote class="blockquote" data-entity-type="MessageEntityBlockquote">&nbsp;Коля:</blockquote>да, работает<img class="custom-emoji emoji emoji-small" draggable="false" alt="🥰" data-document-id="5276417969390362800" data-entity-type="MessageEntityCustomEmoji" src="blob:http://localhost:1234/7c81db32-e537-466e-a2bc-bbc272c850fe">'];
      '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Коля:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Ilya:\n::after\n</blockquote>\n<b>kakdjlajd</b>aldklad<i>plsld;lasd<b>adjlaj</b></i><b>saldjlaskd</b>\n\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n Коля:\n::after\n</blockquote>\nда, работает<img class=\"custom-emoji emoji emoji-small\" draggable=\"false\" alt=\"🥰\" data-document-id=\"5276417969390362800\" data-entity-type=\"MessageEntityCustomEmoji\" src=\"blob:http://localhost:1234/7c81db32-e537-466e-a2bc-bbc272c850fe\"/>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('MD->AST blockquote nested with trailing newline', () => {
    const [inputMarkdown, result] = ['>First level\n>>Second level\n>Back to first\n',
      '<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\nFirst level\n<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\nSecond level\n::after\n</blockquote>\nBack to first\n::after\n</blockquote>\n'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.QUOTE);

    const htmlOutput = renderASTToHTML(ast);
    expect(htmlOutput).toBe(result);
  });
});

describe('ParseMixedMarkdownAndHTML', () => {
  it('Handles bold Markdown with inline HTML italic', () => {
    const inputMarkdown = '**bold <i>and italic</i> just bold**';
    const expectedOutput = '<b>bold <i>and italic</i> just bold</b>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles multiple mixed elements', () => {
    const inputMarkdown = 'Normal text, **bold text**, <em>HTML em</em>, and __italic text__';
    const expectedOutput = 'Normal text, <b>bold text</b>, <i>HTML em</i>, and <i>italic text</i>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles nested mixed elements md->html', () => {
    const inputMarkdown = '**Bold __italic <strong>and HTML strong</strong>__ still bold**';
    const expectedOutput = '<b>Bold <i>italic and HTML strong</i> still bold</b>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles nested mixed elements, md->html->md', () => {
    const inputMarkdown = '**Bold __italic <strong>and ++HTML++ strong</strong>__ still bold**';
    const expectedOutput = '<b>Bold <i>italic and <u>HTML</u> strong</i> still bold</b>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles quotes, simplified', () => {
    const inputMarkdown = '>text\n>>nested quote\nplain text';
    // `${makeBlockQuote(' This is a quote\n With text')}\n`
    const quoteBody = `text\n${makeBlockQuote('nested quote')}`;
    const expectedOutput = `${makeBlockQuote(quoteBody)}\nplain text`;

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles quotes and non-quotes, simplified', () => {
    const inputMarkdown = '>text\n>>nested quote with >>> symbol\nplain text';
    const quoteBody = `text\n${makeBlockQuote('nested quote with &gt;&gt;&gt; symbol')}`;
    const expectedOutput = `${makeBlockQuote(quoteBody)}\nplain text`;

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles nested mixed elements, md quote->html->md quote->text simplified', () => {
    const inputMarkdown = '>**Bold __italic <strong>and ++HTML++ strong</strong>__**\n>>nested quote\nplain text';
    const quoteBody = `<b>Bold <i>italic and <u>HTML</u> strong</i></b>\n${makeBlockQuote('nested quote')}`;
    const expectedOutput = `${makeBlockQuote(quoteBody)}\nplain text`;
    // const expectedOutput = '<blockquote><b>Bold <i>italic <b>and <u>HTML</u> strong</b></i></b>\n<blockquote>nested quote</blockquote></blockquote>\nplain text';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('Handles nested mixed elements, md quote->html->md quote->text simplified 3rd lvl nest', () => {
    const inputMarkdown = '>**Bold __italic <strong>and ++HTML++ strong</strong>__**\n>>nested quote\n>>> 3rd lvl nested quote\nplain text';
    const nestedQuoteBody = `nested quote\n${makeBlockQuote(' 3rd lvl nested quote')}`;
    const quoteBody = `<b>Bold <i>italic and <u>HTML</u> strong</i></b>\n${makeBlockQuote(nestedQuoteBody)}`;
    const expectedOutput = `${makeBlockQuote(quoteBody)}\nplain text`;
    // const expectedOutput = '<blockquote><b>Bold <i>italic <b>and <u>HTML</u> strong</b></i></b>\n<blockquote>nested quote</blockquote></blockquote>\nplain text';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  // >quote of main\n>>never quote main\nok no quote
  // it('Handles nested mixed elements, md quote->html->md quote->text', () => {
  //   const inputMarkdown = '>**Bold __italic <strong>and ++HTML++ strong</strong>__\n>>still bold nested quote**\nplain text';
  //   const quoteBody = `<b>Bold <i>italic <b>and <u>HTML</u> strong</b></i>\n${makeBlockQuote('still bold nested quote')}</b>\n`;
  //   const expectedOutput = `${makeBlockQuote(quoteBody)}\nplain text`;
  //   // const expectedOutput = '<blockquote><b>Bold <i>italic <b>and <u>HTML</u> strong</b></i>\n<blockquote> still bold</b></blockquote></blockquote>\nplain text';

  //   const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
  //   const htmlOutput = renderASTToHTML(ast);

  //   expect(htmlOutput).toBe(expectedOutput);
  // });

  it('Preserves HTML attributes', () => {
    const inputMarkdown = 'Check out this <a href="https://example.com" target="_blank">**bold link**</a>';
    const expectedOutput = 'Check out this <a href="https://example.com" target="_blank"><b>bold link</b></a>'; // old way
    // const expectedOutput = 'Check out this <b><a href="https://example.com" target="_blank">bold link</a></b>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('mixed html and md', () => {
    const inputMarkdown = '<div attr="value \\"quoted\\"">some plain text **bold text __italic also__**</div>';
    const expectedOutput = '<div attr="value &quot;quoted&quot;">some plain text <b>bold text <i>italic also</i></b></div>';

    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(expectedOutput);
  });

  it('MD->AST blockquote nested', () => {
    const [inputMarkdown, result] = ['> This is a **bold** quote\n> With __italic__ text\n>> And a nested quote <a href="https://example.com" target="_blank">**bold link**</a>\n> Back to <u>first</u> level',
      `${makeBlockQuote(` This is a <b>bold</b> quote\n With <i>italic</i> text\n${makeBlockQuote(' And a nested quote <a href="https://example.com" target="_blank"><b>bold link</b></a>')}\n Back to <u>first</u> level`)}\n`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('should return false for a < without a closing >', () => {
    const [inputMarkdown, result] = ['<div **bold** and __b < a, so a > b__', '&lt;div <b>bold</b> and <i>b &lt; a, so a &gt; b</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('should parse as text a < without a closing > when no spaces', () => {
    const [inputMarkdown, result] = ['<div **bold** and __b<a, so a>b__', '&lt;div <b>bold</b> and <i>b&lt;a, so a&gt;b</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('should parse <span data-entity-type> as spoiler node', () => {
    const [inputMarkdown, result] = [`<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text</span>`, `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text</span>`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  // //
  // // <code class="hljs custom-scroll-x" data-entity-type="MessageEntityCode">def foo():   return bar;\n</code><div class="CodeOverlay-module__overlay code-overlay"><div class="CodeOverlay-module__content"><div class="CodeOverlay-module__copy" title="Copy"><i class="icon icon-copy" aria-hidden="true" data-entity-type="MessageEntityItalic"></i></div></div></div>
  // it('should parse <code class="hljs custom-scroll-x"> as code', () => {
  //   const [inputMarkdown, result] = ['Python\n\`\`\`\n<code class="hljs custom-scroll-x" data-entity-type="MessageEntityCode">def foo():   return bar;\n</code><div class="CodeOverlay-module__overlay code-overlay"><div class="CodeOverlay-module__content"><div class="CodeOverlay-module__copy" title="Copy"><i class="icon icon-copy" aria-hidden="true" data-entity-type="MessageEntityItalic"></i></div></div></div>\n\`\`\`', '<pre data-language="typescript">const x = 5;\n</pre>'];
  //   const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

  //   expect(ast.type).toBe(NodeType.DOCUMENT);
  //   const htmlOutput = renderASTToHTML(ast);

  //   expect(htmlOutput).toBe(result);
  // });

  //

  it('should preserve newlines in pasted html with code', () => {
    const inputHtml = '<meta charset=\'utf-8\'><p class="code-title" style="box-sizing: border-box; margin-top: 0px; margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: var(--font-weight-medium); color: var(--accent-color); font-size: calc(var(--message-text-size, 1rem) - 0.125rem); font-family: system-ui, -apple-system, &quot;system-ui&quot;, Roboto, &quot;Apple Color Emoji&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;">Python</p><pre class="code-block" data-entity-type="MessageEntityPre" data-language="python" style="box-sizing: border-box; font-style: normal; font-variant: normal; font-kerning: auto; font-optical-sizing: auto; font-feature-settings: normal; font-variation-settings: normal; font-weight: 400; font-stretch: normal; font-size: 0.875rem; line-height: 1.25; font-family: var(--font-family-monospace); font-size-adjust: 0.5; margin: 0px; overflow: hidden; --color-scrollbar: var(--color-scrollbar-code); white-space: pre-wrap; --color-type: #0053d4; --color-keyword: #388e22; --color-class: #3e6c20; --color-string: #9a1111; --color-template: #9a5334; --color-selector: #9a5334; --color-function: #a753b7; --color-comment: #616161; --color-section: #9a1111; --color-variable: #bd63c5; --color-attribute: #276b8f; --color-link: #276b8f; --color-tag: #000000; color: rgb(0, 0, 0); letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;"><code class="hljs custom-scroll-x" style="box-sizing: border-box; font-style: normal; font-variant: normal; font-kerning: auto; font-optical-sizing: auto; font-feature-settings: normal; font-variation-settings: normal; font-weight: normal; font-stretch: normal; font-size: 0.875rem; line-height: 1.25; font-family: var(--font-family-monospace); font-size-adjust: 0.5; scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color 0.3s; pointer-events: auto; --color-scrollbar: var(--color-scrollbar-code); display: block; overflow-x: auto; color: var(--color-text);"><span class="hljs-keyword" style="box-sizing: border-box; color: var(--color-keyword);">def</span> <span class="hljs-title function_" style="box-sizing: border-box; color: var(--color-function);">foo</span>:\n   <span class="hljs-keyword" style="box-sizing: border-box; color: var(--color-keyword);">return</span> bar</code></pre>';
    const result = 'Python\n<pre data-entity-type="MessageEntityPre" data-language="python">def foo:\n   return bar</pre>';

    const outputHtml = preparePastedHtml(inputHtml);
    expect(outputHtml).toBe(result);
  });
  // <!--StartFragment-->

  it('should strip <!--StartFragment-->', () => {
    const inputHtml = '<!--StartFragment--><b>bold text</b><!--EndFragment-->';
    const result = '<b data-entity-type=\"MessageEntityBold\">bold text</b>';
    const outputHtml = preparePastedHtml(inputHtml);
    expect(outputHtml).toBe(result);
  });

  it('should strip custom tags leaving contents as plain text', () => {
    const inputHtml = '<!--StartFragment--><div id="info-container" class="style-scope ytd-watch-info-text"><yt-formatted-string id="info" class="style-scope ytd-watch-info-text"><span dir="auto" class="style-scope yt-formatted-string bold" style-target="bold">5 699 просмотров</span><span dir="auto" class="style-scope yt-formatted-string bold" style-target="bold">  </span><span dir="auto" class="style-scope yt-formatted-string bold" style-target="bold">Дата премьеры: 13 февр. 2025 г.</span><span dir="auto" class="style-scope yt-formatted-string bold" style-target="bold">  </span><a class="yt-simple-endpoint style-scope yt-formatted-string bold" spellcheck="false" href="https://www.youtube.com/results?search_query=%D0%A1%D0%BE%D0%B5%D0%B4%D0%B8%D0%BD%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5+%D0%A8%D1%82%D0%B0%D1%82%D1%8B+%D0%90%D0%BC%D0%B5%D1%80%D0%B8%D0%BA%D0%B8&amp;sp=EiG4AQHCARtDaElKQ3pZeTVJUzE2bFFSUXJmZVE1SzVPeHc%253D" dir="auto" style-target="bold">СОЕДИНЕННЫЕ ШТАТЫ АМЕРИКИ</a></yt-formatted-string>';
    const result = '5 699 просмотров  Дата премьеры: 13 февр. 2025 г.  <a href="https://www.youtube.com/results?search_query=%D0%A1%D0%BE%D0%B5%D0%B4%D0%B8%D0%BD%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5+%D0%A8%D1%82%D0%B0%D1%82%D1%8B+%D0%90%D0%BC%D0%B5%D1%80%D0%B8%D0%BA%D0%B8&amp;sp=EiG4AQHCARtDaElKQ3pZeTVJUzE2bFFSUXJmZVE1SzVPeHc%253D">СОЕДИНЕННЫЕ ШТАТЫ АМЕРИКИ</a>';
    const outputHtml = preparePastedHtml(inputHtml);
    expect(outputHtml).toBe(result);
  });

  it('should not strip data-entity-type="MessageEntityCustomEmoji"', () => {
    const inputHtml = '<div>das <div class="CustomEmoji-module__root custom-emoji emoji" data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏" alt="😏"></div>&nbsp;was</div>';
    // const result = 'das <div data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏" alt="😏"></div>&nbsp;was';
    const result = 'das <div alt=\"😏\" data-entity-type=\"MessageEntityCustomEmoji\" data-document-id=\"5375170473095077321\" data-alt=\"😏\">😏</div>&nbsp;was';
    const outputHtml = preparePastedHtml(inputHtml);
    expect(outputHtml).toBe(result);
  });

  it('should not strip data-entity-type="MessageEntityCustomEmoji" 2', () => {
    const inputHtml = '<div>das <img class="CustomEmoji-module__root custom-emoji emoji" data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏" alt="😏"></img>&nbsp;was</div>';
    // const result = 'das <div data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏" alt="😏"></div>&nbsp;was';
    const result = 'das <img alt=\"😏\" data-entity-type=\"MessageEntityCustomEmoji\" data-document-id=\"5375170473095077321\" data-alt=\"😏\">&nbsp;was';
    const outputHtml = preparePastedHtml(inputHtml);
    expect(outputHtml).toBe(result);
  });

  it('should parse pasted codeBlock', () => {
    const inputHtml = 'Python\n<pre class="code-block" data-entity-type="MessageEntityPre" data-language="python">def foo:\n   return bar\n</pre>';
    const result = 'Python\n<pre data-language="python">def foo:\n   return bar</pre>';
    const ast = parseMarkdownToAST(inputHtml) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const outputHtml = renderASTToHTML(ast);

    expect(outputHtml).toBe(result);
  });

  it('should parse quotes with newlines on end stripping', () => {
    const inputHtml = '>a man\n>quote\n>\n>';
    const result = `${makeBlockQuote('a man\nquote')}\n`;
    const ast = parseMarkdownToAST(inputHtml) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const outputHtml = renderASTToHTML(ast);

    expect(outputHtml).toBe(result);
  });

  it('should parse <span data-entity-type> as spoiler node nested md', () => {
    const [inputMarkdown, result] = [`<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text **bold text**</span>`, `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text <b>bold text</b></span>`];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(result);
  });

  it('should parse html links', () => {
    const [inputMarkdown, htmlResult] = ['<div **bold** and __b<a href="bonn.com">++link text++ **bold**</a>b__', '&lt;div <b>bold</b> and <i>b<a href=\"bonn.com\"><u>link text</u> <b>bold</b></a>b</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });

  it('should parse html/md mix with proper ast', () => {
    const inputHtmlMarkdown = '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;">GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. <br>> It warns that <b>adding the token to the clone URL will store it in plaintext in</b>&nbsp;<code class="text-entity-code">.git/config</code>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i>&nbsp;repository and revoking the token when I\'m done, <b>I don\'t care.</b></div>';

    const htmlResult = '<div id=\"editable-message-text\" class=\"form-control allow-selection touched\" contenteditable=\"true\" role=\"textbox\" dir=\"auto\" tabindex=\"0\" aria-label=\"Message\" style=\"transition: color 50ms linear !important;\">GitHub has a very handy guide on how to do this, but it doesn&#039;t cover what to do if you want to include it all in one line for automation purposes. \n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n It warns that <b>adding the token to the clone URL will store it in plaintext in</b> <code>.git/config</code>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i> repository and revoking the token when I&#039;m done, <b>I don&#039;t care.</b>\n::after\n</blockquote>\n</div>';

    const cleanedHtml = cleanHtml(inputHtmlMarkdown);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, value: '', children: [] };

    // expect(ast.type).toBe(NodeType.DOCUMENT);
    // expect(ast.children.length).toBe(2);
    // expect(ast.children[0].type).toBe(NodeType.HTML_TAG);
    // expect(ast.children[0].children?.length).toBe(3);
    // expect(ast.children[0].children?.[0].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[1].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[2].type).toBe(NodeType.QUOTE);
    // expect(ast.children[0].children?.[2].children?.length).toBe(8);
    // expect(ast.children[0].children?.[2].children?.[0].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[2].children?.[1].type).toBe(NodeType.BOLD);
    // expect(ast.children[0].children?.[2].children?.[2].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[2].children?.[3].type).toBe(NodeType.CODE);
    // expect(ast.children[0].children?.[2].children?.[4].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[2].children?.[5].type).toBe(NodeType.ITALIC);
    // expect(ast.children[0].children?.[2].children?.[6].type).toBe(NodeType.TEXT);
    // expect(ast.children[0].children?.[2].children?.[7].type).toBe(NodeType.BOLD);

    // expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });

  it('should parse html/md mix with proper ast enclosed tags', () => {
    const inputHtmlMarkdown = '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;">GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line <p>for automation purposes. <br>> It warns that <b>adding the token to the clone URL will store it in plaintext in</b>&nbsp;<code class="text-entity-code">.git/config</code>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i>&nbsp;repository and revoking the token when I\'m done, <b>I don\'t care.</b></p></div>';

    const htmlResult = '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;">GitHub has a very handy guide on how to do this, but it doesn&#039;t cover what to do if you want to include it all in one line <p>for automation purposes. \n<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n::before\n It warns that <b>adding the token to the clone URL will store it in plaintext in</b> <code>.git/config</code>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i> repository and revoking the token when I&#039;m done, <b>I don&#039;t care.</b>\n::after\n</blockquote>\n</p></div>';

    const cleanedHtml = cleanHtml(inputHtmlMarkdown);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.HTML_TAG);
    expect(ast.children[0].children?.length).toBe(2);
    expect(ast.children[0].children?.[0].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].type).toBe(NodeType.HTML_TAG);

    expect(ast.children[0].children?.[1].children?.length).toBe(3);
    expect(ast.children[0].children?.[1].children?.[0].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[1].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[2].type).toBe(NodeType.QUOTE);
    expect(ast.children[0].children?.[1].children?.[2].children?.length).toBe(8);
    expect(ast.children[0].children?.[1].children?.[2].children?.[0].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[2].children?.[1].type).toBe(NodeType.BOLD);
    expect(ast.children[0].children?.[1].children?.[2].children?.[2].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[2].children?.[3].type).toBe(NodeType.CODE);
    expect(ast.children[0].children?.[1].children?.[2].children?.[4].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[2].children?.[5].type).toBe(NodeType.ITALIC);
    expect(ast.children[0].children?.[1].children?.[2].children?.[6].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[1].children?.[2].children?.[7].type).toBe(NodeType.BOLD);

    expect(ast.children[1].type).toBe(NodeType.EOF);

    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });

  it('should parse as text a < without a closing > when no spaces and = between <>', () => {
    const [inputMarkdown, htmlResult] = ['<div **bold** and __b<a so= a>b__', '&lt;div <b>bold</b> and <i>b&lt;a so= a&gt;b</i>'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });

  it('should parse hard mix of pasted html and md', () => {
    const [inputMarkdown, htmlResult] = [
      '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;"><b>A 13 Aug 2021 post you must use</b><br><b>Git Clone</b><br><code class="text-entity-code">https://username:token@github.com/username/repository.git</code><br>&gt;To generate a token:<br><i>&gt;**Settings</i>&nbsp;→ <i>Developer settings</i>&nbsp;→ <i>Personal access tokens</i>&nbsp;→ <i>Generate new token</i>**<br><b>Git Push</b></div>',
      '<div id=\"editable-message-text\" class=\"form-control allow-selection touched\" contenteditable=\"true\" role=\"textbox\" dir=\"auto\" tabindex=\"0\" aria-label=\"Message\" style=\"transition: color 50ms linear !important;\"><b>A 13 Aug 2021 post you must use</b>\n<b>Git Clone</b>\n<code>https://username:token@github.com/username/repository.git</code>\n<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\nTo generate a token:\n<i><b>Settings</b></i><b> → <i>Developer settings</i> → <i>Personal access tokens</i> → <i>Generate new token</i></b>\n::after\n</blockquote>\n<b>Git Push</b></div>',
    ];
    // const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };

    const cleanedHtml = cleanHtml(inputMarkdown);
    const lexer = new Lexer(cleanedHtml);
    const tokens = lexer.tokenize();

    const normalizedTokens = normalizeTokens(tokens);

    const parser = new Parser(normalizedTokens);
    const ast = parser.parseDocument() || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    expect(ast.children.length).toBe(2);
    expect(ast.children[0].type).toBe(NodeType.HTML_TAG);
    expect(ast.children[0].children?.length).toBe(8);
    expect(ast.children[0].children?.[0].type).toBe(NodeType.BOLD);
    expect(ast.children[0].children?.[1].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[2].type).toBe(NodeType.BOLD);
    expect(ast.children[0].children?.[3].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[4].type).toBe(NodeType.CODE);
    expect(ast.children[0].children?.[5].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[6].type).toBe(NodeType.QUOTE);
    // expect(ast.children[0].children?.[7].type).toBe(NodeType.TEXT);
    expect(ast.children[0].children?.[7].type).toBe(NodeType.BOLD);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });

  test('should handle markdown blockquotes with custom emoji', () => {
    const [inputMarkdown, htmlResult] = ['> This is a quote <img class="custom-emoji" alt="💬" data-document-id="777" data-entity-type="MessageEntityCustomEmoji">\n> With **bold** text',
      '<blockquote class=\"quote quote-like quote-like-border quote-like-icon\" dir=\"auto\">\n::before\n This is a quote <img class=\"custom-emoji\" alt=\"💬\" data-document-id=\"777\" data-entity-type=\"MessageEntityCustomEmoji\"/>\n With <b>bold</b> text\n::after\n</blockquote>\n'];

    // const input = '> This is a quote <img class="custom-emoji" alt="💬" data-document-id="777" data-entity-type="MessageEntityCustomEmoji">\n> With **bold** text';
    // const result = parseMarkdownHtmlToEntities(input);
    // expect(result.text).toBe(' This is a quote 💬\n With bold text');
    const cleanedHtml = cleanHtml(inputMarkdown);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, value: '', children: [] };

    expect(ast.type).toBe(NodeType.DOCUMENT);
    const htmlOutput = renderASTToHTML(ast);

    expect(htmlOutput).toBe(htmlResult);
  });
});
