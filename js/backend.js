var Doc = require('./doc.js');
import { Symbols } from './symbols';
var EventEmitter = require('eventemitter3');

var Backend = function (config, editor) {
  this.config = config;

  this.editor = editor;
  this.autoreplace = true;

  EventEmitter.call(this);
  for (var e in config.events) {
    this.on(e, config.events[e]);
  }

  this.doc = new Doc(config.xmlContent);

  this.current = this.doc.root().firstChild;
  this.caret = 0;
  this.clearSelection();
  this.undoData = [];
  this.undoCurrent = -1;
};

Backend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: Backend }
});

Backend.CARET = '\\cursor{-0.2ex}{0.7em}';
Backend.SMALL_CARET = '\\cursor{-0.05em}{0.5em}';

Backend.SEL_NONE = 0;
Backend.SEL_CURSOR_AT_START = 1;
Backend.SEL_CURSOR_AT_END = 2;

Backend.Clipboard = null;

Backend.prototype.getContent = function (t, r) {
  return this.doc.getContent(t, r);
};

Backend.prototype.xml = function () {
  return this.doc.getContent('xml');
};

Backend.prototype.latex = function () {
  return this.doc.getContent('latex');
};

Backend.prototype.text = function () {
  return this.doc.getContent('text');
};

Backend.prototype.setContent = function (xmlData) {
  this.doc = new Doc(xmlData);
  this.current = this.doc.root().lastChild;
  this.caret = this.current.textContent.length;
  this.clearSelection();
  this.undoData = [];
  this.undoCurrent = -1;
  this.checkpoint();
};

Backend.prototype.selectTo = function (loc, selCursor, selCaret, mouse) {
  this.current = loc.current;
  this.caret = loc.caret;
  if (loc.current === selCursor && loc.caret === selCaret) {
    this.clearSelection();
  } else if (loc.pos === 'left') {
    this.selEnd = {
      'node': selCursor,
      'caret': selCaret
    };
    this.setSelection(Backend.SEL_CURSOR_AT_START, mouse);
  } else if (loc.pos === 'right') {
    this.selStart = {
      'node': selCursor,
      'caret': selCaret
    };
    this.setSelection(Backend.SEL_CURSOR_AT_END, mouse);
  }
};

Backend.prototype.setSelStart = function () {
  this.selStart = { 'node': this.current, 'caret': this.caret };
};

Backend.prototype.setSelEnd = function () {
  this.selEnd = { 'node': this.current, 'caret': this.caret };
};

Backend.prototype.addPaths = function (n, path) {
  if (n.nodeName === 'e') {
    n.setAttribute('path', path);
  } else {
    var es = 1;
    var fs = 1;
    var cs = 1;
    var ls = 1;
    for (var c = n.firstChild; c != null; c = c.nextSibling) {
      if (c.nodeName === 'c') {
        this.addPaths(c, path + '_c' + cs);
        cs++;
      } else if (c.nodeName === 'f') {
        this.addPaths(c, path + '_f' + fs);
        fs++;
      } else if (c.nodeName === 'l') {
        this.addPaths(c, path + '_l' + ls);
        ls++;
      } else if (c.nodeName === 'e') {
        this.addPaths(c, path + '_e' + es);
        es++;
      }
    }
  }
};

