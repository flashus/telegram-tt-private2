import { ApiMessageEntityTypes } from '../../../../api/types';

import { DEBUG } from '../../../../config';
import cleanDocsHtml from '../../../../lib/cleanDocsHtml';
import { ENTITY_CLASS_BY_NODE_NAME } from '../../../../util/parseHtmlAsFormattedText';

const STYLE_TAG_REGEX = /<style>(.*?)<\/style>/gs;

const allowedTags: Record<string, string[]> = {
  div: ['src', 'alt', 'data-entity-type', 'data-document-id', 'data-alt'],
  span: ['data-entity-type'],
  b: ['data-entity-type'],
  strong: ['data-entity-type'],
  i: ['data-entity-type'],
  em: ['data-entity-type'],
  u: ['data-entity-type'],
  ins: ['data-entity-type'],
  s: ['data-entity-type'],
  strike: ['data-entity-type'],
  del: ['data-entity-type'],
  a: ['href', 'data-entity-type', 'target'],
  spoiler: ['data-entity-type'],
  blockquote: ['data-entity-type'],
  pre: ['data-entity-type', 'data-language'],
  code: ['data-entity-type'],
  img: ['src', 'alt', 'data-entity-type', 'data-document-id', 'data-alt'],
};

export function preparePastedHtml(html: string) {
  let fragment = document.createElement('div');
  try {
    html = cleanDocsHtml(html);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
  fragment.innerHTML = html.replace(/\u00a0/g, ' ').replace(STYLE_TAG_REGEX, ''); // Strip &nbsp and styles

  fragment.innerHTML = fragment.innerHTML.replace('<!--StartFragment-->', '').replace('<!--EndFragment-->', '');

  const textContents = fragment.querySelectorAll<HTMLDivElement>('.text-content');
  if (textContents.length) {
    fragment = textContents[textContents.length - 1]; // Replace with the last copied message
  }

  const nodes = Array.from(fragment.getElementsByTagName('*'));
  if (nodes.length > 0 && nodes[0].tagName === 'BR') {
    nodes[0].remove();
  }
  if (nodes.length > 0 && nodes[nodes.length - 1].tagName === 'BR') {
    nodes[nodes.length - 1].remove();
  }
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      node.remove();
      return;
    }
    if (node.nodeType === Node.COMMENT_NODE) return;

    // remove pasted codeblock trash
    if (node.tagName === 'DIV' && node.classList.contains('CodeOverlay-module__overlay')) {
      node.remove();
    }

    node.removeAttribute('style');

    // Fix newlines
    if (node.tagName === 'BR') node.replaceWith('\n');
    if (node.tagName === 'P') node.appendChild(document.createTextNode('\n'));
    // Preserve block boundaries: append newline for non-entity DIV and for list items
    if (node.tagName === 'DIV' && !node.dataset.entityType) node.appendChild(document.createTextNode('\n'));
    if (node.tagName === 'LI') node.appendChild(document.createTextNode('\n'));
    if (node.tagName === 'IMG' && !node.dataset.entityType) node.replaceWith(node.getAttribute('alt') || '');
    // We do not intercept copy logic, so we remove some nodes here
    if (node.dataset.ignoreOnPaste) node.remove();

    if (ENTITY_CLASS_BY_NODE_NAME[node.tagName]) {
      node.setAttribute('data-entity-type', ENTITY_CLASS_BY_NODE_NAME[node.tagName]);
    }

    // Strip non-entity tags
    const allowedAttributes = allowedTags[node.tagName.toLowerCase()] || allowedTags['*'];
    if (!node.dataset.entityType
      && (!allowedAttributes || allowedAttributes.length === 0)
      && !Array.from(node.childNodes).some((child) => child.nodeType === Node.ELEMENT_NODE)) {
      node.replaceWith(node.textContent ?? '');
    } else if (!allowedAttributes) {
      // If no attributes are specified for this tag, allow any attributes
      return;
    } else {
      // Remove attributes that are not allowed
      Array.from(node.attributes).forEach((attr) => {
        if (!allowedAttributes.includes(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });
    }

    // Append entity parameters for parsing
    if (node.dataset.alt) node.setAttribute('alt', node.dataset.alt);
    switch (node.dataset.entityType) {
      case ApiMessageEntityTypes.MentionName:
        node.replaceWith(node.textContent || '');
        break;
      case ApiMessageEntityTypes.CustomEmoji:
        node.textContent = node.dataset.alt || '';
        break;
    }
  });

  // Unwrap <code> elements inside <pre> elements
  fragment.querySelectorAll('pre > code').forEach((codeEl) => {
    const parentPre = codeEl.parentElement;
    if (parentPre) {
      // Move all children of the <code> element out into the <pre>
      while (codeEl.firstChild) {
        parentPre.insertBefore(codeEl.firstChild, codeEl);
      }
      // Remove the now-empty <code> element
      codeEl.remove();
    }
  });

  // Select div and span elements without data-entity-type
  const invalidNodes = fragment.querySelectorAll('div:not([data-entity-type]), span:not([data-entity-type])');

  // Iterate over each node
  invalidNodes.forEach((node) => {
    // Unwrap the node to preserve its child content
    while (node.firstChild) {
      node.parentNode!.insertBefore(node.firstChild, node);
    }
    node.remove();
  });

  fragment = filterNode(fragment);
  return fragment.innerHTML.trimEnd();
}

