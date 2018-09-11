import EventEmitter from 'eventemitter3';
import Doc from './doc';
import Symbols from './symbols';
import Cursor from './cursor';

export default class Editor extends EventEmitter {
  static Clipboard = [];
  static DEFAULT_CONFIG = {
    autoreplace: true,
    blacklist: [],
    events: {},
    xmlContent: '<m><e></e></m>',
    caret: '\\cursor{-0.2ex}{0.7em}',
  };

  constructor(config) {
    super();

    this.config = Object.assign({}, Editor.DEFAULT_CONFIG, config);
    this.autoreplace = true;

    Object.entries(this.config.events).forEach(([event, handler]) => this.on(event, handler));

    this.mainCursor = new Cursor();
    this.selCursor = new Cursor();
    this.tempCursor = new Cursor();

    this.setContent(this.config.xmlContent);
  }

  get xml() {
    return this.doc.value;
  }

  getContent(type, render) {
    return this.doc.getContent(type, render, this);
  }

  get latex() {
    return this.getContent('latex');
  }

  get text() {
    return this.getContent('text');
  }

  setContent(data, cursorPos) {
    this.doc = new Doc(data);
    this.mainCursor.set(this.doc.root, cursorPos);
    this.clearSelection();
    this.undoData = [];
    this.redoData = [];
  }

  select(from, to) {
    this.mainCursor = to;
    this.selCursor = from;
    if (!from.equals(to)) {
      this.selStatus = from.directionTo(to);
    } else {
      this.clearSelection();
    }
  }

  moveSelection(dir) {
    if (!this.selStatus) {
      this.selStatus = dir;
      this.selCursor = this.mainCursor.clone();
    }
    if (dir < 0 && this.mainCursor.pos <= 0) {
      const prev = this.mainCursor.node.previousSibling;
      if (prev != null) {
        this.mainCursor.set(prev.previousSibling, true);
      }
    } else if (dir > 0 && this.mainCursor.pos >= this.mainCursor.value.length) {
      const next = this.mainCursor.node.nextSibling;
      if (next != null) {
        this.mainCursor.set(next.nextSibling);
      }
    } else {
      this.mainCursor.pos += dir;
    }
    if (this.selCursor.equals(this.mainCursor)) {
      this.clearSelection();
    }
  }

  selectAll() {
    this.select(new Cursor(this.doc.root), new Cursor(this.doc.root, true));
  }

  clearSelection() {
    this.selCursor.set(null);
    this.selStatus = 0;
  }

  getSelection() {
    if (!this.selStatus) {
      return null;
    }
    const [start, end] = this.selStatus < 0
      ? [this.mainCursor, this.selCursor] : [this.selCursor, this.mainCursor];
    const left = start.value;
    const right = end.value;

    const nodeList = [];
    const involved = [];
    const remnant = this.makeE(left.substring(0, start.pos) + right.substring(end.pos));

    if (start.node === end.node) {
      return {
        nodeList: [this.makeE(left.substring(start.pos, end.pos))],
        involved: [start.node],
        remnant,
      };
    }

    nodeList.push(this.makeE(left.substring(start.pos)));
    involved.push(start.node);
    for (let n = start.node.nextSibling; n !== end.node; n = n.nextSibling) {
      nodeList.push(n);
      involved.push(n);
    }
    nodeList.push(this.makeE(right.substring(0, end.pos)));
    involved.push(end.node);

    return {
      nodeList,
      involved,
      remnant,
    };
  }

  deleteSelection() {
    const sel = this.getSelection();
    if (!sel) {
      return null;
    }
    this.saveState();

    const selParent = sel.involved[0].parentNode;
    const selPrev = sel.involved[0].previousSibling;
    sel.involved.forEach(x => selParent.removeChild(x));
    if (selPrev == null) {
      if (selParent.firstChild == null) {
        selParent.appendChild(sel.remnant);
      } else {
        selParent.insertBefore(sel.remnant, selParent.firstChild);
      }
    } else if (selPrev.nextSibling == null) {
      selParent.appendChild(sel.remnant);
    } else {
      selParent.insertBefore(sel.remnant, selPrev.nextSibling);
    }
    this.mainCursor.set(sel.remnant, this.selStatus < 0 ? this.mainCursor.pos : this.selCursor.pos);
    this.clearSelection();
    return sel;
  }

