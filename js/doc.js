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
      if (type === 'latex' && Doc.isSmall(node) && 'small_latex' in output) {
        type = 'small_latex';
      }

      const out = output[type].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
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
    node = node.parentNode;
    while (node != null && node.nodeName !== 'm') {
      if (Doc.getCAttribute(node, 'small')) {
        return true;
      }
      node = node.parentNode;
      while (node != null && node.nodeName !== 'c') {
        node = node.parentNode;
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
    if (node.nodeName === 'e') {
      node = node.parentNode;
    }
    if (node.parentNode.nodeName === 'f') {
      return node.parentNode.getAttribute('type');
    }
    return null;
  }

  static getCAttribute(node, attr) {
    if (node.nodeName === 'e') {
      node = node.parentNode;
    }
    const name = Doc.getFName(node);
    if (name) {
      const index = Doc.indexOfNode(node);

      const attrs = Symbols[name].attrs;
      if (attrs && attrs[index] && attrs[index][attr]) {
        return attrs[index][attr];
      }
    }
    return null;
  }

  static indexOfNode(node) {
    let pos = 0;
    while ((node = node.previousSibling) != null) {
      pos++;
    }
    return pos;
  }

  static getPath(node) {
    return node.nodeName === 'm' ? 'loc' : `${Doc.getPath(node.parentNode)}_${Doc.indexOfNode(node)}`;
  }

  static getArrayIndex(node, twod) {
    while (node.parentNode && !(node.nodeName === 'c' && node.parentNode.nodeName === 'l' &&
        (!twod || node.parentNode.parentNode.nodeName === 'l'))) {
      node = node.parentNode;
    }
    if (!node.parentNode) {
      return null;
    }

    const index = [];
    while (node.parentNode.nodeName === 'l') {
      index.push([node, Doc.indexOfNode(node)]);
      node = node.parentNode;
    }
    return index;
  }
}