Backend.prototype.addCursorClasses = function (n, path) {
  if (n.nodeName === 'e') {
    var text = n.textContent;
    var ans = '';
    var selCursor;
    if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
      selCursor = this.selEnd;
    } else if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
      selCursor = this.selStart;
    }

    var caret = Doc.isSmall(n) ? Backend.SMALL_CARET : Backend.CARET;
    for (var i = 0; i < text.length + 1; i++) {
      if (n === this.current && i === this.caret) {
        if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
          ans += '}';
        }
        if (text.length === 0) {
          ans += '\\xmlClass{main-cursor my-elem my-blank loc_' +
            n.getAttribute('path') + '_0}{' + caret + '}';
        } else {
          ans += '\\xmlClass{main-cursor}{' + caret + '}';
        }
        if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
          ans += '\\xmlClass{selection}{';
        }
      } else if (selCursor && n === selCursor.node && i === selCursor.caret) {
        if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
          ans += '}';
        }
        if (text.length === 0 && n.parentNode.childElementCount > 1) {
          ans += '\\xmlClass{sel-cursor my-elem my-blank loc_' +
            n.getAttribute('path') + '_0}{' + caret + '}';
        } else {
          ans += '\\xmlClass{sel-cursor}{' + caret + '}';
        }
        if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
          ans += '\\xmlClass{selection}{';
        }
      } else if (n === this.tempCursor.node && i === this.tempCursor.caret) {
        if (text.length === 0) {
          if (n.parentNode.childElementCount === 1) {
            ans += '\\xmlClass{temp-cursor my-elem my-blank loc_' +
              n.getAttribute('path') + '_0}{[?]}';
          } else {
            ans += '\\xmlClass{temp-cursor my-elem my-blank loc_' +
              n.getAttribute('path') + '_0}{' + caret + '}';
          }
        } else {
          ans += '\\xmlClass{temp-cursor}{' + caret + '}';
        }
      } else if (text.length === 0) {
        if (n.parentNode.childElementCount === 1) {
          ans = '\\xmlClass{placeholder my-elem my-blank loc_' +
            n.getAttribute('path') + '_0}{[?]}';
        } else {
          // Here, we add in a small element so that we can
          // use the mouse to select these areas
          ans = '\\phantom{\\xmlClass{my-elem my-blank loc_' +
            n.getAttribute('path') + '_0}{\\cursor{0.1ex}{1ex}}}';
        }
      }
      if (i < text.length) {
        ans += '\\xmlClass{my-elem loc_' + n.getAttribute('path') + '_' + i +
          '}{' + text[i] + '}';
      }
    }
    if (Doc.getCAttribute(n, 'text')) {
      if (n === this.current) {
        ans = '\\xmlClass{my-text my-active}{{' + ans + '}}';
      } else {
        ans = '\\xmlClass{my-text}{{' + ans + '}}';
      }
    }
    n.setAttribute('render', ans);
    n.removeAttribute('path');
  } else {
    for (var c = n.firstChild; c != null; c = c.nextSibling) {
      this.addCursorClasses(c);
    }
  }
};

Backend.prototype.removeCursorClasses = function (n) {
  if (n.nodeName === 'e') {
    n.removeAttribute('path');
    n.removeAttribute('render');
    n.removeAttribute('current');
    n.removeAttribute('temp');
  } else {
    for (var c = n.firstChild; c != null; c = c.nextSibling) {
      if (c.nodeType === 1) {
        this.removeCursorClasses(c);
      }
    }
  }
};

Backend.prototype.downFromF = function () {
  var nn = this.current.firstChild;
  while (nn.nodeName === 'l') {
    nn = nn.firstChild;
  }
  this.current = nn.firstChild;
};

Backend.prototype.downFromFToBlank = function () {
  var nn = this.current.firstChild;
  while (nn != null && !(nn.childNodes.length === 1 &&
      nn.firstChild.textContent.length === 0)) {
    nn = nn.nextSibling;
  }
  if (nn != null) {
    while (nn.nodeName === 'l') {
      nn = nn.firstChild;
    }
    this.current = nn.firstChild;
  } else {
    this.downFromF();
  }
};

Backend.prototype.deleteFromF = function (toInsert) {
  var n = this.current;
  var p = n.parentNode;
  var prev = n.previousSibling;
  var next = n.nextSibling;
  var middle = toInsert || '';
  var newNode = this.makeE(prev.textContent + middle + next.textContent);
  this.current = newNode;
  this.caret = prev.textContent.length;
  p.insertBefore(newNode, prev);
  p.removeChild(prev);
  p.removeChild(n);
  p.removeChild(next);
};

Backend.prototype.symbolToNode = function (name, content) {
  var base = this.doc.base;
  var s = Symbols[name];
  var f = base.createElement('f');
  f.setAttribute('type', name);

  var refsCount = 0;
  var lists = {};

  // Make the b nodes for rendering each output
  var out = s['output']['latex'].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
  for (var i = 0; i < out.length; i++) {
    var m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
    if (m) {
      if (m[2].length > 0) {
        lists[refsCount] = m[2].match(/\{[^}]*\}/g).length;
      }
      refsCount++;
    }
  }

  // Now make the c nodes for storing the content
  for (var i = 0; i < refsCount; i++) { // eslint-disable-line no-redeclare
    var nc = base.createElement('c');
    if (i in content) {
      var nodeList = content[i];
      for (var se = 0; se < nodeList.length; se++) {
        nc.appendChild(nodeList[se].cloneNode(true));
      }
    } else {
      nc.appendChild(this.makeE(''));
    }
    if (i in lists) {
      var par = f;
      for (var j = 0; j < lists[i]; j++) {
        var nl = base.createElement('l');
        par.appendChild(nl);
        par = nl;
        if (j === lists[i] - 1) {
          nl.appendChild(nc);
        }
      }
    } else {
      f.appendChild(nc);
    }
  }
  return f;
};