  clipboardSelection(cut) {
    const sel = cut ? this.deleteSelection() : this.getSelection();
    if (!sel) {
      return;
    }
    Editor.Clipboard = sel.nodeList.map(x => x.cloneNode(true));
  }

  insertNodes(nodeList, moveCursor) {
    const clipboard = nodeList.map(x => x.cloneNode(true));
    const value = this.mainCursor.value;
    const first = clipboard.shift().textContent;
    if (clipboard.length === 0) {
      this.mainCursor.value = value.substring(0, this.mainCursor.pos) + first +
        value.substring(this.mainCursor.pos);
      if (moveCursor) {
        this.mainCursor.pos += first.length;
      }
    } else {
      const p = this.mainCursor.node.parentNode;
      const last = clipboard.pop().textContent;
      this.mainCursor.value = value.substring(0, this.mainCursor.pos) + first;

      const node = this.makeE(last + value.substring(this.mainCursor.pos));
      if (this.mainCursor.node.nextSibling == null) {
        p.appendChild(node);
      } else {
        p.insertBefore(node, this.mainCursor.node.nextSibling);
      }
      clipboard.forEach(x => p.insertBefore(x, node));
      if (moveCursor) {
        this.mainCursor.set(node, last.length);
      }
    }
  }

  paste() {
    if (Editor.Clipboard.length === 0) {
      return;
    }
    this.deleteSelection();
    this.insertNodes(Editor.Clipboard, true);
  }

  moveCursor(dir, out) {
    this.clearSelection();
    if (dir === 'up' || dir === 'down') {
      const t = Doc.getCAttribute(this.mainCursor.node, dir === 'up' ? 'below' : 'above');
      if (t != null) {
        this.mainCursor.set(this.mainCursor.node.parentNode.parentNode.childNodes[t], true);
      } else {
        const index = Doc.getArrayIndex(this.mainCursor.node, true);
        if (!index) {
          return;
        }
        const newRow = dir === 'down' ? index[1][0].nextSibling : index[1][0].previousSibling;
        if (newRow) {
          this.mainCursor.set(newRow.childNodes[index[0][1]], dir === 'up');
        }
      }
    } else if ((dir < 0 && this.mainCursor.pos <= 0) ||
        (dir > 0 && this.mainCursor.pos >= this.mainCursor.value.length)) {
      const nodes = this.doc.root.getElementsByTagName('e');
      const index = Array.prototype.indexOf.call(nodes, this.mainCursor.node);
      if ((dir < 0 && index > 0) || (dir > 0 && index < nodes.length - 1)) {
        this.mainCursor.set(nodes[index + dir], dir < 0);
      }
    } else if (!out) {
      this.mainCursor.pos += dir;
    }
  }

  home() {
    this.clearSelection();
    this.mainCursor.set(this.doc.root);
  }

  end() {
    this.clearSelection();
    this.mainCursor.set(this.doc.root, true);
  }

  pushState(stack) {
    this.candidates = null;

    this.mainCursor.node.setAttribute('current', this.mainCursor.pos.toString());
    stack.push(this.doc.base.cloneNode(true));
    this.mainCursor.node.removeAttribute('current');
  }

  popState(from, to) {
    this.clearSelection();
    if (from.length === 0) {
      return;
    }
    this.pushState(to);
    this.doc.base = from.pop().cloneNode(true);
    this.mainCursor.node = this.doc.root.querySelector('e[current]');
    this.mainCursor.pos = parseInt(this.mainCursor.node.getAttribute('current'));
    this.mainCursor.node.removeAttribute('current');
  }

  saveState() {
    this.pushState(this.undoData);
    this.redoData = [];
  }

  undo() {
    this.popState(this.undoData, this.redoData);
  }

  redo() {
    this.popState(this.redoData, this.undoData);
  }

  deleteF(node) {
    this.saveState();
    const p = node.parentNode;
    const prev = node.previousSibling;
    const next = node.nextSibling;
    const newNode = this.makeE(prev.textContent + next.textContent);
    p.insertBefore(newNode, prev);
    this.mainCursor.set(newNode, prev.textContent.length);
    p.removeChild(prev);
    p.removeChild(node);
    p.removeChild(next);
  }

