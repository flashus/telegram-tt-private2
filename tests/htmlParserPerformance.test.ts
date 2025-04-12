/* eslint-disable max-len */
import fs from 'fs';
import { performance } from 'perf_hooks';

import { type ApiFormattedText, type ApiMessageEntity, ApiMessageEntityTypes } from '../src/api/types';

import { RE_LINK_TEMPLATE } from '../src/config';
import parseHtmlAsFormattedText, { ENTITY_CLASS_BY_NODE_NAME } from '../src/util/parseHtmlAsFormattedText';

const IS_EMOJI_SUPPORTED = true;
const MAX_TAG_DEEPNESS = 3;

const logToFile = (message: string) => {
  fs.appendFileSync('./dev/perf/screenshot/htmlParserPerformance.log', `${message}\n`);
};

const padString = (str: string, ch: string, len: number, position: 'left' | 'right' = 'left') => {
  if (position === 'left') {
    return ch.repeat(len - str.length >= 0 ? len - str.length : 0) + str;
  } else {
    return str + ch.repeat(len - str.length >= 0 ? len - str.length : 0);
  }
};

const padFixed = (str1: string, str2: string, str3: string, str4: string, str5: string, str6: string, str7: string, str8: string, str9: string) => {
  return `${padString(str1, ' ', 30)} |`
  + ` ${padString(str2, '.', 8)} |`
  + ` ${padString(str3, '.', 8)} |`
  + ` ${padString(str4, '.', 8)} |`
  + ` ${padString(str5, '.', 8)} |`
  + ` ${padString(str6, '.', 8)} |`
  + ` ${padString(str7, '.', 8)} |`
  + ` ${padString(str8, '.', 10)} |`
  + ` ${padString(str9, '.', 10)}`;
};

const formatTestLog = (testName: string, iters: number, nsx: number, resultOld: number, resultNew: number) => {
  const diff = resultNew - resultOld;
  const diffPercent = (diff / resultOld) * 100;
  const bOpsPerSecOld = (iters / resultOld);
  const bOpsPerSecNew = (iters / resultNew);
  return padFixed(
    testName,
    String(iters),
    String(nsx),
    String(resultOld.toFixed(2)),
    String(resultNew.toFixed(2)),
    String(diff.toFixed(2)),
    String(diffPercent.toFixed(2)),
    String(bOpsPerSecOld.toFixed(4)),
    String(bOpsPerSecNew.toFixed(4)),
  );
};

beforeAll(() => {
  // Remove the log file if exists
  const logfile = fs.existsSync('./dev/perf/screenshot/htmlParserPerformance.log');
  if (logfile) {
    fs.unlinkSync('./dev/perf/screenshot/htmlParserPerformance.log');
  }
  // Create a folder if not exists
  fs.mkdirSync('./dev/perf/screenshot', { recursive: true });
  logToFile(padFixed('TestName', 'Iters', 'ns X', 'Old', 'New', 'Diff', 'Diff%', 'Bops/s Old', 'Bops/s New'));

  Object.defineProperty(Element.prototype, 'innerText', {
    get() {
      return this.textContent;
    },
  });
});

function legacyParseHtmlAsFormattedText(
  html: string, withMarkdownLinks = false, skipMarkdown = false,
): ApiFormattedText {
  const fragment = document.createElement('div');

  fragment.innerHTML = skipMarkdown ? html
    : withMarkdownLinks ? parseMarkdown(parseMarkdownLinks(html)) : parseMarkdown(html);
  fixImageContent(fragment);
  const text = fragment.innerText.trim().replace(/\u200b+/g, '');
  const trimShift = fragment.innerText.indexOf(text[0]);
  let textIndex = -trimShift;
  let recursionDeepness = 0;
  const entities: ApiMessageEntity[] = [];

  function addEntity(node: ChildNode) {
    if (node.nodeType === Node.COMMENT_NODE) return;
    const { index, entity } = getEntityDataFromNode(node, text, textIndex);

    if (entity) {
      textIndex = index;
      entities.push(entity);
    } else if (node.textContent) {
      // Skip newlines on the beginning
      if (index === 0 && node.textContent.trim() === '') {
        return;
      }
      textIndex += node.textContent.length;
    }

    if (node.hasChildNodes() && recursionDeepness <= MAX_TAG_DEEPNESS) {
      recursionDeepness += 1;
      Array.from(node.childNodes).forEach(addEntity);
    }
  }

  Array.from(fragment.childNodes).forEach((node) => {
    recursionDeepness = 1;
    addEntity(node);
  });

  return {
    text,
    entities: entities.length ? entities : undefined,
  };
}

