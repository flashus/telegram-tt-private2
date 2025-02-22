/* eslint-disable max-len */
// parseTextAsEntities.test.ts
import { ApiMessageEntityTypes } from '../src/api/types';

import { NodeType } from '../src/util/ast/astEnums';
import {
  cleanHtml, parseMarkdownHtmlToEntities, parseMarkdownToAST, renderASTToEntities,
} from '../src/util/ast/parseMdAsFormattedText';

describe('rendererAstAsEntities', () => {
  it('renders bold text', () => {
    const inputMarkdown = '**bold**';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('bold');
    expect(result.entities).toEqual([{ type: ApiMessageEntityTypes.Bold, offset: 0, length: 4 }]);
  });

  it('renders italic text', () => {
    const inputMarkdown = '__italic__';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('italic');
    expect(result.entities).toEqual([{ type: ApiMessageEntityTypes.Italic, offset: 0, length: 6 }]);
  });

  it('renders link with text', () => {
    const inputMarkdown = '[link](https://example.com)';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('link');
    expect(result.entities).toEqual([{
      type: ApiMessageEntityTypes.TextUrl, offset: 0, length: 4, url: 'https://example.com',
    }]);
  });

  /*
>quote
>>second level
>first level
no level
>quote1
>>quote2
no level

```python
def foo:
   return bar```

*/

  // simple url without text are parsed on backend
  // it('renders link', () => {
  //   const inputMarkdown = '[](https://example.com)';
  //   const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
  //   const result = renderASTToEntities(ast);
  //   expect(result.text).toBe('https://example.com');
  //   expect(result.entities).toEqual([{
  //     type: ApiMessageEntityTypes.Url, offset: 0, length: 4, url: 'https://example.com',
  //   }]);
  // });

  it('renders text with multiple entities', () => {
    const inputMarkdown = 'Hello, **bold** and __italic__';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('Hello, bold and italic');
    expect(result.entities).toEqual([
      { type: ApiMessageEntityTypes.Bold, offset: 7, length: 4 },
      { type: ApiMessageEntityTypes.Italic, offset: 16, length: 6 },
    ]);
  });

  it('renders nested entities', () => {
    const inputMarkdown = '**__bold italic__**';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('bold italic');
    expect(result.entities).toEqual([
      { type: ApiMessageEntityTypes.Bold, offset: 0, length: 11 },
      { type: ApiMessageEntityTypes.Italic, offset: 0, length: 11 },
    ]);
  });

  test('should correctly parse CustomEmoji', () => {
    const inputText = 'эмоджи <img class="custom-emoji emoji emoji-small" draggable="false" alt="😄" data-document-id="5386587088873331829" data-unique-id="m6uihe5asystpx9i72r" data-entity-type="MessageEntityCustomEmoji" src="http://localhost:1234/blank.8dd283bceccca95a48d8.png">';

    const expectedText = 'эмоджи 😄';
    const expectedEntity = {
      type: 'MessageEntityCustomEmoji',
      offset: 7,
      length: 2,
      documentId: '5386587088873331829',
    };

    // const result = parseMarkdownToEntities(inputText);
    const ast = parseMarkdownToAST(inputText) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);

    expect(result.text).toBe(expectedText);
    expect(result.entities).toContainEqual(expectedEntity);
  });

  it('renders many/nested entities', () => {
    const inputMarkdown = '**__bold italic__** some plain text **again bold** ++underlined **bold**++';
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('bold italic some plain text again bold underlined bold');
    expect(result.entities).toEqual([
      { type: ApiMessageEntityTypes.Bold, offset: 0, length: 11 },
      { type: ApiMessageEntityTypes.Italic, offset: 0, length: 11 },
      { type: ApiMessageEntityTypes.Bold, offset: 28, length: 10 },
      { type: ApiMessageEntityTypes.Underline, offset: 39, length: 15 },
      { type: ApiMessageEntityTypes.Bold, offset: 50, length: 4 },
    ]);
  });

  it('should parse <span data-entity-type> as spoiler node', () => {
    const [inputMarkdown, outputText] = [`<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text</span>`, 'spoiler text'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);

    expect(ast.type).toBe(NodeType.DOCUMENT);
    // const htmlOutput = renderASTToHTML(ast);

    expect(result.text).toBe(outputText);
    expect(result.entities).toEqual([
      { type: ApiMessageEntityTypes.Spoiler, offset: 0, length: 12 },
      // { type: ApiMessageEntityTypes.Bold, offset: 28, length: 10 },
    ]);
  });

  it('should parse <span data-entity-type> as spoiler node nested md', () => {
    const [inputMarkdown, outputText] = [`<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler text **bold text**</span>`, 'spoiler text bold text'];
    const ast = parseMarkdownToAST(inputMarkdown) || { type: NodeType.DOCUMENT, value: '', children: [] };
    const result = renderASTToEntities(ast);

    expect(ast.type).toBe(NodeType.DOCUMENT);
    // const htmlOutput = renderASTToHTML(ast);

    expect(result.text).toBe(outputText);
    expect(result.entities).toEqual([
      { type: ApiMessageEntityTypes.Spoiler, offset: 0, length: 22 },
      { type: ApiMessageEntityTypes.Bold, offset: 13, length: 9 },
    ]);
  });
});