  deleteBackward() {
    if (this.deleteSelection() != null) {
      return;
    }
    if (this.mainCursor.pos > 0) {
      this.saveState();
      const value = this.mainCursor.value;
      this.mainCursor.value = value.slice(0, this.mainCursor.pos - 1) +
        value.slice(this.mainCursor.pos);
      this.mainCursor.pos--;
    } else {
      const prev = this.mainCursor.node.previousSibling;
      const p = this.mainCursor.node.parentNode;
      const pp = p.parentNode;
      if (prev != null) {
        if (Symbols[prev.getAttribute('type')].char) {
          this.deleteF(prev);
        } else {
          this.moveCursor(-1);
        }
      } else if (p.nodeName === 'c') {
        if (Doc.getCAttribute(p, 'delete', true)) {
          const pos = Doc.indexOfNode(p);
          const index = Symbols[pp.getAttribute('type')].main || 0;
          const remaining = Array.from(pp.childNodes[index].childNodes);
          this.deleteF(pp);
          this.insertNodes(remaining, pos >= index + 1);
        } else {
          this.moveCursor(-1);
        }
      }
    }
  }

  deleteForward() {
    if (this.deleteSelection() != null) {
      return;
    }
    if (this.mainCursor.pos < this.mainCursor.value.length) {
      this.saveState();
      const value = this.mainCursor.value;
      this.mainCursor.value = value.slice(0, this.mainCursor.pos) +
        value.slice(this.mainCursor.pos + 1);
    } else if (this.mainCursor.node.nextSibling != null) {
      this.deleteF(this.mainCursor.node.nextSibling);
    }
  }

  extendList(dir, copy) {
    const vertical = dir === 'up' || dir === 'down';
    const before = dir === 'up' || dir === 'left';
    const index = Doc.getArrayIndex(this.mainCursor.node, vertical);
    if (!index) {
      return;
    }
    const [n, pos] = index[vertical ? 1 : 0];

    this.clearSelection();
    this.saveState();

    for (let nn = n.parentNode.parentNode.firstChild; nn != null; nn = nn.nextSibling) {
      if (nn.nodeName === 'l') {
        const node = nn.childNodes[pos];
        let newNode;
        if (!copy) {
          if (vertical) {
            newNode = this.doc.base.createElement('l');
            for (let i = 0; i < node.childNodes.length; i++) {
              const c = this.doc.base.createElement('c');
              c.appendChild(this.makeE());
              newNode.appendChild(c);
            }
          } else {
            newNode = this.doc.base.createElement('c');
            newNode.appendChild(this.makeE());
          }
        } else {
          newNode = node.cloneNode(true);
        }
        nn.insertBefore(newNode, before ? node : node.nextSibling);
      }
    }
    const cur = before ? n.previousSibling : n.nextSibling;
    this.mainCursor.set(vertical ? cur.childNodes[index[0][1]] : cur, before);
  }

  removeList(vertical) {
    const index = Doc.getArrayIndex(this.mainCursor.node, vertical);
    if (!index) {
      return;
    }
    const [n, pos] = index[vertical ? 1 : 0];
    const before = n.previousSibling != null;
    const cur = before ? n.previousSibling : n.nextSibling;
    if (cur == null) {
      return;
    }

    this.clearSelection();
    this.saveState();

    for (let nn = n.parentNode.parentNode.firstChild; nn != null; nn = nn.nextSibling) {
      if (nn.nodeName === 'l') {
        nn.removeChild(nn.childNodes[pos]);
      }
    }
    this.mainCursor.set(vertical ? cur.childNodes[index[0][1]] : cur, before);
  }