Backend.prototype.insertSymbol = function (name) {
  if (Doc.getCAttribute(this.current, 'text') || this.isBlacklisted(name)) {
    return false;
  }

  if (name === 'pow' && this.caret === 0 && this.current.parentNode.parentNode
    .nodeName === 'f' && this.current.parentNode.childNodes.length === 1) {
    this.current = this.current.parentNode.parentNode.nextSibling;
  }

  var s = Symbols[name];
  var content = {};
  var leftPiece, rightPiece;
  var cur = s['current'] == null ? 0 : parseInt(s['current']);
  var toRemove = [];
  var toReplace = null;
  var replace = false;

  if (cur > 0) {
    cur--;
    if (this.selStatus !== Backend.SEL_NONE) {
      var sel = this.getSelection();
      toRemove = sel.involved;
      leftPiece = this.makeE(sel.remnant.textContent.slice(0, this.selStart.caret));
      rightPiece = this.makeE(sel.remnant.textContent.slice(this.selStart.caret));
      content[cur] = sel.nodeList;
    } else if (s['current_type'] === 'token') {
      // If we're at the beginning, then the token is the previous f node
      if (this.caret === 0 && this.current.previousSibling != null) {
        content[cur] = [this.makeE(''), this.current.previousSibling,
          this.makeE('')];
        toReplace = this.current.previousSibling;
        replace = true;
      } else {
        // look for [0-9.]+|[a-zA-Z] immediately preceeding the caret and
        // use that as token
        var prev = this.current.textContent.substring(0, this.caret);
        var token = prev.match(/[0-9.]+$|[a-zA-Z]$/);
        if (token != null && token.length > 0) {
          token = token[0];
          leftPiece = this.makeE(this.current.textContent
            .slice(0, this.caret - token.length));
          rightPiece = this.makeE(this.current.textContent.slice(this.caret));
          content[cur] = [this.makeE(token)];
        }
      }
    }
  }
  if (!replace && (leftPiece == null || rightPiece == null)) {
    leftPiece = this.makeE(this.current.textContent.slice(0, this.caret));
    rightPiece = this.makeE(this.current.textContent.slice(this.caret));
    toRemove = [this.current];
  }

  // By now:
  // 
  // content contains whatever we want to pre-populate the 'current' field
  // with (if any)
  //
  // rightPiece contains whatever content was in an involved node
  // to the right of the cursor but is not part of the insertion.
  // Analogously for leftPiece
  //
  // Thus all we should have to do now is symbolToNode(sym_type,
  // content) and then add the leftPiece, resulting node, and
  // rightPiece in that order.
  var currentParent = this.current.parentNode;

  var f = this.symbolToNode(name, content);

  var next = this.current.nextSibling;

  if (replace) {
    currentParent.replaceChild(f, toReplace);
  } else {
    if (toRemove.length === 0) {
      this.current.parentNode.removeChild(this.current);
    }

    for (var i = 0; i < toRemove.length; i++) {
      if (next === toRemove[i]) {
        next = next.nextSibling;
      }
      currentParent.removeChild(toRemove[i]);
    }
    currentParent.insertBefore(leftPiece, next);
    currentParent.insertBefore(f, next);
    currentParent.insertBefore(rightPiece, next);
  }

  this.caret = 0;
  this.current = f;
  if (s['char']) {
    this.current = this.current.nextSibling;
  } else {
    this.downFromFToBlank();
  }

  this.clearSelection();
  this.checkpoint();
  return true;
};

Backend.prototype.getSelection = function () {
  if (this.selStatus === Backend.SEL_NONE) {
    return null;
  }
  var involved = [];
  var nodeList = [];
  var remnant = null;

  if (this.selStart.node === this.selEnd.node) {
    return {
      'nodeList': [this.makeE(this.selStart.node.textContent
        .substring(this.selStart.caret, this.selEnd.caret))],
      'remnant': this.makeE(this.selStart.node.textContent
        .substring(0, this.selStart.caret) + this.selEnd.node.textContent
          .substring(this.selEnd.caret)),
      'involved': [this.selStart.node]
    };
  }

  nodeList.push(this.makeE(this.selStart.node.textContent
    .substring(this.selStart.caret)));
  involved.push(this.selStart.node);
  involved.push(this.selEnd.node);
  remnant = this.makeE(this.selStart.node.textContent.substring(0, this.selStart
    .caret) + this.selEnd.node.textContent.substring(this.selEnd.caret));
  var n = this.selStart.node.nextSibling;
  while (n != null && n !== this.selEnd.node) {
    involved.push(n);
    nodeList.push(n);
    n = n.nextSibling;
  }
  nodeList.push(this.makeE(this.selEnd.node.textContent
    .substring(0, this.selEnd.caret)));
  return { 'nodeList': nodeList,
    'remnant': remnant,
    'involved': involved,
    'cursor': 0 };
};