export function fixImageContent(fragment: HTMLDivElement) {
  fragment.querySelectorAll('img').forEach((node) => {
    if (node.dataset.documentId) { // Custom Emoji
      node.textContent = (node as HTMLImageElement).alt || '';
    } else { // Regular emoji with image fallback
      node.replaceWith(node.alt || '');
    }
  });
}

function parseMarkdown(html: string) {
  let parsedHtml = html.slice(0);

  // Strip redundant nbsp's
  parsedHtml = parsedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  parsedHtml = parsedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  parsedHtml = parsedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags
  parsedHtml = parsedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<\/div>/g, '');

  // Pre
  parsedHtml = parsedHtml.replace(/^`{3}(.*?)[\n\r](.*?[\n\r]?)`{3}/gms, '<pre data-language="$1">$2</pre>');
  parsedHtml = parsedHtml.replace(/^`{3}[\n\r]?(.*?)[\n\r]?`{3}/gms, '<pre>$1</pre>');
  parsedHtml = parsedHtml.replace(/[`]{3}([^`]+)[`]{3}/g, '<pre>$1</pre>');

  // Code
  parsedHtml = parsedHtml.replace(
    /(?!<(code|pre)[^<]*|<\/)[`]{1}([^`\n]+)[`]{1}(?![^<]*<\/(code|pre)>)/g,
    '<code>$2</code>',
  );

  // Custom Emoji markdown tag
  if (!IS_EMOJI_SUPPORTED) {
    // Prepare alt text for custom emoji
    parsedHtml = parsedHtml.replace(/\[<img[^>]+alt="([^"]+)"[^>]*>]/gm, '[$1]');
  }
  parsedHtml = parsedHtml.replace(
    /(?!<(?:code|pre)[^<]*|<\/)\[([^\]\n]+)\]\(customEmoji:(\d+)\)(?![^<]*<\/(?:code|pre)>)/g,
    '<img alt="$1" data-document-id="$2">',
  );

  // Other simple markdown
  parsedHtml = parsedHtml.replace(
    /(?!<(code|pre)[^<]*|<\/)[*]{2}([^*\n]+)[*]{2}(?![^<]*<\/(code|pre)>)/g,
    '<b>$2</b>',
  );
  parsedHtml = parsedHtml.replace(
    /(?!<(code|pre)[^<]*|<\/)[_]{2}([^_\n]+)[_]{2}(?![^<]*<\/(code|pre)>)/g,
    '<i>$2</i>',
  );
  parsedHtml = parsedHtml.replace(
    /(?!<(code|pre)[^<]*|<\/)[~]{2}([^~\n]+)[~]{2}(?![^<]*<\/(code|pre)>)/g,
    '<s>$2</s>',
  );
  parsedHtml = parsedHtml.replace(
    /(?!<(code|pre)[^<]*|<\/)[|]{2}([^|\n]+)[|]{2}(?![^<]*<\/(code|pre)>)/g,
    `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">$2</span>`,
  );

  return parsedHtml;
}

function parseMarkdownLinks(html: string) {
  return html.replace(new RegExp(`\\[([^\\]]+?)]\\((${RE_LINK_TEMPLATE}+?)\\)`, 'g'), (_, text, link) => {
    const url = link.includes('://') ? link : link.includes('@') ? `mailto:${link}` : `https://${link}`;
    return `<a href="${url}">${text}</a>`;
  });
}

function getEntityDataFromNode(
  node: ChildNode,
  rawText: string,
  textIndex: number,
): { index: number; entity?: ApiMessageEntity } {
  const type = getEntityTypeFromNode(node);

  if (!type || !node.textContent) {
    return {
      index: textIndex,
      entity: undefined,
    };
  }

  const rawIndex = rawText.indexOf(node.textContent, textIndex);
  // In some cases, last text entity ends with a newline (which gets trimmed from `rawText`).
  // In this case, `rawIndex` would return `-1`, so we use `textIndex` instead.
  const index = rawIndex >= 0 ? rawIndex : textIndex;
  const offset = rawText.substring(0, index).length;
  const { length } = rawText.substring(index, index + node.textContent.length);

  if (type === ApiMessageEntityTypes.TextUrl) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        url: (node as HTMLAnchorElement).href,
      },
    };
  }
  if (type === ApiMessageEntityTypes.MentionName) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        userId: (node as HTMLAnchorElement).dataset.userId!,
      },
    };
  }

  if (type === ApiMessageEntityTypes.Pre) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        language: (node as HTMLPreElement).dataset.language,
      },
    };
  }

  if (type === ApiMessageEntityTypes.CustomEmoji) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        documentId: (node as HTMLImageElement).dataset.documentId!,
      },
    };
  }

  if (type === ApiMessageEntityTypes.Timestamp) {
    const timestamp = Number((node as HTMLElement).dataset.timestamp);
    if (Number.isNaN(timestamp)) {
      return {
        index,
        entity: undefined,
      };
    }

    return {
      index,
      entity: {
        type,
        offset,
        length,
        timestamp,
      },
    };
  }

  return {
    index,
    entity: {
      type,
      offset,
      length,
    },
  };
}