describe('parseMarkdownToEntities', () => {
  test('should parse plain text', () => {
    const input = 'Hello, world!';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Hello, world!');
    expect(result.entities).toEqual([]);
  });

  test('should parse bold markdown', () => {
    const input = 'Hello, **bold** world!';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Hello, bold world!');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 7,
      length: 4,
    });
  });

  test('should parse italic markdown', () => {
    const input = 'Hello, __italic__ world!';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Hello, italic world!');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 7,
      length: 6,
    });
  });

  test('should parse code markdown', () => {
    const input = 'Here is some `code`';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Here is some code');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 13,
      length: 4,
    });
  });

  test('should parse custom emoji', () => {
    const input = 'Emoji: <img class="custom-emoji" alt="😄" data-document-id="123456" data-entity-type="MessageEntityCustomEmoji">';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Emoji: 😄');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 7,
      length: 2,
      documentId: '123456',
    });
  });

  test('should parse mixed markdown and custom emoji', () => {
    const input = '**Bold** and __italic__ with emoji <img class="custom-emoji" alt="🎉" data-document-id="789012" data-entity-type="MessageEntityCustomEmoji">';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Bold and italic with emoji 🎉');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: 4,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 9,
      length: 6,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 27,
      length: 2,
      documentId: '789012',
    });
  });

  test('should parse nested markdown', () => {
    const input = '**Bold __and italic__**';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Bold and italic');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: 15,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 5,
      length: 10,
    });
  });

  test('should parse markdown with links', () => {
    const input = 'Check out [this link](https://example.com)';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Check out this link');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.TextUrl,
      offset: 10,
      length: 9,
      url: 'https://example.com',
    });
  });

  test('should parse complex HTML mixed with markdown and custom emoji', () => {
    const input = `
      <div class="message">
        **Important bold** announcement:
        <ul>
          <li>Item 1 with __italic emphasis__</li>
          <li>Item 2 with <img class="custom-emoji" alt="🚀" data-document-id="246810" data-entity-type="MessageEntityCustomEmoji"></li>
        </ul>
        Visit our [website](https://example.com) for more info.
      </div>
    `;
    const result = parseMarkdownHtmlToEntities(input);

    expect(result.text).toBe('\n      \n        Important bold announcement:\n        \n          Item 1 with italic emphasis\n          Item 2 with 🚀\n        \n        Visit our website for more info.\n      \n    ');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 16,
      length: 14,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 76,
      length: 15,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 114,
      length: 2,
      documentId: '246810',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.TextUrl,
      offset: 144,
      length: 7,
      url: 'https://example.com',
    });
  });

  test('should handle code blocks', () => {
    const input = 'Here is a code block:\n```python\nprint("Hello, world!")\n```';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Here is a code block:\nprint("Hello, world!")');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Pre,
      offset: 22,
      length: 22,
      language: 'python',
    });
  });

  test('should handle multiple custom emojis', () => {
    const input = 'Multiple emojis: <img class="custom-emoji" alt="😃" data-document-id="111" data-entity-type="MessageEntityCustomEmoji"> and <img class="custom-emoji" alt="🎈" data-document-id="222" data-entity-type="MessageEntityCustomEmoji">';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Multiple emojis: 😃 and 🎈');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 17,
      length: 2,
      documentId: '111',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 24,
      length: 2,
      documentId: '222',
    });
  });

  test('should handle markdown inside HTML tags', () => {
    const input = '<div>This is **bold** inside a div</div>';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('This is bold inside a div');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 8,
      length: 4,
    });
  });

  test('should handle HTML entities', () => {
    const input = 'This &amp; that &lt;3 coding';
    const result = parseMarkdownHtmlToEntities(input);
    // expect(result.text).toBe('This & that <3 coding');
    expect(result.text).toBe('This & that <3 coding');
    expect(result.entities).toEqual([]);
  });

  test('should handle mixed inline code and custom emoji', () => {
    const input = 'Use `console.log()` <img class="custom-emoji" alt="💻" data-document-id="333" data-entity-type="MessageEntityCustomEmoji"> for debugging';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Use console.log() 💻 for debugging');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 4,
      length: 13,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 18,
      length: 2,
      documentId: '333',
    });
  });

  test('should handle complex nested markdown with custom emoji', () => {
    const input = '**Bold __italic__ nested** with <img class="custom-emoji" alt="🎭" data-document-id="444" data-entity-type="MessageEntityCustomEmoji"> and `code`';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Bold italic nested with 🎭 and code');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: 18,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 5,
      length: 6,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 24,
      length: 2,
      documentId: '444',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 31,
      length: 4,
    });
  });

  test('should handle markdown lists with custom emoji', () => {
    const input = 'Shopping list:\n- Apples <img class="custom-emoji" alt="🍎" data-document-id="555" data-entity-type="MessageEntityCustomEmoji">\n- Bananas <img class="custom-emoji" alt="🍌" data-document-id="666" data-entity-type="MessageEntityCustomEmoji">\n- __Milk__';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Shopping list:\n- Apples 🍎\n- Bananas 🍌\n- Milk');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 24,
      length: 2,
      documentId: '555',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 37,
      length: 2,
      documentId: '666',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 42,
      length: 4,
    });
  });

  test('should handle markdown blockquotes with custom emoji', () => {
    const input = '> This is a quote <img class="custom-emoji" alt="💬" data-document-id="777" data-entity-type="MessageEntityCustomEmoji">\n> With **bold** text';
    const result = parseMarkdownHtmlToEntities(input);
    // expect(result.text).toBe('This is a quote 💬\nWith bold text');
    expect(result.text).toBe(' This is a quote 💬\n With bold text');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 0,
      length: 35,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 17,
      length: 2,
      documentId: '777',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 26,
      length: 4,
    });
  });

  test('should handle markdown blockquotes with custom emoji nospaces', () => {
    const input = '>This is a quote <img class="custom-emoji" alt="💬" data-document-id="777" data-entity-type="MessageEntityCustomEmoji">\n>With **bold** text';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('This is a quote 💬\nWith bold text');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 0,
      length: 33,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 16,
      length: 2,
      documentId: '777',
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 24,
      length: 4,
    });
  });

  test('should handle inline spoilers with custom emoji', () => {
    const input = 'This is a ||spoiler <img class="custom-emoji" alt="🙈" data-document-id="888" data-entity-type="MessageEntityCustomEmoji">|| message';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('This is a spoiler 🙈 message');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Spoiler,
      offset: 10,
      length: 10,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 18,
      length: 2,
      documentId: '888',
    });
  });

  test('should handle multiple nested styles', () => {
    const input = '**Bold** and **__bold italic__** and __++italic underline++__';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Bold and bold italic and italic underline');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: 4,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 9,
      length: 11,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 9,
      length: 11,
    });

    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 25,
      length: 16,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Underline,
      offset: 25,
      length: 16,
    });
  });

  // test('should handle custom emoji within code blocks', () => {
  //   const input = '```\nCode block with <img class="custom-emoji" alt="🖥️" data-document-id="999" data-entity-type="MessageEntityCustomEmoji">\n```';
  //   const result = parseMarkdownToEntities(input);
  //   expect(result.text).toBe('Code block with 🖥️');
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Pre,
  //     offset: 0,
  //     length: 19,
  //   });
  //   // Note: Custom emoji should not be parsed within code blocks
  //   expect(result.entities).not.toContainEqual({
  //     type: ApiMessageEntityTypes.CustomEmoji,
  //     offset: 16,
  //     length: 2,
  //     documentId: '999',
  //   });
  // });

  // test('should handle mentions and hashtags', () => {
  //   const input = 'Hey @username, check out #trending topics!';
  //   const result = parseMarkdownToEntities(input);
  //   expect(result.text).toBe('Hey @username, check out #trending topics!');
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Mention,
  //     offset: 4,
  //     length: 9,
  //   });
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Hashtag,
  //     offset: 25,
  //     length: 9,
  //   });
  // });

  // test('should handle URLs and email addresses', () => {
  //   const input = 'Visit https://example.com or email user@example.com';
  //   const result = parseMarkdownToEntities(input);
  //   expect(result.text).toBe('Visit https://example.com or email user@example.com');
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Url,
  //     offset: 6,
  //     length: 19,
  //   });
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Email,
  //     offset: 36,
  //     length: 16,
  //   });
  // });

  // test('should handle phone numbers', () => {
  //   const input = 'Call me at +1 (123) 456-7890';
  //   const result = parseMarkdownToEntities(input);
  //   expect(result.text).toBe('Call me at +1 (123) 456-7890');
  //   expect(result.entities).toContainEqual({
  //     type: ApiMessageEntityTypes.Phone,
  //     offset: 11,
  //     length: 17,
  //   });
  // });

  test('should handle custom emoji ', () => {
    const input = '<div>das <div class="CustomEmoji-module__root custom-emoji emoji" data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏" alt="😏"></div>&nbsp;was</div>';
    // const result = parseMarkdownHtmlToEntities(input);
    const cleanedHtml = cleanHtml(input);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('das 😏 was');
    expect(result.entities).toContainEqual({
      documentId: '5375170473095077321',
      length: 2,
      offset: 4,
      type: 'MessageEntityCustomEmoji',
    });
  });

  test('should handle custom emoji inside div', () => {
    const input = 'das <div alt="😏" data-entity-type="MessageEntityCustomEmoji" data-document-id="5375170473095077321" data-alt="😏">😏</div>&nbsp;was';
    // const result = parseMarkdownHtmlToEntities(input);
    const cleanedHtml = cleanHtml(input);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe('das 😏 was');
    expect(result.entities).toContainEqual({
      documentId: '5375170473095077321',
      length: 2,
      offset: 4,
      type: 'MessageEntityCustomEmoji',
    });
  });

  test('should handle mixed entities and styles', () => {
    const input = '**Bold @mention** and __italic #hashtag__ with `code` and <img class="custom-emoji" alt="🎉" data-document-id="1010" data-entity-type="MessageEntityCustomEmoji">';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('Bold @mention and italic #hashtag with code and 🎉');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: 13,
    });
    // expect(result.entities).toContainEqual({
    //   type: ApiMessageEntityTypes.Mention,
    //   offset: 5,
    //   length: 8,
    // });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 18,
      length: 15,
    });
    // expect(result.entities).toContainEqual({
    //   type: ApiMessageEntityTypes.Hashtag,
    //   offset: 25,
    //   length: 8,
    // });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 39,
      length: 4,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 48,
      length: 2,
      documentId: '1010',
    });
  });

  test('should handle nested quotes and lists', () => {
    const input = '> Outer quote\n>> Nested quote\n> - List item 1\n> - List item 2';
    // const result = parseMarkdownHtmlToEntities(input);
    const cleanedHtml = cleanHtml(input);
    const ast = parseMarkdownToAST(cleanedHtml) || { type: NodeType.DOCUMENT, children: [] };
    const result = renderASTToEntities(ast);
    expect(result.text).toBe(' Outer quote\n Nested quote\n - List item 1\n - List item 2');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 0,
      length: 56,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 13,
      length: 13,
    });
    // Note: Nested quotes might be handled differently depending on the implementation
  });

  test('should handle text with irregular whitespace', () => {
    const input = 'GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. It warns that <b>adding the token to the clone URL will store it in plaintext in</b> <code class="text-entity-code">.git/config</code>. This is obviously a security risk for almost every use case, but since I plan on deleting the repository and revoking the token when I\'m done, I don\'t care.';
    // let text = input.trim().replace(/\u200b+/g, '');
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. It warns that adding the token to the clone URL will store it in plaintext in .git/config. This is obviously a security risk for almost every use case, but since I plan on deleting the repository and revoking the token when I\'m done, I don\'t care.');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 162,
      length: 63,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 226,
      length: 11,
    });
  });

  test('should handle html.md mix text', () => {
    const input = '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;">GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. <br>> It warns that <b>adding the token to the clone URL will store it in plaintext in</b>&nbsp;<code class="text-entity-code">.git/config</code>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i>&nbsp;repository and revoking the token when I\'m done, <b>I don\'t care.</b></div>';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. \n It warns that adding the token to the clone URL will store it in plaintext in .git/config. This is obviously a security risk for almost every use case, but since I plan on deleting the repository and revoking the token when I\'m done, I don\'t care.');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 149,
      length: 248,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 164,
      length: 63,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Code,
      offset: 228,
      length: 11,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 249,
      length: 85,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 384,
      length: 13,
    });
  });

  test('should handle html.md mix text, PRE', () => {
    const input = '<div id="editable-message-text" class="form-control allow-selection touched" contenteditable="true" role="textbox" dir="auto" tabindex="0" aria-label="Message" style="transition: color 50ms linear !important;">GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. <br>> It warns that <b>adding the token to the clone URL will store it in plaintext in</b>&nbsp;<pre class="text-entity-code">.git/config</pre>. This is <i>obviously a security risk for almost every use case, but since I plan on deleting the</i>&nbsp;repository and revoking the token when I\'m done, <b>I don\'t care.</b></div>';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('GitHub has a very handy guide on how to do this, but it doesn\'t cover what to do if you want to include it all in one line for automation purposes. \n It warns that adding the token to the clone URL will store it in plaintext in .git/config. This is obviously a security risk for almost every use case, but since I plan on deleting the repository and revoking the token when I\'m done, I don\'t care.');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Blockquote,
      offset: 149,
      length: 248,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 164,
      length: 63,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Pre,
      offset: 228,
      length: 11,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Italic,
      offset: 249,
      length: 85,
    });
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Bold,
      offset: 384,
      length: 13,
    });
  });

  test('should handle strikethrough text', () => {
    const input = 'This is ~~strikethrough~~ text';
    const result = parseMarkdownHtmlToEntities(input);
    expect(result.text).toBe('This is strikethrough text');
    expect(result.entities).toContainEqual({
      type: ApiMessageEntityTypes.Strike,
      offset: 8,
      length: 13,
    });
  });
});