Backend.prototype.makeE = function (text) {
  var base = this.doc.base;
  var newNode = base.createElement('e');
  newNode.appendChild(base.createTextNode(text));
  return newNode;
};

Backend.prototype.insertString = function (s) {
  if (this.selStatus !== Backend.SEL_NONE) {
    this.deleteSelection();
  }
  if ((s === '*' && this.checkForPow()) || (s === '=' && this.checkForIneq())) {
    return;
  }
  var value = this.current.textContent;
  this.current.textContent = value.slice(0, this.caret) + s +
    value.slice(this.caret);
  this.caret += s.length;
  this.checkpoint();
  if (this.config.autoreplace) {
    this.checkForSymbol();
  }
};

Backend.prototype.copySelection = function () {
  var sel = this.getSelection();
  if (!sel) {
    return;
  }
  Backend.Clipboard = [];
  for (var i = 0; i < sel.nodeList.length; i++) {
    Backend.Clipboard.push(sel.nodeList[i].cloneNode(true));
  }
  this.clearSelection();
};

Backend.prototype.cutSelection = function () {
  var nodeList = this.deleteSelection();
  if (!nodeList) {
    return;
  }
  Backend.Clipboard = [];
  for (var i = 0; i < nodeList.length; i++) {
    Backend.Clipboard.push(nodeList[i].cloneNode(true));
  }
  this.checkpoint();
};

Backend.prototype.insertNodes = function (nodeList, moveCursor) {
  var clipboard = [];
  for (var i = 0; i < nodeList.length; i++) {
    clipboard.push(nodeList[i].cloneNode(true));
  }

  if (clipboard.length === 1) {
    if (clipboard[0].firstChild) {
      this.current.textContent = this.current.textContent.substring(0, this.caret) +
        clipboard[0].textContent + this.current.textContent.substring(this.caret);
      if (moveCursor) {
        this.caret += clipboard[0].textContent.length;
      }
    }
  } else {
    var nn = this.makeE(clipboard[clipboard.length - 1].textContent +
      this.current.textContent.substring(this.caret));
    this.current.textContent = this.current.textContent.substring(0, this.caret) +
      clipboard[0].textContent;
    if (this.current.nextSibling == null) {
      this.current.parentNode.appendChild(nn);
    } else {
      this.current.parentNode.insertBefore(nn, this.current.nextSibling);
    }
    for (var i = 1; i < clipboard.length - 1; i++) { // eslint-disable-line no-redeclare
      this.current.parentNode.insertBefore(clipboard[i], nn);
    }
    if (moveCursor) {
      this.current = nn;
      this.caret = clipboard[clipboard.length - 1].textContent.length;
    }
  }
};

Backend.prototype.paste = function () {
  this.deleteSelection();
  if (!Backend.Clipboard || Backend.Clipboard.length === 0) {
    return;
  }
  this.insertNodes(Backend.Clipboard, true);
  this.checkpoint();
};

Backend.prototype.clearSelection = function () {
  this.selStart = null;
  this.selEnd = null;
  this.selStatus = Backend.SEL_NONE;
};

Backend.prototype.deleteSelection = function () {
  var sel = this.getSelection();
  if (!sel) {
    return null;
  }
  var selParent = sel.involved[0].parentNode;
  var selPrev = sel.involved[0].previousSibling;
  for (var i = 0; i < sel.involved.length; i++) {
    var n = sel.involved[i];
    selParent.removeChild(n);
  }
  if (selPrev == null) {
    if (selParent.firstChild == null) {
      selParent.appendChild(sel.remnant);
    } else {
      selParent.insertBefore(sel.remnant, selParent.firstChild);
    }
  } else if (selPrev.nodeName === 'f') {
    if (selPrev.nextSibling == null) {
      selParent.appendChild(sel.remnant);
    } else {
      selParent.insertBefore(sel.remnant, selPrev.nextSibling);
    }
  }
  this.current = sel.remnant;
  this.caret = this.selStart.caret;
  this.clearSelection();
  return sel.nodeList;
};

Backend.prototype.selectAll = function () {
  this.home(true);
  this.setSelStart();
  this.end(true);
  this.setSelEnd();
  if (this.selStart.node !== this.selEnd.node ||
      this.selStart.caret !== this.selEnd.caret) {
    this.selStatus = Backend.SEL_CURSOR_AT_END;
  }
};

