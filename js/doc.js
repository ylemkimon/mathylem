import { DOMParser, XMLSerializer } from 'xmldom';
import { Symbols } from './symbols';

export default class Doc {
  constructor(data) {
    this.setContent(data);
  }

  getContent(type, render) {
    if (type === 'xml') {
      return (new XMLSerializer()).serializeToString(this.base);
    }
    return this.render(type, this.root, render);
  }

  setContent(data = '<m><e></e></m>') {
    this.base = (new DOMParser()).parseFromString(data, 'text/xml');
  }

  get root() {
    return this.base.documentElement;
  }

  render(type, node, render) {
    let result = '';
    if (node.nodeName === 'e') {
      if (type === 'latex' && render) {
        result = node.getAttribute('render');
      } else if (type === 'text') {
        result = node.textContent;
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
      } else {
        result = node.textContent;
      }
      return result;
    }

    const results = [];
    for (let n = node.firstChild; n != null; n = n.nextSibling) {
      results.push(this.render(type, n, render));
    }

    if (node.nodeName === 'l') {
      return results;
    } else if (node.nodeName === 'f') {
      const output = Symbols[node.getAttribute('type')].output;
      const out = ((type === 'latex' && Doc.isSmall(node) && output.small_latex) || output[type])
        .split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
      for (let i = 0; i < out.length; i++) {
        const m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
        if (!m) {
          result += out[i];
        } else if (m[2].length === 0) {
          result += results[parseInt(m[1]) - 1];
        } else {
          const mm = m[2].match(/\{[^}]*\}/g);
          const joiner = (d, l) => (d === 0 ? l : l.map(x => joiner(d - 1, x))
            .join(mm[d - 1].substring(1, mm[d - 1].length - 1)));
          result += joiner(mm.length, results[parseInt(m[1]) - 1]);
        }
      }
    } else {
      result = results.join('');
      if (type === 'latex' && node.hasAttribute('parentheses')) {
        result = `\\left(${result}\\right)`;
      }
    }
    return result;
  }

  static isSmall(node) {
    let n = node.parentNode;
    while (n != null && n.nodeName !== 'm') {
      if (Doc.getCAttribute(n, 'small')) {
        return true;
      }
      n = n.parentNode;
      while (n != null && n.nodeName !== 'c') {
        n = n.parentNode;
      }
    }
    return false;
  }

  static isParenthesesOmittable(n) {
    const value = n.firstChild.textContent;
    if (n.childElementCount === 3 &&
        value === '' && n.lastChild.textContent === '') {
      const name = n.childNodes[1].getAttribute('type');
      return Symbols[name].char || name === 'paren';
    }
    return n.childElementCount === 1 && (value.length === 1 ||
      !Number.isNaN(value - parseFloat(value)));
  }

  static getFName(node) {
    const n = node.nodeName === 'e' ? node.parentNode : node;
    if (n.parentNode.nodeName === 'f') {
      return n.parentNode.getAttribute('type');
    }
    return null;
  }

  static getCAttribute(node, attr) {
    const n = node.nodeName === 'e' ? node.parentNode : node;
    const name = Doc.getFName(n);
    if (name) {
      const index = Doc.indexOfNode(n);
      const attrs = Symbols[name].attrs;
      if (attrs && attrs[index] && attrs[index][attr]) {
        return attrs[index][attr];
      }
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
