import { DOMParser, XMLSerializer } from 'xmldom';
import Symbols from './symbols';

export default class Doc {
  constructor(data = '<m><e></e></m>') {
    this.value = data;
  }

  get value() {
    return (new XMLSerializer()).serializeToString(this.base);
  }

  set value(data) {
    this.base = (new DOMParser()).parseFromString(data, 'text/xml');
  }

  get root() {
    return this.base.documentElement;
  }

  getContent(type, render, editor, node = this.root, path = '') {
    let result = '';
    if (node.nodeName === 'e') {
      if (type === 'latex' && render && editor) {
        result = editor.renderE(node, path);
      } else if (type === 'text') {
        result = Doc.insertMultiplicationSign(node);
      } else {
        result = node.textContent;
      }
      return result;
    }

    const results = [];
    let count = 0;
    for (let n = node.firstChild; n != null; n = n.nextSibling) {
      results.push(this.getContent(type, render, editor, n, `${path}_${count++}`));
    }

    if (node.nodeName === 'l') {
      return results;
    } else if (node.nodeName === 'f') {
      const output = Symbols[node.getAttribute('type')].output[type].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
      for (let i = 0; i < output.length; i++) {
        const m = output[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
        if (!m) {
          result += output[i];
        } else if (m[2].length === 0) {
          result += results[parseInt(m[1])];
        } else {
          const mm = m[2].match(/\{[^}]*\}/g);
          const joiner = (d, l) => (d === 0 ? l : l.map(x => joiner(d - 1, x))
            .join(mm[d - 1].substring(1, mm[d - 1].length - 1)));
          result += joiner(mm.length, results[parseInt(m[1])]);
        }
      }
    } else {
      result = results.join('');
      if (type === 'latex') {
        if (Doc.getCAttribute(node, 'parentheses') && !Doc.isParenthesesOmittable(node, editor)) {
          result = `\\left(${result}\\right)`;
        } else if (node.nodeName === 'm' && render) {
          result = `\\displaystyle{${result}}`;
        }
      }
    }
    return result;
  }

  static insertMultiplicationSign(node) {
    let result = node.textContent;
    const prev = node.previousSibling && !Symbols[node.previousSibling.getAttribute('type')].op;
    const next = node.nextSibling && !Symbols[node.nextSibling.getAttribute('type')].op;
    if (result === '' && prev && next) {
      result = '*';
    } else if (!Doc.getCAttribute(node, 'text')) {
      result = result.replace(/([a-zA-Z])(?=\.)/g, '$1*')
        .replace(/(\.)(?=[a-zA-Z])/g, '$1*')
        .replace(/([a-zA-Z])(?=[a-zA-Z0-9])/g, '$1*')
        .replace(/([a-zA-Z0-9])(?=[a-zA-Z])/g, '$1*');
      if (prev) {
        result = result.replace(/^([a-zA-Z0-9])/g, '*$1');
      }
      if (next) {
        result = result.replace(/([a-zA-Z0-9])$/g, '$1*');
      }
    }
  }

  static isParenthesesOmittable(n, editor) {
    const value = n.firstChild.textContent;
    if (editor && (n === editor.mainCursor.node.parentNode || (editor.tempCursor.node &&
        n === editor.tempCursor.node.parentNode))) {
      return false;
    }
    if (n.childElementCount === 3 && value === '' && n.lastChild.textContent === '') {
      const name = n.childNodes[1].getAttribute('type');
      return Symbols[name].char || name === 'paren';
    }
    return n.childNodes.length === 1 && /^(?:.|\d*\.?\d+)$/.test(value) &&
      /(?:\D|^)$/.test(n.parentNode.previousSibling.textContent);
  }

  static getFName(node) {
    const n = node.nodeName === 'e' ? node.parentNode : node;
    if (n.parentNode.nodeName === 'f') {
      return n.parentNode.getAttribute('type');
    }
    return null;
  }

  static getCAttribute(node, attr, defaultValue) {
    const n = node.nodeName === 'e' ? node.parentNode : node;
    const name = Doc.getFName(n);
    if (name) {
      const index = Doc.indexOfNode(n);
      const args = Symbols[name].args;
      if (args && args[index] && args[index][attr] != null) {
        return args[index][attr];
      }
      return defaultValue;
    }
    return null;
  }

  static indexOfNode(node) {
    let n = node;
    let pos = 0;
    while ((n = n.previousSibling) != null) {
      pos++;
    }
    return pos;
  }

  static getPath(node) {
    return node.nodeName === 'm' ? 'loc' : `${Doc.getPath(node.parentNode)}_${Doc.indexOfNode(node)}`;
  }

  static getArrayIndex(node, twod) {
    let n = node;
    while (n.parentNode && !(n.nodeName === 'c' && n.parentNode.nodeName === 'l' &&
        (!twod || n.parentNode.parentNode.nodeName === 'l'))) {
      n = n.parentNode;
    }
    if (!n.parentNode) {
      return null;
    }

    const index = [];
    while (n.parentNode.nodeName === 'l') {
      index.push([n, Doc.indexOfNode(n)]);
      n = n.parentNode;
    }
    return index;
  }
}