export function escapeHtml(html: string) {
  const fragment = document.createElement('div');
  const text = document.createTextNode(html);
  fragment.appendChild(text);
  return fragment.innerHTML;
}

function filterNode(fragment: HTMLDivElement): HTMLDivElement {
  // First pass: unwrap nodes that are not in the allowed list.
  const allNodes = fragment.querySelectorAll('*');
  Array.from(allNodes)
    .reverse()
    .forEach((node) => {
      const tagName = node.tagName.toLowerCase();
      const allowedAttributes = allowedTags[tagName] || allowedTags['*'];
      if (!allowedAttributes || allowedAttributes.length === 0) {
        // Unwrap the node by moving its children to its parent and then removing it.
        while (node.firstChild) {
          node.parentNode!.insertBefore(node.firstChild, node);
        }
        node.parentNode!.removeChild(node);
      }
    });

  // Second pass: unwrap any remaining nodes that are not allowed and are simple text holders.
  Array.from(fragment.getElementsByTagName('*')).forEach((node) => {
    const tagName = node.tagName.toLowerCase();
    const allowedAttributes = allowedTags[tagName] || allowedTags['*'];
    if (tagName === 'div'
      && !(node as HTMLElement).dataset?.entityType
      && !Array.from(node.childNodes).some((child) => child.nodeType === Node.ELEMENT_NODE)) {
      node.replaceWith(document.createTextNode(node.textContent ?? ''));
    }
    if (
      (!allowedAttributes || allowedAttributes.length === 0)
      && !(node as HTMLElement).dataset?.entityType
      && !Array.from(node.childNodes).some((child) => child.nodeType === Node.ELEMENT_NODE)
    ) {
      node.replaceWith(document.createTextNode(node.textContent ?? ''));
    }
  });

  Object.entries(allowedTags).forEach(([tag, allowedAttrs]) => {
    fragment.querySelectorAll(tag).forEach((elem) => {
      // Store the allowed attributes' values.
      const preserved: Record<string, string> = {};
      allowedAttrs.forEach((attr) => {
        const value = elem.getAttribute(attr);
        // eslint-disable-next-line no-null/no-null
        if (value !== null) {
          preserved[attr] = value;
        }
      });
      // Remove all attributes.
      Array.from(elem.attributes).forEach((attr) => {
        elem.removeAttribute(attr.name);
      });
      // Reapply only the allowed attributes.
      Object.entries(preserved).forEach(([attr, value]) => {
        elem.setAttribute(attr, value);
      });
    });
  });

  return fragment;
}

export const blockQuoteAllowedTags = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'a',
  'spoiler',
  'img',
]);

export function sanitizeHTML(html: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  function cleanNode(curNode: Element) {
    // Keep text nodes as-is
    if (curNode.nodeType === Node.TEXT_NODE) {
      return curNode;
    }
    // If it's an element, only allow allowed tags
    if (curNode.nodeType === Node.ELEMENT_NODE) {
      const tagName = curNode.tagName.toLowerCase();
      const allowedAttributes = allowedTags[tagName] || allowedTags['*'];

      if (!allowedAttributes || allowedAttributes.length === 0) {
        // If no attributes are specified, allow any attributes
        return curNode;
      }
      const cleanElement = document.createElement(curNode.tagName);

      // Copy allowed attributes
      for (const attr of curNode.attributes) {
        if (allowedAttributes.includes(attr.name)) {
          cleanElement.setAttribute(attr.name, attr.value);
        }
      }

      // Recursively clean and append all child nodes
      for (const child of curNode.childNodes) {
        cleanElement.appendChild(cleanNode(child as Element));
      }
      return cleanElement;
    }
    // For any other node types, return an empty text node
    return document.createTextNode('');
  }

  const cleanedNodes = Array.from(tempDiv.childNodes).map((child) => cleanNode(child as Element));
  return cleanedNodes;
}
