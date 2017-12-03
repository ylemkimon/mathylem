import Doc from './doc';
import { Symbols } from './symbols';
import Cursor from './cursor';
import EventEmitter from 'eventemitter3';

export default class Editor extends EventEmitter {
  static Clipboard = [];

  constructor (config) {
    super()

    this.config = config;
    this.autoreplace = true;

    for (let e in config.events) {
      this.on(e, config.events[e]);
    }

    this.doc = new Doc();

    this.mainCursor = new Cursor();
    this.selCursor = new Cursor();
    this.tempCursor = new Cursor();

    this.setContent(config.xmlContent);
  };

  getContent (type, render) {
    this.prepareOutput(this.doc.root, render);
    const output = this.doc.getContent(type, render);
    this.postOutput(this.doc.root);
    return output;
  };

  get xml () {
    return this.doc.getContent('xml');
  };

  get latex () {
    return this.doc.getContent('latex');
  };

  get text () {
    return this.doc.getContent('text');
  };

  setContent (data, cursorPos) {
    this.doc.setContent(data);
    this.mainCursor.set(this.doc.root, cursorPos);
    this.clearSelection();
    this.undoData = [];
    this.redoData = [];
  };

  select (from, to) {
    this.mainCursor = to;
    this.selCursor = from;
    if (!from.equals(to)) {
      this.selStatus = from.directionTo(to);
    } else {
      this.clearSelection();
    }
  };

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

  selectAll () {
    this.select(new Cursor(this.doc.root), new Cursor(this.doc.root, true));
  };

  clearSelection () {
    this.selCursor.set(null);
    this.selStatus = 0;
  };

  getSelection () {
    if (!this.selStatus) {
      return null;
    }
    const [start, end] = this.selStatus < 0 ? [this.mainCursor, this.selCursor] : [this.selCursor, this.mainCursor];
    const left = start.value;
    const right = end.value;

    let nodeList = [];
    let involved = [];
    const remnant = this.makeE(left.substring(0, start.pos) + right.substring(end.pos));

    if (start.node === end.node) {
      return {
        nodeList: [this.makeE(left.substring(start.pos, end.pos))],
        involved: [start.node],
        remnant
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
      remnant
    };
  };

  deleteSelection () {
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
    } else {
      if (selPrev.nextSibling == null) {
        selParent.appendChild(sel.remnant);
      } else {
        selParent.insertBefore(sel.remnant, selPrev.nextSibling);
      }
    }
    this.mainCursor.set(sel.remnant, this.selStatus < 0 ? this.mainCursor.pos : this.selCursor.pos);
    this.clearSelection();
    return sel;
  };

  clipboardSelection (cut) {
    const sel = cut ? this.deleteSelection() : this.getSelection();
    if (!sel) {
      return;
    }
    Editor.Clipboard = sel.nodeList.map(x => x.cloneNode(true));
  };

  insertNodes (nodeList, moveCursor) {
    let clipboard = nodeList.map(x => x.cloneNode(true));
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
  };

  paste () {
    if (Editor.Clipboard.length === 0) {
      return;
    }
    this.deleteSelection();
    this.insertNodes(Editor.Clipboard, true);
  };