  renderE(n, path) {
    const text = n.textContent;
    let result = '';

    for (let i = 0; i < text.length + 1; i++) {
      const current = new Cursor(n, i);
      if (current.equals(this.mainCursor)) {
        if (this.selStatus > 0) {
          result += '}';
        }
        if (text.length === 0) {
          result += `\\class{main-cursor my-elem my-blank loc${path}-0}{${this.config.caret}}`;
        } else {
          result += `\\class{main-cursor}{${this.config.caret}}`;
        }
        if (this.selStatus < 0) {
          result += '\\class{selection}{';
        }
      } else if (current.equals(this.selCursor)) {
        if (this.selStatus < 0) {
          result += '}';
        }
        if (text.length === 0 && n.parentNode.childNodes.length > 1) {
          result += `\\class{sel-cursor my-elem my-blank loc${path}-0}{${this.config.caret}}`;
        } else {
          result += `\\class{sel-cursor}{${this.config.caret}}`;
        }
        if (this.selStatus > 0) {
          result += '\\class{selection}{';
        }
      } else if (current.equals(this.tempCursor)) {
        if (text.length > 0) {
          result += `\\class{temp-cursor}{${this.config.caret}}`;
        } else if (n.parentNode.childNodes.length === 1) {
          result += `\\class{temp-cursor my-elem my-blank loc${path}-0}{[?]}`;
        } else {
          result += `\\class{temp-cursor my-elem my-blank loc${path}-0}{${this.config.caret}}`;
        }
      } else if (text.length === 0) {
        if (n.parentNode.childNodes.length === 1) {
          result = `\\class{placeholder my-elem my-blank loc${path}-0}{[?]}`;
        } else {
          result = `\\phantom{\\class{my-elem my-blank loc${path}-0}{${this.config.caret}}}`;
        }
      }
      if (i < text.length) {
        result += `\\class{my-elem loc${path}-${i}}{${text[i]}}`;
      }
    }
    if (Doc.getCAttribute(n, 'text')) {
      if (n === this.mainCursor.node) {
        result = `\\class{my-text my-active}{{${result}}}`;
      } else {
        result = `\\class{my-text}{{${result}}}`;
      }
    }
    return result;
  }

