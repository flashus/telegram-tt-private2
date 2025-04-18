import type { Token } from '../src/util/ast/token';

import { TokenType } from '../src/util/ast/astEnums';
import { Lexer } from '../src/util/ast/lexer';

// @ts-ignore
class TestLexer extends Lexer {
  public tryTokenizeHtmlTag(): Token | undefined {
    return super.tryTokenizeHtmlTag();
  }

  public isHtmlTagAhead(): boolean {
    return super.isHtmlTagAhead();
  }

  public advance(n: number = 1): void {
    // @ts-ignore
    return super.advance(n);
  }

  public get pos(): number {
    // @ts-ignore
    return super.pos;
  }
}

describe('TestLexer HTML tag parsing', () => {
  let lexer: TestLexer;

  // beforeEach(() => {
  //   lexer = new TestLexer('');
  // });

  describe('tryTokenizeHtmlTag', () => {
    it('should parse a simple opening tag', () => {
      lexer = new TestLexer('<div>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.type).toBe(TokenType.HTML_TAG);
      expect(token?.value).toBe('<div>');
      expect(token?.attributes?.tagName).toBe('div');
      expect(token?.attributes?.isClosing).toBe(false);
      expect(token?.attributes?.isSelfClosing).toBe(false);
    });

    it('should parse a closing tag', () => {
      lexer = new TestLexer('</div>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.type).toBe(TokenType.HTML_TAG);
      expect(token?.value).toBe('</div>');
      expect(token?.attributes?.tagName).toBe('div');
      expect(token?.attributes?.isClosing).toBe(true);
    });

    it('should parse a self-closing tag', () => {
      lexer = new TestLexer('<br />');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.type).toBe(TokenType.HTML_TAG);
      expect(token?.value).toBe('<br />');
      expect(token?.attributes?.tagName).toBe('br');
      expect(token?.attributes?.isSelfClosing).toBe(true);
    });

    it('should parse a tag with attributes', () => {
      lexer = new TestLexer('<a href="https://example.com" target="_blank">');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.type).toBe(TokenType.HTML_TAG);
      expect(token?.value).toBe('<a href="https://example.com" target="_blank">');
      expect(token?.attributes?.tagName).toBe('a');
      expect(token?.attributes?.attributes).toEqual([
        { key: 'href', value: 'https://example.com' },
        { key: 'target', value: '_blank' },
      ]);
    });

    it('should handle attributes with single quotes', () => {
      lexer = new TestLexer("<input type='text' value='hello'>");
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'type', value: 'text' },
        { key: 'value', value: 'hello' },
      ]);
    });

    it('should handle attributes without quotes', () => {
      lexer = new TestLexer('<input type=text>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'type', value: 'text' },
      ]);
    });

    it('should handle attributes without values', () => {
      lexer = new TestLexer('<input required>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'required', value: '' },
      ]);
    });

    it('should return undefined for invalid tags', () => {
      lexer = new TestLexer('<123>');
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
    });

    it('should handle tags with mixed attribute styles', () => {
      lexer = new TestLexer('<div id="main" class=container data-value=\'42\' readonly>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'id', value: 'main' },
        { key: 'class', value: 'container' },
        { key: 'data-value', value: '42' },
        { key: 'readonly', value: '' },
      ]);
    });

    it('should handle tags with whitespace', () => {
      lexer = new TestLexer('<  div   class  =  "spaced"  >');
      expect(lexer.isHtmlTagAhead()).toBe(false);
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeUndefined();
    });

    it('should handle tags with whitespaces after <tagname ', () => {
      lexer = new TestLexer('<div   class  =  "spaced"  />');
      expect(lexer.isHtmlTagAhead()).toBe(true);
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.value).toBe('<div   class  =  "spaced"  />');
      expect(token?.attributes?.tagName).toBe('div');
      expect(token?.attributes?.attributes).toEqual([
        { key: 'class', value: 'spaced' },
      ]);
    });

    // it('should handle unclosed tags as text', () => {
    //   lexer = new TestLexer('<div   class  =  "spaced"  >');
    //   expect(lexer.isHtmlTagAhead()).toBe(false);
    // });

    it('should handle tags with newlines', () => {
      lexer = new TestLexer('<div\nclass="multiline"\nid="test"\n>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'class', value: 'multiline' },
        { key: 'id', value: 'test' },
      ]);
    });

    it('should handle empty attributes', () => {
      lexer = new TestLexer('<input value="">');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'value', value: '' },
      ]);
    });

    it('should handle attributes with special characters', () => {
      lexer = new TestLexer('<div data-special="!@#$%^&*()">');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'data-special', value: '!@#$%^&*()' },
      ]);
    });
  });

  describe('isHtmlTagAhead', () => {
    it('should return true for a simple opening tag/closing', () => {
      lexer = new TestLexer('<div> dsfdsfs </div>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return true for a simple opening tag', () => {
      lexer = new TestLexer('<div>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return true for a simple closing tag', () => {
      lexer = new TestLexer('</div>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    // '<div **bold** and __b<a, so a>b__'
    it('should return true for a simple opening tag', () => {
      lexer = new TestLexer('<div **bold** and __b<a, so a>b__');
      lexer.advance(22);
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false for a < without a closing >', () => {
      lexer = new TestLexer('<div **bold** and __b < a, so a > b__');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return true for a closing tag', () => {
      lexer = new TestLexer('<div> dsfdsf </div>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return true for a self-closing tag', () => {
      lexer = new TestLexer('<br />');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return true for a tag with attributes', () => {
      lexer = new TestLexer('<a href="https://example.com"> </a>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return true for a tag with attributes 2', () => {
      lexer = new TestLexer('<a href="https://example.com"/>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return false for non-tag content', () => {
      lexer = new TestLexer('This is not a tag');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false for incomplete tags', () => {
      lexer = new TestLexer('<div');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false for malformed tags', () => {
      lexer = new TestLexer('< div>');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false when tag is preceded by whitespace', () => {
      lexer = new TestLexer('   <div>');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false for a less-than sign followed by non-tag content', () => {
      lexer = new TestLexer('< 5');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return true for tags with numeric names', () => {
      lexer = new TestLexer('<h1> dfsdfsd </h1>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should return false for custom element tags', () => {
      lexer = new TestLexer('<custom-element> lll </custom-element>');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return false for text that starts with "<" but isn\'t a valid tag', () => {
      lexer = new TestLexer('<not a tag>');
      expect(lexer.isHtmlTagAhead()).toBe(false);
    });

    it('should return true for valid tags with uppercase letters', () => {
      lexer = new TestLexer('<DIV> xcvxc </div>');
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });

    it('should handle tags at the end of input', () => {
      lexer = new TestLexer('text<br>');
      lexer.advance(4); // Move to the start of the tag
      expect(lexer.isHtmlTagAhead()).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty input', () => {
      lexer = new TestLexer('');
      expect(lexer.isHtmlTagAhead()).toBe(false);
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
    });

    it('should handle input with only whitespace', () => {
      lexer = new TestLexer('   ');
      expect(lexer.isHtmlTagAhead()).toBe(false);
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
    });

    it('should not consume input on failed tag parsing', () => {
      lexer = new TestLexer('<not-a-tag> <div/>');
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
      expect(lexer.pos).toBe(0);
      expect(lexer.isHtmlTagAhead()).toBe(false);
      lexer.advance(12); // Move past the invalid tag
      expect(lexer.isHtmlTagAhead()).toBe(true);
      expect(lexer.tryTokenizeHtmlTag()).toBeDefined();
    });

    it('should not consume input on failed tag parsing and correctly handle <br>', () => {
      lexer = new TestLexer('<not-a-tag> <br>');
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
      expect(lexer.pos).toBe(0);
      expect(lexer.isHtmlTagAhead()).toBe(false);
      lexer.advance(12); // Move past the invalid tag
      expect(lexer.isHtmlTagAhead()).toBe(true);
      expect(lexer.tryTokenizeHtmlTag()).toBeDefined();
    });

    it('should handle unclosed tags', () => {
      lexer = new TestLexer('<div');
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
    });

    it('should handle tags with invalid characters', () => {
      lexer = new TestLexer('<div@>');
      expect(lexer.tryTokenizeHtmlTag()).toBeUndefined();
      // expect(lexer.tryTokenizeHtmlTag()).toBeDefined();
    });

    it('should handle nested angle brackets', () => {
      lexer = new TestLexer('<div attr="<nested>">');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'attr', value: '<nested>' },
      ]);
    });

    it('should handle \n quotes small', () => {
      lexer = new TestLexer('text\n>quoted text');
      const tokens = lexer.tokenize();
      expect(tokens.length).toBe(5);
      expect(tokens[1].type).toBe(TokenType.NEWLINE);
      expect(tokens[1].start).toBe(4);
      expect(tokens[1].end).toBe(5);
      expect(tokens[2].type).toBe(TokenType.QUOTE_MARKER);
      expect(tokens[2].start).toBe(5);
      expect(tokens[2].end).toBe(6);
    });

    it('should handle \n quotes ', () => {
      lexer = new TestLexer('>**Bold __italic <strong>and ++HTML++ strong</strong>__\n>>still bold**\nplain text');
      const tokens = lexer.tokenize();
      expect(tokens.length).toBe(21);
      expect(tokens[13].type).toBe(TokenType.NEWLINE);
      expect(tokens[13].start).toBe(55);
      expect(tokens[13].end).toBe(56);
      expect(tokens[14].type).toBe(TokenType.QUOTE_MARKER);
      expect(tokens[14].start).toBe(56);
      expect(tokens[14].end).toBe(57);
    });

    it('mixed html and md', () => {
      lexer = new TestLexer('<div attr="value \\"quoted\\"">some plain text **bold text __italic also__**</div>');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'attr', value: 'value "quoted"' },
      ]);
    });

    it('should handle escaped quotes in attributes', () => {
      lexer = new TestLexer('<div attr="value \\"quoted\\"">');
      const token = lexer.tryTokenizeHtmlTag();
      expect(token).toBeDefined();
      expect(token?.attributes?.attributes).toEqual([
        { key: 'attr', value: 'value "quoted"' },
      ]);
    });
  });
});