function getEntityTypeFromNode(node: ChildNode): ApiMessageEntityTypes | undefined {
  if (node instanceof HTMLElement && node.dataset.entityType) {
    return node.dataset.entityType as ApiMessageEntityTypes;
  }

  if (ENTITY_CLASS_BY_NODE_NAME[node.nodeName]) {
    return ENTITY_CLASS_BY_NODE_NAME[node.nodeName];
  }

  if (node.nodeName === 'A') {
    const anchor = node as HTMLAnchorElement;
    if (anchor.dataset.entityType === ApiMessageEntityTypes.MentionName) {
      return ApiMessageEntityTypes.MentionName;
    }
    if (anchor.dataset.entityType === ApiMessageEntityTypes.Url) {
      return ApiMessageEntityTypes.Url;
    }
    if (anchor.href.startsWith('mailto:')) {
      return ApiMessageEntityTypes.Email;
    }
    if (anchor.href.startsWith('tel:')) {
      return ApiMessageEntityTypes.Phone;
    }
    if (anchor.href !== anchor.textContent) {
      return ApiMessageEntityTypes.TextUrl;
    }

    return ApiMessageEntityTypes.Url;
  }

  if (node.nodeName === 'SPAN') {
    return (node as HTMLElement).dataset.entityType as any;
  }

  if (node.nodeName === 'IMG') {
    if ((node as HTMLImageElement).dataset.documentId) {
      return ApiMessageEntityTypes.CustomEmoji;
    }
  }

  return undefined;
}

const TEST_ITERATIONS = 1000;

function measurePerformance(fn: Function, input: string, iterations: number = TEST_ITERATIONS) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(input);
  }
  return performance.now() - start;
}