Backend.prototype.selectRight = function () {
  if (this.selStatus === Backend.SEL_NONE) {
    this.setSelStart();
    this.selStatus = Backend.SEL_CURSOR_AT_END;
  }
  if (this.caret >= this.current.textContent.length) {
    var nn = this.current.nextSibling;
    if (nn != null) {
      this.current = nn.nextSibling;
      this.caret = 0;
      this.setSelection(Backend.SEL_CURSOR_AT_END);
    } else {
      this.setSelection(Backend.SEL_CURSOR_AT_END);
    }
  } else {
    this.caret += 1;
    this.setSelection(Backend.SEL_CURSOR_AT_END);
  }
  if (this.selStart.node === this.selEnd.node &&
      this.selStart.caret === this.selEnd.caret) {
    this.clearSelection();
  }
};

Backend.prototype.setSelection = function (sstatus, mouse) {
  if (this.selStatus === Backend.SEL_NONE || mouse) {
    this.selStatus = sstatus;
  }
  if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
    this.setSelStart();
  } else if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
    this.setSelEnd();
  }
};

Backend.prototype.selectLeft = function () {
  if (this.selStatus === Backend.SEL_NONE) {
    this.setSelEnd();
    this.selStatus = Backend.SEL_CURSOR_AT_START;
  }
  if (this.caret <= 0) {
    var nn = this.current.previousSibling;
    if (nn != null) {
      this.current = nn.previousSibling;
      this.caret = this.current.textContent.length;
      this.setSelection(Backend.SEL_CURSOR_AT_START);
    } else {
      this.setSelection(Backend.SEL_CURSOR_AT_START);
    }
  } else {
    this.caret -= 1;
    this.setSelection(Backend.SEL_CURSOR_AT_START);
  }
  if (this.selStart.node === this.selEnd.node &&
      this.selStart.caret === this.selEnd.caret) {
    this.clearSelection();
  }
};

Backend.prototype.copyExtendListRight = function () {
  this.extendList('right', true);
};
Backend.prototype.copyExtendListLeft = function () {
  this.extendList('left', true);
};
Backend.prototype.extendListRight = function () {
  this.extendList('right', false);
};
Backend.prototype.extendListLeft = function () {
  this.extendList('left', false);
};
Backend.prototype.extendListUp = function () {
  this.extendList('up', false);
};
Backend.prototype.extendListDown = function () {
  this.extendList('down', false);
};
Backend.prototype.copyExtendListUp = function () {
  this.extendList('up', true);
};
Backend.prototype.copyExtendListDown = function () {
  this.extendList('down', true);
};

Backend.prototype.moveVerticalList = function (down) {
  var n = this.current;
  while (n.parentNode && n.parentNode.parentNode && !(n.nodeName === 'c' &&
      n.parentNode.nodeName === 'l' && n.parentNode.parentNode.nodeName === 'l')) {
    n = n.parentNode;
  }
  if (!n.parentNode) {
    return;
  }
  var pos = 1;
  var cc = n;
  while (cc.previousSibling != null) {
    pos++;
    cc = cc.previousSibling;
  }
  var newRow = down ? n.parentNode.nextSibling : n.parentNode.previousSibling;
  if (!newRow) {
    return;
  }
  var idx = 1;
  var nn = newRow.firstChild;
  while (idx < pos) {
    idx++;
    nn = nn.nextSibling;
  }
  this.current = nn.firstChild;
  this.caret = down ? 0 : this.current.textContent.length;
};

Backend.prototype.extendList = function (direction, copy) {
  var base = this.doc.base;
  var vertical = direction === 'up' || direction === 'down';
  var before = direction === 'up' || direction === 'left';
  var name = vertical ? 'l' : 'c';
  var n = this.current;
  while (n.parentNode && !(n.nodeName === name && n.parentNode.nodeName === 'l')) {
    n = n.parentNode;
  }
  if (!n.parentNode) {
    return;
  }
  this.clearSelection();
  var toInsert;

  // check if 2D and horizontal and extend all the other rows if so 
  if (!vertical && n.parentNode.parentNode.nodeName === 'l') {
    toInsert = base.createElement('c');
    toInsert.appendChild(this.makeE(''));
    var pos = 0;
    var cc = n;
    while (cc.previousSibling != null) {
      pos++;
      cc = cc.previousSibling;
    }
    var toModify = [];
    for (var nn = n.parentNode.parentNode.firstChild; nn != null; nn =
        nn.nextSibling) {
      toModify.push(nn.childNodes[pos]);
    }
    for (var j = 0; j < toModify.length; j++) {
      var node = toModify[j];
      if (copy) {
        node.parentNode.insertBefore(node.cloneNode(true),
          before ? node : node.nextSibling);
      } else {
        node.parentNode.insertBefore(toInsert.cloneNode(true),
          before ? node : node.nextSibling);
      }
    }
    this.current = before ? n.previousSibling.lastChild : n.nextSibling.firstChild;
    this.caret = this.current.textContent.length;
    this.checkpoint();
    return;
  }

  if (copy) {
    toInsert = n.cloneNode(true);
  } else {
    if (vertical) {
      toInsert = base.createElement('l');
      for (var i = 0; i < n.childElementCount; i++) {
        var c = base.createElement('c');
        c.appendChild(this.makeE(''));
        toInsert.appendChild(c);
      }
    } else {
      toInsert = base.createElement('c');
      toInsert.appendChild(this.makeE(''));
    }
  }
  n.parentNode.insertBefore(toInsert, before ? n : n.nextSibling);
  if (vertical) {
    this.current = toInsert.firstChild.firstChild;
  } else {
    this.current = toInsert.firstChild;
  }
  this.caret = 0;
  this.checkpoint();
};

