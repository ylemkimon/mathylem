import { DOMParser, XMLSerializer } from 'xmldom';
import { Symbols } from './symbols';

export default class Doc {
  constructor (data) {
    this.setContent(data);
  }

  getContent (type, render) {
    if (type === 'xml') {
      return (new XMLSerializer()).serializeToString(this.base);
    } else {
      return this.render(type, this.root, render);
    }
  }

  setContent (data) {
    data = data || '<m><e></e></m>';
    this.base = (new DOMParser()).parseFromString(data, 'text/xml');
  }

  get root () {
    return this.base.documentElement;
  }

  render (type, node, render) {
    let result = '';
    if (node.nodeName === 'e') {
      if (type === 'latex' && render) {
        result = node.getAttribute('render');
      } else if (type === 'text') {
        result = node.textContent;

        const prev = node.previousSibling;
        const next = node.nextSibling;
        if (prev && next && result === '' && !Symbols[prev.getAttribute('type')]
          .operator && !Symbols[next.getAttribute('type')].operator) {
          result = '*';
        } else if (!Doc.getCAttribute(node, 'text')) {
          result = result.replace(/([a-zA-Z])(?=\.)/g, '$1*')
            .replace(/(\.)(?=[a-zA-Z])/g, '$1*')
            .replace(/([a-zA-Z])(?=[a-zA-Z0-9])/g, '$1*')
            .replace(/([a-zA-Z0-9])(?=[a-zA-Z])/g, '$1*');
          if (prev && !Symbols[prev.getAttribute('type')].operator) {
            result = result.replace(/^([a-zA-Z0-9])/g, '*$1');
          }
          if (next && !Symbols[next.getAttribute('type')].operator) {
            result = result.replace(/([a-zA-Z0-9])$/g, '$1*');
          }
        }
      } else {
        result = node.textContent;
      }
    } else if (node.nodeName === 'f') {
      let cs = [];
      for (let n = node.firstChild; n != null; n = n.nextSibling) {
        cs.push(this.render(type, n, render));
      }

      const output = Symbols[node.getAttribute('type')].output;
      if (type === 'latex' && Doc.isSmall(node) && 'small_latex' in output) {
        type = 'small_latex';
      }

      const out = output[type].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
      for (let i = 0; i < out.length; i++) {
        const m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
        if (!m) {
          result += out[i];
        } else {
          if (m[2].length === 0) {
            result += cs[parseInt(m[1]) - 1];
          } else {
            const mm = m[2].match(/\{[^}]*\}/g);
            const joiner = (d, l) => d === 0 ? l : l.map(x => joiner(d - 1, x))
              .join(mm[d - 1].substring(1, mm[d - 1].length - 1));
            result += joiner(mm.length, cs[parseInt(m[1]) - 1]);
          }
        }
      }
    } else if (node.nodeName === 'l') {
      result = [];
      for (let n = node.firstChild; n != null; n = n.nextSibling) {
        result.push(this.render(type, n, render));
      }
    } else if (node.nodeName === 'c' || node.nodeName === 'm') {
      for (let n = node.firstChild; n != null; n = n.nextSibling) {
        result += this.render(type, n, render);
      }

      if (type === 'latex' && Doc.getCAttribute(node, 'bracket')) {
        let bracket = true;
        const first = node.firstChild;
        const last = node.lastChild;
        if (node.childElementCount === 3 &&
            first.textContent === '' && last.textContent === '') {
          const name = first.nextSibling.getAttribute('type');
          if ((Symbols[name].char && !first.hasAttribute('temp') &&
              !first.hasAttribute('current') && !last.hasAttribute('temp') &&
              !last.hasAttribute('current')) || name === 'paren') {
            bracket = false;
          }
        } else if (node.childElementCount === 1) {
          const value = first.textContent;
          if ((value.length === 1 || !isNaN(value - parseFloat(value))) &&
              !first.hasAttribute('current') && !first.hasAttribute('temp')) {
            bracket = false;
          }
        }
        if (bracket) {
          result = '\\left(' + result + '\\right)';
        }
      }
    }
    return result;
  }

  static isSmall (node) {
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

  static getFName (node) {
    if (node.nodeName === 'e') {
      node = node.parentNode;
    }
    if (node.parentNode.nodeName === 'f') {
      return node.parentNode.getAttribute('type');
    }
  }

  static getCAttribute (node, attr) {
    if (node.nodeName === 'e') {
      node = node.parentNode;
    }
    const name = Doc.getFName(node);
    if (name) {
      let index = 0;
      while (node.previousSibling != null) {
        index++;
        node = node.previousSibling;
      }

      const attrs = Symbols[name].attrs;
      if (attrs && attrs[index] && attrs[index][attr]) {
        return attrs[index][attr];
      }
    }
  }
}