describe('HTML Parser Performance Tests', () => {
  it('should compare performance for simple text', () => {
    const input = 'Hello, world!';

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Simple text', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for markdown formatting', () => {
    const input = '**Bold** and __italic__ with `code` and ~~strikethrough~~';

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      // logToFile(formatTestLog(`Markdown formatting ${iters}`, legacyTime * (iters / TEST_ITERATIONS), newTime * (iters / TEST_ITERATIONS)));
      logToFile(formatTestLog('Markdown formatting', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for custom emoji', () => {
    const input = 'Custom emoji: <img class="custom-emoji" alt="😄" data-document-id="123456" data-entity-type="MessageEntityCustomEmoji">';

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Custom emoji', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for complex mixed content', () => {
    const input = `
      <div class="message">
        **Important announcement**:
        <ul>
          <li>Item 1 with __italic__</li>
          <li>Item 2 with <img class="custom-emoji" alt="🚀" data-document-id="246810" data-entity-type="MessageEntityCustomEmoji"></li>
        </ul>
        Visit our [website](https://example.com) for more info.
        \`\`\`typescript
        const x: number = 42;
        logToFile(x);
        \`\`\`
      </div>
    `;

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Complex mixed content', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for multiple custom emojis', () => {
    const input = `Multiple emojis: ${Array(10).fill('<img class="custom-emoji" alt="😃" data-document-id="111" data-entity-type="MessageEntityCustomEmoji">').join(' and ')}`;

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Multiple custom emojis', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for nested formatting', () => {
    const input = '**Bold __italic__ nested** with ||spoiler|| and `code` inside';

    for (const iters of [1, 10, 100, 1000, 10000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Nested formatting', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for long formatted article', () => {
    const input = `
      <div class="article-content">
        # Introduction to Performance Testing
  
        **Performance testing** is a crucial aspect of software development that helps ensure your application can handle expected loads efficiently. Here are some key points to consider:
  
        ## Test Categories
        1. __Load Testing__: Verifies system behavior under normal and peak loads
        2. __Stress Testing__: Determines system's breaking point
        3. __Endurance Testing__: Checks system behavior under sustained load
        
        \`\`\`typescript
        interface PerformanceMetrics {
          responseTime: number;
          throughput: number;
          resourceUtilization: {
            cpu: number;
            memory: number;
            network: number;
          };
          errorRate: number;
        }
  
        class PerformanceMonitor {
          private metrics: PerformanceMetrics;
          
          constructor() {
            this.metrics = {
              responseTime: 0,
              throughput: 0,
              resourceUtilization: {
                cpu: 0,
                memory: 0,
                network: 0
              },
              errorRate: 0
            };
          }
        }
        \`\`\`
  
        ### Best Practices <img class="custom-emoji" alt="📚" data-document-id="789012" data-entity-type="MessageEntityCustomEmoji">
  
        1. Start testing early in development cycle
        2. Use realistic data sets
        3. Monitor __system resources__ during tests
        4. Document all test results
        5. Establish clear ||performance criteria||
  
        > **Important Note**: Always consider the following factors:
        > - Network latency
        > - Database performance
        > - Cache efficiency
        > - __Resource utilization__
  
        For more information, visit our [documentation portal](https://docs.example.com/performance-testing) or contact the ||performance team|| for assistance.
  
        \`\`\`python
        def calculate_metrics(raw_data):
            results = {
                'mean': statistics.mean(raw_data),
                'median': statistics.median(raw_data),
                'std_dev': statistics.stdev(raw_data),
                'percentiles': {
                    '95th': numpy.percentile(raw_data, 95),
                    '99th': numpy.percentile(raw_data, 99)
                }
            }
            return results
        \`\`\`
      </div>
    `;

    for (const iters of [1, 10, 100, 1000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Long formatted article', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for nested HTML with mixed content', () => {
    const input = `
      <div class="message-thread">
        <div class="message-container">
          <div class="message-header">
            <span class="author">John Doe</span>
            <span class="timestamp">2024-03-15 10:30 <img class="custom-emoji" alt="⏰" data-document-id="123456" data-entity-type="MessageEntityCustomEmoji"></span>
          </div>
          <div class="message-content">
            **Project Update** <img class="custom-emoji" alt="📊" data-document-id="789012" data-entity-type="MessageEntityCustomEmoji">
  
            Here's the latest status on our performance improvements:
  
            1. Database Optimization
               - Reduced query time by __45%__
               - Implemented ||new indexing strategy||
               - Added \`caching layer\`
  
            2. Frontend Changes
               - **Lazy loading** implementation
               - __Code splitting__ by routes
               - ||Bundle size reduction||
  
            \`\`\`javascript
            // Performance monitoring setup
            class PerformanceTracker {
              constructor() {
                this.metrics = new Map();
                this.startTime = performance.now();
              }
  
              trackMetric(name, value) {
                if (!this.metrics.has(name)) {
                  this.metrics.set(name, []);
                }
                this.metrics.get(name).push({
                  value,
                  timestamp: performance.now() - this.startTime
                });
              }
  
              generateReport() {
                return Array.from(this.metrics.entries())
                  .reduce((report, [name, values]) => {
                    report[name] = {
                      min: Math.min(...values.map(v => v.value)),
                      max: Math.max(...values.map(v => v.value)),
                      avg: values.reduce((sum, v) => sum + v.value, 0) / values.length
                    };
                    return report;
                  }, {});
              }
            }
            \`\`\`
  
            > Please review the changes and provide feedback by [following this link](https://review.example.com/perf-improvements)
  
            Next steps:
            - Implement __monitoring alerts__
            - Deploy to ||staging environment||
            - Conduct **load testing**
          </div>
        </div>
      </div>
    `;

    for (const iters of [1, 10, 100, 1000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Nested HTML mixed content', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for long conversation text', () => {
    const input = `
      <div class="message-thread">
        Hey there! I just got back from that amazing conference in San Francisco <img class="custom-emoji" alt="✨" data-document-id="123456" data-entity-type="MessageEntityCustomEmoji">. The presentations were incredible, especially the one about scaling distributed systems.
  
        The keynote speaker shared some fascinating insights about how they handle millions of requests per second. I took detailed notes and would love to share them with the team.
  
        By the way, did you see the new features they announced? <img class="custom-emoji" alt="🚀" data-document-id="789012" data-entity-type="MessageEntityCustomEmoji"> The real-time collaboration tools look promising. I think we could integrate some of those concepts into our project.
  
        The networking sessions were valuable too. Met some brilliant engineers from various tech companies. One of them showed me a clever approach to our caching problem <img class="custom-emoji" alt="💡" data-document-id="345678" data-entity-type="MessageEntityCustomEmoji">
  
        Here's a quick summary of the key points from the conference:
        - Cloud-native architecture best practices
        - Performance optimization techniques
        - Security in distributed systems
        - DevOps automation strategies
        - Machine learning integration patterns
  
        The after-party was fun too <img class="custom-emoji" alt="🎉" data-document-id="901234" data-entity-type="MessageEntityCustomEmoji">! Got to chat with developers from around the world. It's amazing how similar our challenges are, regardless of location or industry.
  
        I also picked up some great books from the conference bookstore. Currently reading "Designing Data-Intensive Applications" - it's incredibly relevant to what we're working on.
  
        Let's catch up tomorrow and discuss how we can apply some of these learnings to our current sprint. I have some ideas that could help improve our system's performance <img class="custom-emoji" alt="📈" data-document-id="567890" data-entity-type="MessageEntityCustomEmoji">
  
        Oh, and before I forget - they're planning to open-source some of their tools next month. We should definitely keep an eye on their GitHub repository.
  
        The community is really supportive <img class="custom-emoji" alt="❤️" data-document-id="234567" data-entity-type="MessageEntityCustomEmoji">. Several developers offered to help us with our open issues. I've added them to our Slack channel.
  
        Looking forward to our discussion tomorrow! Let me know what time works best for you.
      </div>
    `;

    for (const iters of [1, 10, 100, 1000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Long conversation text', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });

  it('should compare performance for multi-message conversation', () => {
    const input = `
      <div class="chat-history">
        <div class="message">
          Hey! How's the project coming along? <img class="custom-emoji" alt="👋" data-document-id="111222" data-entity-type="MessageEntityCustomEmoji">
        </div>
  
        <div class="message">
          Making good progress! Just finished implementing the new authentication system. The tests are all passing, and the performance metrics look promising.
        </div>
  
        <div class="message">
          That's great to hear! <img class="custom-emoji" alt="🎉" data-document-id="333444" data-entity-type="MessageEntityCustomEmoji"> Have you documented the API changes?
        </div>
  
        <div class="message">
          Yes, I've updated the documentation and added examples for all the new endpoints. I also included some common use cases and troubleshooting guides. Should make it easier for the team to understand and implement.
        </div>
  
        <div class="message">
          Perfect timing! The client meeting is tomorrow, and they'll definitely want to see the documentation. They've been asking about the security improvements we've made.
        </div>
  
        <div class="message">
          I can walk them through the security features <img class="custom-emoji" alt="🔒" data-document-id="555666" data-entity-type="MessageEntityCustomEmoji">. We've implemented:
          - Two-factor authentication
          - Rate limiting
          - JWT token management
          - IP whitelisting
          - Audit logging
        </div>
  
        <div class="message">
          Sounds comprehensive! The client will be pleased. Their security team was particularly concerned about the audit trails.
        </div>
  
        <div class="message">
          Yeah, I made sure to include detailed logging for all authentication events. We can track every login attempt, token refresh, and permission change <img class="custom-emoji" alt="📊" data-document-id="777888" data-entity-type="MessageEntityCustomEmoji">
        </div>
  
        <div class="message">
          Great work! Let's review everything one more time before the meeting. I'll set up a quick sync in an hour?
        </div>
  
        <div class="message">
          Works for me! <img class="custom-emoji" alt="👍" data-document-id="999000" data-entity-type="MessageEntityCustomEmoji"> I'll prepare a demo of the new features.
        </div>
      </div>
    `;

    for (const iters of [1, 10, 100, 1000]) {
      const legacyTime = measurePerformance(legacyParseHtmlAsFormattedText, input, iters);
      const newTime = measurePerformance(parseHtmlAsFormattedText, input, iters);

      logToFile(formatTestLog('Multi-message conversation', iters, TEST_ITERATIONS / iters, legacyTime * (TEST_ITERATIONS / iters), newTime * (TEST_ITERATIONS / iters)));
    }

    expect(legacyParseHtmlAsFormattedText(input)).toEqual(parseHtmlAsFormattedText(input));
  });
});