Backend.prototype.removeListColumn = function () {
  var n = this.current;
  while (n.parentNode && n.parentNode.parentNode && !(n.nodeName === 'c' &&
      n.parentNode.nodeName === 'l' && n.parentNode.parentNode.nodeName === 'l')) {
    n = n.parentNode;
  }
  if (!n.parentNode) {
    return;
  }

  // Don't remove if there is only a single column:
  if (n.previousSibling != null) {
    this.current = n.previousSibling.lastChild;
    this.caret = this.current.textContent.length;
  } else if (n.nextSibling != null) {
    this.current = n.nextSibling.firstChild;
    this.caret = 0;
  } else {
    return;
  }
  this.clearSelection();

  var pos = 0;
  var cc = n;

  // Find position of column
  while (cc.previousSibling != null) {
    pos++;
    cc = cc.previousSibling;
  }
  var toModify = [];
  for (var nn = n.parentNode.parentNode.firstChild; nn != null; nn =
      nn.nextSibling) {
    toModify.push(nn.childNodes[pos]);
  }
  for (var j = 0; j < toModify.length; j++) {
    var node = toModify[j];
    node.parentNode.removeChild(node);
  }
};

Backend.prototype.removeListRow = function () {
  var n = this.current;
  while (n.parentNode && !(n.nodeName === 'l' && n.parentNode.nodeName === 'l')) {
    n = n.parentNode;
  }
  if (!n.parentNode) {
    return;
  }
  // Don't remove if there is only a single row:
  if (n.previousSibling != null) {
    this.current = n.previousSibling.lastChild.lastChild;
    this.caret = this.current.textContent.length;
  } else if (n.nextSibling != null) {
    this.current = n.nextSibling.firstChild.firstChild;
    this.caret = 0;
  } else {
    return;
  }
  this.clearSelection();
  n.parentNode.removeChild(n);
};

Backend.prototype.removeListItem = function () {
  var n = this.current;
  while (n.parentNode && !(n.nodeName === 'c' && n.parentNode.nodeName === 'l')) {
    n = n.parentNode;
  }
  if (!n.parentNode) {
    return;
  }
  if (n.parentNode.parentNode && n.parentNode.parentNode.nodeName === 'l') {
    this.removeListColumn();
    return;
  }
  if (n.previousSibling != null) {
    this.current = n.previousSibling.lastChild;
    this.caret = this.current.textContent.length;
  } else if (n.nextSibling != null) {
    this.current = n.nextSibling.firstChild;
    this.caret = 0;
  } else {
    return;
  }
  this.clearSelection();
  n.parentNode.removeChild(n);
};

Backend.prototype.right = function () {
  this.clearSelection();
  if (this.caret >= this.current.textContent.length) {
    var nodes = this.doc.root().getElementsByTagName('e');
    var index = Array.prototype.indexOf.call(nodes, this.current);
    if (index < nodes.length - 1) {
      this.current = nodes[index + 1];
      this.caret = 0;
    }
  } else {
    this.caret += 1;
  }
};

Backend.prototype.spacebar = function () {
  var type = Doc.getFName(this.current);
  if (type === 'text') {
    this.insertString(' ');
  } else if (type !== 'symbol') {
    this.clearSelection();
    this.checkForSymbol(true);
  } else if (this.candidates != null) {
    var suggestion = this.candidates.shift();
    this.candidates.push(suggestion);
    this.clearSelection();
    this.current.textContent = suggestion;
    this.caret = suggestion.length;
  } else {
    this.checkpoint();
    var name = this.current.textContent;
    this.candidates = [];
    for (var n in Symbols) {
      if (n.substr(0, name.length) === name) {
        this.candidates.push(n);
      }
    }
    if (this.candidates.length > 0) {
      this.tab();
    } else {
      this.candidates = null;
    }
  }
};

Backend.prototype.left = function () {
  this.clearSelection();
  if (this.caret <= 0) {
    var nodes = this.doc.root().getElementsByTagName('e');
    var index = Array.prototype.indexOf.call(nodes, this.current);
    if (index > 0) {
      this.current = nodes[index - 1];
      this.caret = this.current.textContent.length;
    }
  } else {
    this.caret -= 1;
  }
};