  makeF(fname, content = []) {
    const base = this.doc.base;
    const f = base.createElement('f');
    f.setAttribute('type', fname);

    const regex = /{\$([0-9]+)((?:\{[^}]+})*)}/g;
    const output = Symbols[fname].output.latex;
    let m;
    while ((m = regex.exec(output)) !== null) {
      const index = parseInt(m[1]);
      const c = base.createElement('c');
      if (index in content) {
        content[index].forEach(x => c.appendChild(x.cloneNode(true)));
      } else {
        c.appendChild(this.makeE());
      }

      const count = m[2].split('}').length - 1;
      let par = f;
      for (let j = 0; j < count; j++) {
        const l = base.createElement('l');
        par.appendChild(l);
        par = l;
      }
      par.appendChild(c);
    }
    return f;
  }

  makeE(text = '') {
    const e = this.doc.base.createElement('e');
    e.appendChild(this.doc.base.createTextNode(text));
    return e;
  }

  insertString(s) {
    this.deleteSelection();

    //
    const prev = this.mainCursor.node.previousSibling;
    if (s === '=' && this.config.autoreplace && this.mainCursor.pos === 0 && prev &&
      prev.nodeName === 'f' && ['<', '>'].indexOf(prev.getAttribute('type')) > -1 &&
        this.replaceSymbol(prev, `${prev.getAttribute('type')}=`)) {
      return;
    }

    this.saveState();
    const value = this.mainCursor.value;
    this.mainCursor.value = value.slice(0, this.mainCursor.pos) + s +
      value.slice(this.mainCursor.pos);
    this.mainCursor.pos += s.length;
    if (this.config.autoreplace) {
      this.checkSymbol();
    }
  }

  replaceSymbol(node, fname, content) {
    const symbol = Symbols[fname];
    if (!symbol || this.config.blacklist.indexOf(fname) > -1) {
      return false;
    }

    this.saveState();
    const f = this.makeF(fname, content);
    node.parentNode.replaceChild(f, node);
    this.mainCursor.set(symbol.char ? f.nextSibling : f);
    return true;
  }

  checkSymbol(force) {
    if (Doc.getCAttribute(this.mainCursor.node, 'text')) {
      return;
    }
    if (force) {
      this.clearSelection();
    }
    const value = this.mainCursor.value;

    const par = this.mainCursor.node.parentNode;
    if (par.parentNode.nodeName === 'f' && par.childNodes.length === 1 && value === 'h') {
      const n = par.parentNode;
      this.replaceSymbol(n, `${n.getAttribute('type')}h`);
      return;
    }

    const symbol = Object.keys(Symbols).find(s =>
      value.substring(this.mainCursor.pos - s.length, this.mainCursor.pos) === s &&
      this.config.blacklist.indexOf(s) === -1 && (force || ['psi', 'xi'].indexOf(s) === -1));
    if (symbol) {
      this.saveState();
      this.mainCursor.value = value.slice(0, this.mainCursor.pos - symbol.length) +
        value.slice(this.mainCursor.pos);
      this.mainCursor.pos -= symbol.length;
      this.insertSymbol(symbol, true);
    }
  }

  insertSymbol(fname, silent) {
    if (Doc.getCAttribute(this.mainCursor.node, 'text') ||
        this.config.blacklist.indexOf(fname) > -1) {
      return;
    }
    const prev = this.mainCursor.node.previousSibling;
    const par = this.mainCursor.node.parentNode;
    const pp = par.parentNode;
    const value = this.mainCursor.value;

    if (fname === '*' && this.config.autoreplace && this.mainCursor.pos === 0 &&
        prev && prev.nodeName === 'f' && prev.getAttribute('type') === '*') {
      this.deleteF(prev);
      this.insertSymbol('pow', true);
      return;
    }
    if (fname === 'pow' && this.mainCursor.pos === 0 && pp.nodeName === 'f' &&
        pp.childNodes.length === 1) {
      this.mainCursor.node = pp.nextSibling;
      this.insertSymbol('pow');
      return;
    }
    if (!silent) {
      this.saveState();
    }

    const s = Symbols[fname];
    const main = s.main || 0;
    const content = {};
    let toRemove = [this.mainCursor.node];
    let left = value.slice(0, this.mainCursor.pos);
    let right = value.slice(this.mainCursor.pos);

    if (this.selStatus && !(s.args && s.args[main] && s.args[main].text)) {
      const selStartPos = this.selStatus < 0 ? this.mainCursor.pos : this.selCursor.pos;
      const sel = this.getSelection();

      toRemove = sel.involved;
      left = sel.remnant.textContent.slice(0, selStartPos);
      right = sel.remnant.textContent.slice(selStartPos);
      content[main] = sel.nodeList;
    } else if (s.token) {
      if (this.mainCursor.pos === 0 && prev != null) {
        toRemove = [prev];
        left = null;
        right = null;
        content[main] = [this.makeE(), prev, this.makeE()];
      } else {
        const token = value.substring(0, this.mainCursor.pos).match(/[0-9.]+$|[a-zA-Z]$/);
        if (token) {
          left = value.slice(0, this.mainCursor.pos - token[0].length);
          content[main] = [this.makeE(token[0])];
        }
      }
    }

    const f = this.makeF(fname, content);

    this.clearSelection();
    const next = toRemove[toRemove.length - 1].nextSibling;
    toRemove.forEach(x => par.removeChild(x));
    par.insertBefore(f, next);
    if (left != null) {
      par.insertBefore(this.makeE(left), f);
      par.insertBefore(this.makeE(right), next);
    }

    if (s.char) {
      this.mainCursor.set(f.nextSibling);
    } else {
      this.mainCursor.set(f);
    }
  }

  executeAction(action) {
    if (Array.isArray(action)) {
      this[action[0]](...action.slice(1));
    } else if (typeof action !== 'string') {
      const fname = Doc.getFName(this.mainCursor.node);
      if (fname in action) {
        this.executeAction(action[fname]);
      } else if ('*' in action) {
        this.executeAction(action['*']);
      }
    } else if (action in Editor.prototype) {
      this[action]();
    } else if (action in Symbols) {
      this.insertSymbol(action);
    } else {
      this.insertString(action);
    }
    this.render();
  }

  autocompleteSymbol() {
    if (this.candidates != null) {
      const suggestion = this.candidates.shift();
      this.candidates.push(suggestion);
      this.clearSelection();
      this.mainCursor.value = suggestion;
      this.mainCursor.pos = suggestion.length;
    } else {
      this.saveState();
      const value = this.mainCursor.value;
      this.candidates = Object.keys(Symbols).filter(n => n.substr(0, value.length) === value);
      if (this.candidates.length > 0) {
        this.autocompleteSymbol();
      } else {
        this.candidates = null;
      }
    }
  }

  replaceF(symbol, content = -1) {
    this.clearSelection();
    this.replaceSymbol(
      this.mainCursor.node.parentNode.parentNode,
      symbol,
      { [content]: [this.mainCursor.node] },
    );
  }

  completeSymbol() {
    this.replaceF(this.mainCursor.value);
  }
}