  moveCursor (dir, out) {
    this.clearSelection();
    if (dir === 'up' || dir === 'down') {
      const t = Doc.getCAttribute(this.mainCursor.node, dir);
      if (t) {
        this.mainCursor.set(this.mainCursor.node.parentNode.parentNode.childNodes[t - 1], true);
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
    } else {
      if ((dir < 0 && this.mainCursor.pos <= 0) ||
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
  }

  home () {
    this.clearSelection();
    this.mainCursor.set(this.doc.root);
  };

  end () {
    this.clearSelection();
    this.mainCursor.set(this.doc.root, true);
  };

  pushState (stack) {
    this.candidates = null;

    this.mainCursor.node.setAttribute('current', this.mainCursor.pos.toString());
    stack.push(this.doc.base.cloneNode(true));
    this.mainCursor.node.removeAttribute('current');
  }

  popState (from, to) {
    this.clearSelection();
    if (from.length == 0) {
      return;
    }
    this.pushState(to);
    this.doc.base = from.pop().cloneNode(true);
    this.mainCursor.node = this.doc.root.querySelector('e[current]');
    this.mainCursor.pos = parseInt(this.mainCursor.node.getAttribute('current'));
    this.mainCursor.node.removeAttribute('current');
  };

  saveState () {
    this.pushState(this.undoData);
    this.redoData = [];

    this.emit('change');
    this.render();
  };

  undo () {
    this.popState(this.undoData, this.redoData);
  };

  redo () {
    this.popState(this.redoData, this.undoData);
  };

  deleteFromC () {
    const pos = Doc.indexOfNode(this.mainCursor.node.parentNode);
    const index = Doc.getCAttribute(this.mainCursor.node, 'delete');
    const f = this.mainCursor.node.parentNode.parentNode;
    const remaining = Array.from(f.childNodes[index - 1].childNodes);
    this.deleteFromF(f);
    this.insertNodes(remaining, pos >= index);
  };

  deleteFromF (node) {
    const p = node.parentNode;
    const prev = node.previousSibling;
    const next = node.nextSibling;
    const newNode = this.makeE(prev.textContent + next.textContent);
    p.insertBefore(newNode, prev);
    this.mainCursor.set(newNode, prev.textContent.length);
    p.removeChild(prev);
    p.removeChild(node);
    p.removeChild(next);
  };

  deleteBackward () {
    if (this.deleteSelection() != null) {
      return;
    }
    if (this.mainCursor.pos > 0) {
      const value = this.mainCursor.value;
      this.mainCursor.value = value.slice(0, this.mainCursor.pos - 1) +
        value.slice(this.mainCursor.pos);
      this.mainCursor.pos--;
    } else {
      const prev = this.mainCursor.node.previousSibling;
      let p = this.mainCursor.node.parentNode;
      if (prev != null) { //  && prev.nodeName === 'f'
        if (Symbols[prev.getAttribute('type')].char) {
          this.deleteFromF(prev);
        } else {
          this.moveCursor(-1);
        }
      } else if (p.previousSibling != null) {
        if (Doc.getCAttribute(this.mainCursor.node, 'delete')) {
          this.deleteFromC();
        } else {
          this.moveCursor(-1);
        }
      } else if (prev == null && p.nodeName === 'c' && p.previousSibling == null) {
        while (p.parentNode.nodeName === 'l') { //  || p.parentNode.nodeName === 'c'
          p = p.parentNode;
        }
        if (Doc.getCAttribute(p, 'delete')) {
          this.deleteFromC();
        } else {
          this.deleteFromF(p.parentNode);
        }
      }
    }
  };

  deleteForward () {
    if (this.deleteSelection() != null) {
      return;
    }
    if (this.mainCursor.pos < this.mainCursor.value.length) {
      const value = this.mainCursor.value;
      this.mainCursor.value = value.slice(0, this.mainCursor.pos) +
        value.slice(this.mainCursor.pos + 1);
    } else if (this.mainCursor.node.nextSibling != null) {
      this.deleteFromF(this.mainCursor.node.nextSibling);
    }
  };

  extendList (dir, copy) {
    const vertical = dir === 'up' || dir === 'down';
    const before = dir === 'up' || dir === 'left';
    const index = Doc.getArrayIndex(this.mainCursor.node, vertical);
    if (!index) {
      return;
    }
    const [n, pos] = index[vertical ? 1 : 0];

    this.clearSelection();
    this.saveState();

    for (let nn = n.parentNode.parentNode.firstChild; nn != null; nn =
        nn.nextSibling) {
      if (nn.nodeName !== 'l') {
        continue;
      }
      const node = nn.childNodes[pos];
      let newNode;
      if (!copy) {
        if (vertical) {
          newNode = this.doc.base.createElement('l')
          for (let i = 0; i < node.childElementCount; i++) {
            const c = this.doc.base.createElement('c');
            c.appendChild(this.makeE());
            newNode.appendChild(c);
          }
        } else {
          newNode = this.doc.base.createElement('c')
          newNode.appendChild(this.makeE());
        }
      } else {
        newNode = node.cloneNode(true);
      }
      nn.insertBefore(newNode, before ? node : node.nextSibling);
    }
    const cur = before ? n.previousSibling : n.nextSibling;
    this.mainCursor.set(vertical ? cur.childNodes[index[0][1]] : cur, before);
  };

  removeList (vertical) {
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

    for (let nn = n.parentNode.parentNode.firstChild; nn != null; nn =
        nn.nextSibling) {
      if (nn.nodeName !== 'l') {
        continue;
      }
      nn.removeChild(nn.childNodes[pos]);
    }
    this.mainCursor.set(vertical ? cur.childNodes[index[0][1]] : cur, before);
  };

  renderE (n, path) {
    const text = n.textContent;
    let result = '';

    const caret = Doc.isSmall(n) ? '\\cursor{-0.05em}{0.5em}' :
      '\\cursor{-0.2ex}{0.7em}';
    for (let i = 0; i < text.length + 1; i++) {
      const current = new Cursor(n, i);
      if (current.equals(this.mainCursor)) {
        if (this.selStatus > 0) {
          result += '}';
        }
        if (text.length === 0) {
          result += `\\class{main-cursor my-elem my-blank loc${path}-0}{${caret}}`;
        } else {
          result += `\\class{main-cursor}{${caret}}`;
        }
        if (this.selStatus < 0) {
          result += '\\class{selection}{';
        }
      } else if (current.equals(this.selCursor)) {
        if (this.selStatus < 0) {
          result += '}';
        }
        if (text.length === 0 && n.parentNode.childElementCount > 1) {
          result += `\\class{sel-cursor my-elem my-blank loc${path}-0}{${caret}}`;
        } else {
          result += `\\class{sel-cursor}{${caret}}`;
        }
        if (this.selStatus > 0) {
          result += '\\class{selection}{';
        }
      } else if (current.equals(this.tempCursor)) {
        if (text.length > 0) {
          result += `\\class{temp-cursor}{${caret}}`;
        } else if (n.parentNode.childElementCount === 1) {
          result += `\\class{temp-cursor my-elem my-blank loc${path}-0}{[?]}`;
        } else {
          result += `\\class{temp-cursor my-elem my-blank loc${path}-0}{${caret}}`;
        }
      } else if (text.length === 0) {
        if (n.parentNode.childElementCount === 1) {
          result = `\\class{placeholder my-elem my-blank loc${path}-0}{[?]}`;
        } else {
          result = `\\phantom{\\class{my-elem my-blank loc${path}-0}{\\cursor{0.1ex}{1ex}}}`;
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

  prepareOutput = function (n, render, path='') {
    if (n.nodeName === 'e') {
      if (render) {
        n.setAttribute('render', this.renderE(n, path));
      }
    } else {
      if (n.nodeName === 'c' && Doc.getCAttribute(n, 'parentheses') && (n === this
          .mainCursor.node.parentNode || (this.tempCursor.node && n === this
          .tempCursor.node.parentNode) || !Doc.isParenthesesOmittable(n))) {
        n.setAttribute('parentheses', '');
      }

      let count = 0;
      for (let c = n.firstChild; c != null; c = c.nextSibling) {
        this.prepareOutput(c, render, path + '_' + count++);
      }
    }
  };

  postOutput (n) {
    if (n.nodeName === 'e') {
      n.removeAttribute('render');
    } else {
      if (n.nodeName === 'c') {
        n.removeAttribute('parentheses');
      }

      for (let c = n.firstChild; c != null; c = c.nextSibling) {
        this.postOutput(c);
      }
    }
  };

  makeF (name, content=[]) {
    const base = this.doc.base;
    const f = base.createElement('f');
    f.setAttribute('type', name);

    const regex = /{\$([0-9]+)((?:\{[^}]+})*)}/g;
    const output = Symbols[name].output.latex;
    let m;
    while ((m = regex.exec(output)) !== null) {
      const index = parseInt(m[1]) - 1;
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
  };

  makeE = function (text='') {
    const e = this.doc.base.createElement('e');
    e.appendChild(this.doc.base.createTextNode(text));
    return e;
  };

  insertString (s) {
    this.deleteSelection();

    //
    const prev = this.mainCursor.node.previousSibling;
    if (s === '=' && this.config.autoreplace && this.mainCursor.pos === 0 && prev && prev
        .nodeName === 'f' && ['<', '>'].indexOf(prev.getAttribute('type')) > -1 &&
        this.replaceSymbol(prev, prev.getAttribute('type') + '=')) {
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
  };

  replaceSymbol (node, name, content) {
    const symbol = Symbols[name];
    if (!symbol || this.config.blacklist.indexOf(name) > -1) {
      return false;
    }

    this.saveState();
    const f = this.makeF(name, content);
    node.parentNode.replaceChild(f, node);
    this.mainCursor.set(symbol.char ? f.nextSibling : f);
    return true;
  };

  checkSymbol (force) {
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
      this.replaceSymbol(n, n.getAttribute('type') + 'h');
      return;
    }

    for (const s in Symbols) {
      if ((!force && ['psi', 'xi'].indexOf(s) > -1) || this.config.blacklist.indexOf(s) > -1) {
        continue;
      }
      if (value.substring(this.mainCursor.pos - s.length, this.mainCursor.pos) === s) {
        this.saveState();
        this.mainCursor.value = value.slice(0, this.mainCursor.pos - s.length) +
          value.slice(this.mainCursor.pos);
        this.mainCursor.pos -= s.length;
        this.insertSymbol(s, true);
        return;
      }
    }
  };

  insertSymbol (name, silent) {
    if (Doc.getCAttribute(this.mainCursor.node, 'text') || this.config.blacklist.indexOf(name) > -1) {
      return;
    }
    if (!silent) {
      this.saveState();
    }
    const prev = this.mainCursor.node.previousSibling;
    const par = this.mainCursor.node.parentNode;
    const pp = par.parentNode;
    const value = this.mainCursor.value;

    if (name === '*' && this.config.autoreplace && this.mainCursor.pos === 0 && prev &&
        prev.nodeName === 'f' && prev.getAttribute('type') === '*') {
      this.deleteFromF(prev);
      this.insertSymbol('pow', true);
      return;
    }
    if (name === 'pow' && this.mainCursor.pos === 0 && pp.nodeName === 'f' &&
        pp.childNodes.length === 1) {
      this.mainCursor.node = pp.nextSibling;
      this.insertSymbol('pow', true);
      return;
    }

    const s = Symbols[name];
    let content = {};
    let leftPiece, rightPiece;
    let cur = s.current || 0;
    let toRemove = [];
    let toReplace = null;

    if (cur > 0) {
      cur--; //
      if (this.selStatus) {
        const selStartPos = this.selStatus < 0 ? this.mainCursor.pos : this.selCursor.pos;
        const sel = this.getSelection();
        this.clearSelection();

        toRemove = sel.involved;
        leftPiece = this.makeE(sel.remnant.textContent.slice(0, selStartPos));
        rightPiece = this.makeE(sel.remnant.textContent.slice(selStartPos));
        content[cur] = sel.nodeList;
      } else if (s.current_type === 'token') { //
        if (this.mainCursor.pos === 0 && prev != null) {
          toReplace = prev;
          content[cur] = [this.makeE(), prev, this.makeE()];
        } else {
          const token = value.substring(0, this.mainCursor.pos).match(/[0-9.]+$|[a-zA-Z]$/);
          if (token != null && token.length > 0) {
            toRemove = [this.mainCursor.node];
            leftPiece = this.makeE(value.slice(0, this.mainCursor.pos - token[0].length));
            rightPiece = this.makeE(value.slice(this.mainCursor.pos));
            content[cur] = [this.makeE(token[0])];
          }
        }
      }
    }
    if (toReplace == null && leftPiece == null) {
      toRemove = [this.mainCursor.node];
      leftPiece = this.makeE(value.slice(0, this.mainCursor.pos));
      rightPiece = this.makeE(value.slice(this.mainCursor.pos));
    }

    const f = this.makeF(name, content);

    if (toReplace != null) {
      par.replaceChild(f, toReplace);
    } else {
      const next = toRemove[toRemove.length - 1].nextSibling;
      toRemove.forEach(x => par.removeChild(x));

      par.insertBefore(leftPiece, next);
      par.insertBefore(f, next);
      par.insertBefore(rightPiece, next);
    }

    // XXX
    if (s.char || (s.current >= f.childElementCount)) {
      this.mainCursor.set(f.nextSibling);
    } else {
      this.mainCursor.set(f);
    }
  };

  executeAction (action) {
    if (Array.isArray(action)) {
      this[action[0]](...action.slice(1));
    } else if (typeof action !== 'string') {
      const name = Doc.getFName(this.mainCursor.node);
      if (name in action) {
        this.executeAction(action[name]);
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

  autocompleteSymbol () {
    if (this.candidates != null) {
      const suggestion = this.candidates.shift();
      this.candidates.push(suggestion);
      this.clearSelection();
      this.mainCursor.value = suggestion;
      this.mainCursor.pos = suggestion.length;
    } else {
      this.saveState();
      const value = this.mainCursor.value;
      this.candidates = Object.keys(MathYlem.Symbols).filter(n => n.substr(0, value.length) === value);
      if (this.candidates.length > 0) {
        this.autocompleteSymbol();
      } else {
        this.candidates = null;
      }
    }
  }
  
  replaceF (symbol, content=-1) {
    this.clearSelection();
    this.replaceSymbol(this.mainCursor.node.parentNode.parentNode, symbol,
      {[content]: [this.mainCursor.node]});
  }

  completeSymbol () {
    this.replaceF(this.mainCursor.value);
  }
}