Backend.prototype.deleteFromC = function () {
  var pos = 0;
  var c = this.current.parentNode;
  while ((c = c.previousSibling) != null) {
    pos++;
  }
  var idx = Doc.getCAttribute(this.current, 'delete');
  var node = this.current.parentNode.parentNode.childNodes[pos];
  var remaining = [];
  for (var n = node.firstChild; n != null; n = n.nextSibling) {
    remaining.push(n);
  }
  this.current = this.current.parentNode.parentNode;
  this.deleteFromF();
  this.insertNodes(remaining, pos > idx);
};

Backend.prototype.deleteFromE = function () {
  // return false if we deleted something, and true otherwise.
  if (this.caret > 0) {
    var value = this.current.textContent;
    this.current.textContent = value.slice(0, this.caret - 1) +
      value.slice(this.caret);
    this.caret--;
  } else {
    // The order of these is important
    var prev = this.current.previousSibling;
    var par = this.current.parentNode;
    if (prev != null && prev.nodeName === 'f') {
      // We're in an e node just after an f node. 
      // Move back into the f node (delete it?)
      if (Symbols[prev.getAttribute('type')]['char']) {
        // The previous node is an f node but is really just a character. Delete it.
        this.current = prev;
        this.deleteFromF();
        return true;
      }
      this.left();
      return false;
    } else if (par.previousSibling != null) {
      // We're in a c child of an f node, but not the first one.
      // Go to the previous c
      if (Doc.getCAttribute(this.current, 'delete')) {
        this.deleteFromC();
      } else {
        this.left();
        return false;
      }
    } else if (prev == null && par.nodeName === 'c' &&
        par.previousSibling == null) {
      // We're in the first c child of an f node and at the beginning
      // delete the f node
      while (par.parentNode.nodeName === 'l' || par.parentNode.nodeName === 'c') {
        par = par.parentNode;
      }
      if (Doc.getCAttribute(par, 'delete')) {
        this.deleteFromC();
      } else {
        this.current = par.parentNode;
        this.deleteFromF();
      }
    } else {
      // We're at the beginning (hopefully!) 
      return false;
    }
  }
  return true;
};

Backend.prototype.deleteForwardFromE = function () {
  // return false if we deleted something, and true otherwise.
  if (this.caret < this.current.textContent.length) {
    var value = this.current.textContent;
    this.current.textContent = value.slice(0, this.caret) +
      value.slice(this.caret + 1);
  } else {
    // We're at the end
    if (this.current.nextSibling != null) {
      // The next node is an f node.  Delete it.
      this.current = this.current.nextSibling;
      this.deleteFromF();
    } else if (this.current.parentNode.nodeName === 'c') {
      // We're in a c child of an f node.  Do nothing
      return false;
    }
  }
  return true;
};

Backend.prototype.backspace = function () {
  if (this.selStatus !== Backend.SEL_NONE) {
    this.deleteSelection();
    this.checkpoint();
  } else if (this.deleteFromE()) {
    this.checkpoint();
  }
};

Backend.prototype.deleteKey = function () {
  if (this.selStatus !== Backend.SEL_NONE) {
    this.deleteSelection();
    this.checkpoint();
  } else if (this.deleteForwardFromE()) {
    this.checkpoint();
  }
};

Backend.prototype.leftParen = function () {
  if (Doc.getFName(this.current) === 'symbol') {
    this.clearSelection();
    this.replaceSymbol(this.current.parentNode.parentNode, 'func',
      [[this.current]]);
  } else {
    this.insertSymbol('paren');
  }
};

Backend.prototype.rightParen = function () {
  if (this.current.nodeName !== 'e' ||
      this.caret === this.current.textContent.length) {
    this.right();
  }
};

Backend.prototype.up = function () {
  this.clearSelection();
  var t = Doc.getCAttribute(this.current, 'up');
  if (t) {
    var f = this.current.parentNode.parentNode;
    var n = f.firstChild;
    for (var i = 0; i < t - 1; i++) {
      n = n.nextSibling;
    }
    this.current = n.lastChild;
    this.caret = this.current.textContent.length;
  } else {
    this.moveVerticalList(false);
  }
};

Backend.prototype.down = function () {
  this.clearSelection();
  var t = Doc.getCAttribute(this.current, 'down');
  if (t) {
    var f = this.current.parentNode.parentNode;
    var n = f.firstChild;
    for (var i = 0; i < t - 1; i++) {
      n = n.nextSibling;
    }
    this.current = n.lastChild;
    this.caret = this.current.textContent.length;
  } else {
    this.moveVerticalList(true);
  }
};

Backend.prototype.home = function (select) {
  if (!select) {
    this.clearSelection();
  }
  this.current = this.doc.root().firstChild;
  this.caret = 0;
};

Backend.prototype.end = function (select) {
  if (!select) {
    this.clearSelection();
  }
  this.current = this.doc.root().lastChild;
  this.caret = this.current.textContent.length;
};

Backend.prototype.checkpoint = function () {
  var base = this.doc.base;
  this.current.setAttribute('current', '');
  this.current.setAttribute('caret', this.caret.toString());
  this.undoCurrent++;
  this.undoData[this.undoCurrent] = base.cloneNode(true);
  this.undoData.splice(this.undoCurrent + 1, this.undoData.length);
  this.emit('change', { 'old': this.undoData[this.undoCurrent - 1],
    'new': this.undoData[this.undoCurrent] });
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
  this.candidates = null;
  if (this.editor) {
    this.editor.render();
  }
};

Backend.prototype.restore = function (t) {
  this.doc.base = this.undoData[t].cloneNode(true);
  this.findCurrent();
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
};

Backend.prototype.findCurrent = function () {
  this.current = this.doc.root().querySelector('e[current]');
  this.caret = parseInt(this.current.getAttribute('caret'));
};

Backend.prototype.undo = function () {
  this.clearSelection();
  if (this.undoCurrent <= 0) {
    return;
  }
  this.undoCurrent--;
  this.restore(this.undoCurrent);
};

Backend.prototype.redo = function () {
  this.clearSelection();
  if (this.undoCurrent >= this.undoData.length - 1) {
    return;
  }
  this.undoCurrent++;
  this.restore(this.undoCurrent);
};

Backend.prototype.done = function (s) {
  if (Doc.getFName(this.current) === 'symbol') {
    this.completeSymbol();
  } else {
    this.emit('done');
  }
};

Backend.prototype.completeSymbol = function () {
  var name = this.current.textContent;
  if (!Symbols[name]) {
    return;
  }
  this.current = this.current.parentNode.parentNode;
  this.clearSelection();
  this.deleteFromF();
  this.insertSymbol(name);
};

Backend.prototype.isBlacklisted = function (type) {
  for (var i = 0; i < this.config.blacklist.length; i++) {
    if (type === this.config.blacklist[i]) {
      return true;
    }
  }
  return false;
};

Backend.prototype.replaceSymbol = function (node, name, content) {
  var symbol = Symbols[name];
  if (!symbol || this.isBlacklisted(name)) {
    return false;
  }
  var f = this.symbolToNode(name, content || []);
  node.parentNode.replaceChild(f, node);
  if (!symbol['char']) {
    this.caret = 0;
    this.current = f;
    this.downFromFToBlank();
  }
  this.checkpoint();
  return true;
};

Backend.prototype.checkForPow = function () {
  if (this.config.autoreplace && this.caret === 0 && this.current
    .previousSibling && this.current.previousSibling.nodeName === 'f' &&
      this.current.previousSibling.getAttribute('type') === '*') {
    this.current = this.current.previousSibling;
    this.deleteFromF();
    this.insertSymbol('pow');
    return true;
  }
  return false;
};

Backend.prototype.checkForIneq = function () {
  if (this.config.autoreplace && this.caret === 0 && this.current
    .previousSibling && this.current.previousSibling.nodeName === 'f' &&
      ['<', '>'].indexOf(this.current.previousSibling.getAttribute('type')) > -1) {
    var n = this.current.previousSibling;
    return this.replaceSymbol(n, n.getAttribute('type') + '=');
  }
  return false;
};

Backend.prototype.checkForSymbol = function (force) {
  if (Doc.getCAttribute(this.current, 'text')) {
    return;
  }
  var value = this.current.textContent;

  if (this.current.parentNode.parentNode.nodeName === 'f' &&
      this.current.parentNode.childNodes.length === 1 && value === 'h') {
    var n = this.current.parentNode.parentNode;
    this.replaceSymbol(n, n.getAttribute('type') + 'h');
    return;
  }
  for (var s in Symbols) {
    if (!force && ['psi', 'xi'].indexOf(s) > -1) {
      continue;
    }
    if (this.current.nodeName === 'e' &&
        value.substring(this.caret - s.length, this.caret) === s) {
      var temp = value;
      var tempCaret = this.caret;
      this.current.textContent = value.slice(0, this.caret - s.length) +
        value.slice(this.caret);
      this.caret -= s.length;
      var success = this.insertSymbol(s);
      if (!success) {
        this.current.textContent = temp;
        this.caret = tempCaret;
      }
      return;
    }
  }
};

module.exports = Backend;
