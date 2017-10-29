var Doc = require('./doc.js');
var Symbols = require('./symbols.js');
var EventEmitter = require('eventemitter3');

var Backend = function (config) {
  config = config || {};
  var events = config['events'] || {};
  var options = config['options'] || {};
  this.parent = config['parent'];

  this.blacklist = [];
  this.autoreplace = true;

  EventEmitter.call(this);
  for (var e in events) {
    this.on(e, events[e]);
  }

  var opts = ['blankCaret', 'emptyContent', 'blacklist', 'autoreplace'];

  for (var i = 0; i < opts.length; i++) { // eslint-disable-line no-redeclare
    var p = opts[i];
    if (p in options) {
      this[p] = options[p];
    }
  }

  this.doc = new Doc(options['xmlContent']);

  this.current = this.doc.root().firstChild;
  this.caret = 0;
  this.selStart = null;
  this.selEnd = null;
  this.undoData = [];
  this.undoCurrent = -1;
  this.selStatus = Backend.SEL_NONE;
  this.checkpoint();
};

Backend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: Backend }
});

Backend.CARET = '\\cursor{-0.2ex}{0.7em}';
Backend.TEMP_SMALL_CARET = '\\cursor{0em}{0.6em}';
Backend.TEMP_CARET = '\\cursor{-0.2ex}{0.7em}';
Backend.SMALL_CARET = '\\cursor{-0.05em}{0.5em}';
Backend.SEL_CARET = '\\cursor{-0.2ex}{0.7em}';
Backend.SMALL_SEL_CARET = '\\cursor{-0.05em}{0.5em}';
Backend.SEL_COLOR = 'red';

Backend.SEL_NONE = 0;
Backend.SEL_CURSOR_AT_START = 1;
Backend.SEL_CURSOR_AT_END = 2;

Backend.Clipboard = null;

Backend.getENodeType = function (n) {
  if (n.parentNode.parentNode.nodeName === 'f') {
    return n.parentNode.parentNode.getAttribute('type');
  }
};

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
  this.selStart = null;
  this.selEnd = null;
  this.undoData = [];
  this.undoCurrent = -1;
  this.selStatus = Backend.SEL_NONE;
  this.checkpoint();
};

Backend.prototype.selectTo = function (loc, selCursor, selCaret, mouse) {
  if (loc.current === selCursor && loc.caret === selCaret) {
    this.selStatus = Backend.SEL_NONE;
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
  this.current = loc.current;
  this.caret = loc.caret;
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
    var isTextNode = Backend.getENodeType(n) === 'text' ||
      Backend.getENodeType(n) === 'symbol';
    if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
      selCursor = this.selEnd;
    }
    if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
      selCursor = this.selStart;
    }
    if (this.selStatus !== Backend.SEL_NONE) {
      var selCaretText = Doc.isSmall(selCursor.node)
        ? Backend.SMALL_SEL_CARET : Backend.SEL_CARET;
      if (!isTextNode && text.length === 0 && n.parentNode.childElementCount > 1) {
        selCaretText = '\\blue{\\xmlClass{mathylem_elt mathylem_blank ' +
          'mathylem_loc_' + n.getAttribute('path') + '_0}{' + selCaretText + '}}';
      } else {
        selCaretText = '\\blue{' + selCaretText + '}';
      }
      if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
        selCaretText = isTextNode ? '[' : selCaretText + '\\' +
          Backend.SEL_COLOR + '{';
      }
      if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
        selCaretText = isTextNode ? ']' : '}' + selCaretText;
      }
    }
    var caretText = '';
    var tempCaretText = '';
    if (text.length === 0) {
      if (isTextNode) {
        caretText = '\\_';
      } else if (n.parentNode.childElementCount === 1) {
        if (this.current === n) {
          var blankCaret = this.blankCaret || (Doc.isSmall(this.current)
            ? Backend.SMALL_CARET : Backend.CARET);
          ans = '\\red{\\xmlClass{main_cursor mathylem_elt mathylem_blank ' +
            'mathylem_loc_' + n.getAttribute('path') + '_0}{' + blankCaret + '}}';
        } else if (this.tempCursor.node === n) {
          ans = '\\gray{\\xmlClass{mathylem_elt mathylem_blank mathylem_loc_' +
            n.getAttribute('path') + '_0}{[?]}}';
        } else {
          ans = '\\blue{\\xmlClass{mathylem_elt mathylem_blank mathylem_loc_' +
            n.getAttribute('path') + '_0}{[?]}}';
        }
      } else if (this.tempCursor.node !== n && this.current !== n &&
          (!selCursor || selCursor.node !== n)) {
        // These are the empty e elements at either end of
        // a c or m node, such as the space before and
        // after both the sin and x^2 in sin(x^2)
        //
        // Here, we add in a small element so that we can
        // use the mouse to select these areas
        ans = '\\phantom{\\xmlClass{mathylem_elt mathylem_blank mathylem_loc_' +
          n.getAttribute('path') + '_0}{\\cursor{0.1ex}{1ex}}}';
      }
    }
    for (var i = 0; i < text.length + 1; i++) {
      if (n === this.current && i === this.caret &&
          (text.length > 0 || n.parentNode.childElementCount > 1)) {
        if (isTextNode) {
          if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
            caretText = '[';
          } else if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
            caretText = ']';
          } else {
            caretText = '\\_';
          }
        } else {
          caretText = Doc.isSmall(this.current) ? Backend.SMALL_CARET
            : Backend.CARET;
          if (text.length === 0) {
            caretText = '\\red{\\xmlClass{main_cursor mathylem_elt mathylem_blank' +
              ' mathylem_loc_' + n.getAttribute('path') + '_0}{' + caretText + '}}';
          } else {
            caretText = '\\red{\\xmlClass{main_cursor}{' + caretText + '}}';
          }
          if (this.selStatus === Backend.SEL_CURSOR_AT_START) {
            caretText = caretText + '\\' + Backend.SEL_COLOR + '{';
          } else if (this.selStatus === Backend.SEL_CURSOR_AT_END) {
            caretText = '}' + caretText;
          }
        }
        ans += caretText;
      } else if (n === this.current && i === this.caret && isTextNode) {
        ans += caretText;
      } else if (this.selStatus !== Backend.SEL_NONE &&
          selCursor.node === n && i === selCursor.caret) {
        ans += selCaretText;
      } else if (this.tempCursor.node === n && i === this.tempCursor.caret &&
          (text.length > 0 || n.parentNode.childElementCount > 1)) {
        if (isTextNode) {
          tempCaretText = '.';
        } else {
          tempCaretText = Doc.isSmall(this.current)
            ? Backend.TEMP_SMALL_CARET : Backend.TEMP_CARET;
          if (text.length === 0) {
            tempCaretText = '\\gray{\\xmlClass{mathylem_elt mathylem_blank math' +
              'ylem_loc_' + n.getAttribute('path') + '_0}{' + tempCaretText + '}}';
          } else {
            tempCaretText = '\\gray{' + tempCaretText + '}';
          }
        }
        ans += tempCaretText;
      }
      if (i < text.length) {
        ans += '\\xmlClass{mathylem_elt mathylem_loc_' + n.getAttribute('path') +
          '_' + i + '}{' + text[i] + '}';
      }
    }
    if (isTextNode && n === this.current) {
      ans = '\\xmlClass{mathylem_text_current}{{' + ans + '}}';
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
  var s = Symbols.symbols[name];
  var f = base.createElement('f');
  f.setAttribute('type', name);
  if (s['char']) {
    f.setAttribute('c', 'yes');
  }

  var firstRef = -1;
  var refsCount = 0;
  var lists = {};
  var first;

  // Make the b nodes for rendering each output
  var out = s['output']['latex'].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
  for (var i = 0; i < out.length; i++) {
    var m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
    if (m) {
      if (firstRef === -1) {
        firstRef = parseInt(m[1]);
      }
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
    if (i + 1 === firstRef) {
      first = nc.lastChild;
    }
    if (s['attrs']) {
      for (var a in (s['attrs'][i] || {})) {
        nc.setAttribute(a, s['attrs'][i][a]);
      }
    }
    if (i in lists) {
      var par = f;
      for (var j = 0; j < lists[i]; j++) { // eslint-disable-line no-redeclare
        var nl = base.createElement('l');
        nl.setAttribute('s', '1');
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
  return { 'f': f, 'first': first };
};

Backend.prototype.insertSymbol = function (name) {
  if (this.isBlacklisted(name)) {
    return false;
  }

  if (name === 'power' && this.caret === 0 && this.current.parentNode.parentNode
    .nodeName === 'f' && this.current.parentNode.childNodes.length === 1) {
    this.current = this.current.parentNode.parentNode.nextSibling;
  }

  var s = Symbols.symbols[name];
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

  var symbol = this.symbolToNode(name, content);
  var f = symbol.f;

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
    this.clearSelection();
  }
  if ((s === '*' && this.checkForPower()) || (s === '=' && this.checkForIneq())) {
    return;
  }
  if (this.current.firstChild) {
    var value = this.current.textContent;
    this.current.textContent = value.slice(0, this.caret) + s +
      value.slice(this.caret);
  } else {
    this.current.appendChild(this.doc.base.createTextNode(s));
  }
  this.caret += s.length;
  this.checkpoint();
  if (this.autoreplace) {
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
  this.clearSelection();
  this.checkpoint();
};

Backend.prototype.insertNodes = function (nodeList, moveCursor) {
  var clipboard = [];
  for (var i = 0; i < nodeList.length; i++) {
    clipboard.push(nodeList[i].cloneNode(true));
  }

  if (!this.current.firstChild) {
    this.current.appendChild(this.doc.base.createTextNode(''));
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
  this.clearSelection();
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
  return sel.nodeList;
};

Backend.prototype.selectAll = function () {
  this.home();
  this.setSelStart();
  this.end();
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
    this.selStatus = Backend.SEL_NONE;
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
    this.selStatus = Backend.SEL_NONE;
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
  var toInsert;

  // check if 2D and horizontal and extend all the other rows if so 
  if (!vertical && n.parentNode.parentNode.nodeName === 'l') {
    toInsert = base.createElement('c');
    toInsert.appendChild(this.makeE(''));
    var pos = 1;
    var cc = n;
    while (cc.previousSibling != null) {
      pos++;
      cc = cc.previousSibling;
    }
    var toModify = [];
    var iterator = this.doc.XPathList('./l/c[position()=' + pos + ']',
      n.parentNode.parentNode);
    for (var nn = iterator.iterateNext(); nn != null; nn =
        iterator.iterateNext()) {
      toModify.push(nn);
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
      node.parentNode.setAttribute('s',
        parseInt(node.parentNode.getAttribute('s')) + 1);
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
      toInsert.setAttribute('s', n.getAttribute('s'));
      for (var i = 0; i < parseInt(n.getAttribute('s')); i++) {
        var c = base.createElement('c');
        c.appendChild(this.makeE(''));
        toInsert.appendChild(c);
      }
    } else {
      toInsert = base.createElement('c');
      toInsert.appendChild(this.makeE(''));
    }
  }
  n.parentNode.setAttribute('s', parseInt(n.parentNode.getAttribute('s')) + 1);
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

  var pos = 1;
  var cc = n;

  // Find position of column
  while (cc.previousSibling != null) {
    pos++;
    cc = cc.previousSibling;
  }
  var toModify = [];
  var iterator = this.doc.XPathList('./l/c[position()=' + pos + ']',
    n.parentNode.parentNode);
  for (var nn = iterator.iterateNext(); nn != null; nn = iterator.iterateNext()) {
    toModify.push(nn);
  }
  for (var j = 0; j < toModify.length; j++) {
    var node = toModify[j];
    node.parentNode.setAttribute('s',
      parseInt(node.parentNode.getAttribute('s')) - 1);
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

  n.parentNode.setAttribute('s', parseInt(n.parentNode.getAttribute('s')) - 1);
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
  n.parentNode.setAttribute('s', parseInt(n.parentNode.getAttribute('s')) - 1);
  n.parentNode.removeChild(n);
};

Backend.prototype.right = function () {
  this.clearSelection();
  if (this.caret >= this.current.textContent.length) {
    var nn = this.doc.XPathNode('following::e[1]', this.current);
    if (nn != null) {
      this.current = nn;
      this.caret = 0;
    } else {
      this.emit('rightEnd');
    }
  } else {
    this.caret += 1;
  }
};

Backend.prototype.spacebar = function () {
  if (Backend.getENodeType(this.current) === 'text') {
    this.insertString(' ');
  }
};

Backend.prototype.left = function () {
  this.clearSelection();
  if (this.caret <= 0) {
    var pn = this.doc.XPathNode('preceding::e[1]', this.current);
    if (pn != null) {
      this.current = pn;
      this.caret = this.current.textContent.length;
    } else {
      this.emit('leftEnd');
    }
  } else {
    this.caret -= 1;
  }
};

Backend.prototype.deleteFromC = function () {
  var pos = 0;
  var c = this.current.parentNode;
  while (c) {
    pos++;
    c = c.previousSibling;
  }
  var idx = this.current.parentNode.getAttribute('delete');
  var node = this.doc.XPathNode('./c[position()=' + idx + ']',
    this.current.parentNode.parentNode);
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
    if (this.current.previousSibling != null &&
        this.current.previousSibling.getAttribute('c') === 'yes') {
      // The previous node is an f node but is really just a character.  Delete it.
      this.current = this.current.previousSibling;
      this.deleteFromF();
    } else if (this.current.previousSibling != null &&
        this.current.previousSibling.nodeName === 'f') {
      // We're in an e node just after an f node. 
      // Move back into the f node (delete it?)
      this.left();
      return false;
    } else if (this.current.parentNode.previousSibling != null) {
      // We're in a c child of an f node, but not the first one.
      // Go to the previous c
      if (this.current.parentNode.hasAttribute('delete')) {
        this.deleteFromC();
      } else {
        this.left();
        return false;
      }
    } else if (this.current.previousSibling == null && this.current.parentNode
      .nodeName === 'c' && this.current.parentNode.previousSibling == null) {
      // We're in the first c child of an f node and at the beginning
      // delete the f node
      var par = this.current.parentNode;
      while (par.parentNode.nodeName === 'l' || par.parentNode.nodeName === 'c') {
        par = par.parentNode;
      }
      if (par.hasAttribute('delete')) {
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
    this.selStatus = Backend.SEL_NONE;
    this.checkpoint();
  } else if (this.deleteFromE()) {
    this.checkpoint();
  }
};

Backend.prototype.deleteKey = function () {
  if (this.selStatus !== Backend.SEL_NONE) {
    this.deleteSelection();
    this.selStatus = Backend.SEL_NONE;
    this.checkpoint();
  } else if (this.deleteForwardFromE()) {
    this.checkpoint();
  }
};

Backend.prototype.backslash = function () {
  if (Backend.getENodeType(this.current) !== 'text' &&
      Backend.getENodeType(this.current) !== 'symbol') {
    this.insertSymbol('symbol');
  }
};

Backend.prototype.tab = function () {
  if (Backend.getENodeType(this.current) !== 'symbol') {
    this.checkForSymbol();
    return;
  }
  var name = this.current.firstChild.textContent;
  var candidates = [];
  for (var n in Symbols.symbols) {
    if (n.substr(0, name.length) === name) {
      candidates.push(n);
    }
  }
  if (candidates.length === 1) {
    this.current.firstChild.textContent = candidates[0];
    this.caret = candidates[0].length;
  } else {
    this.emit('completion', { 'candidates': candidates });
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
  if (this.current.parentNode.hasAttribute('up')) {
    var t = parseInt(this.current.parentNode.getAttribute('up'));
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
  if (this.current.parentNode.hasAttribute('down')) {
    var t = parseInt(this.current.parentNode.getAttribute('down'));
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

Backend.prototype.home = function () {
  this.current = this.doc.root().firstChild;
  this.caret = 0;
};

Backend.prototype.end = function () {
  this.current = this.doc.root().lastChild;
  this.caret = this.current.textContent.length;
};

Backend.prototype.checkpoint = function () {
  var base = this.doc.base;
  this.current.setAttribute('current', 'yes');
  this.current.setAttribute('caret', this.caret.toString());
  this.undoCurrent++;
  this.undoData[this.undoCurrent] = base.cloneNode(true);
  this.undoData.splice(this.undoCurrent + 1, this.undoData.length);
  this.emit('change', { 'old': this.undoData[this.undoCurrent - 1],
    'new': this.undoData[this.undoCurrent] });
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
  if (this.parent && this.parent.ready) {
    this.parent.render(true);
  }
};

Backend.prototype.restore = function (t) {
  this.doc.base = this.undoData[t].cloneNode(true);
  this.findCurrent();
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
};

Backend.prototype.findCurrent = function () {
  this.current = this.doc.XPathNode("//*[@current='yes']");
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
  if (Backend.getENodeType(this.current) === 'symbol') {
    this.completeSymbol();
  } else {
    this.emit('done');
  }
};

Backend.prototype.completeSymbol = function () {
  var name = this.current.firstChild.textContent;
  if (!Symbols.symbols[name]) {
    return;
  }
  this.current = this.current.parentNode.parentNode;
  this.deleteFromF();
  this.insertSymbol(name);
};

Backend.prototype.isBlacklisted = function (type) {
  for (var i = 0; i < this.blacklist.length; i++) {
    if (type === this.blacklist[i]) {
      return true;
    }
  }
  return false;
};

Backend.prototype.replaceSymbol = function (node, name) {
  var symbol = Symbols.symbols[name];
  if (!symbol || this.isBlacklisted(name)) {
    return false;
  }
  var f = this.symbolToNode(name, []).f;
  node.parentNode.replaceChild(f, node);
  if (!symbol['char']) {
    this.caret = 0;
    this.current = f;
    this.downFromFToBlank();
  }
  this.checkpoint();
  return true;
};

Backend.prototype.checkForPower = function () {
  if (this.autoreplace && this.caret === 0 && this.current.previousSibling &&
      this.current.previousSibling.nodeName === 'f' &&
      this.current.previousSibling.getAttribute('type') === '*') {
    this.current = this.current.previousSibling;
    this.deleteFromF();
    this.insertSymbol('power');
    return true;
  }
  return false;
};

Backend.prototype.checkForIneq = function () {
  if (this.autoreplace && this.caret === 0 && this.current.previousSibling &&
      this.current.previousSibling.nodeName === 'f' &&
      ['<', '>'].indexOf(this.current.previousSibling.getAttribute('type')) > -1) {
    var n = this.current.previousSibling;
    return this.replaceSymbol(n, n.getAttribute('type') + '=');
  }
  return false;
};

Backend.prototype.checkForSymbol = function () {
  if (Backend.getENodeType(this.current) === 'text' ||
      Backend.getENodeType(this.current) === 'symbol') {
    return;
  }
  var value = this.current.textContent;

  if (this.current.parentNode.parentNode.nodeName === 'f' &&
      this.current.parentNode.childNodes.length === 1 && value === 'h') {
    var n = this.current.parentNode.parentNode;
    this.replaceSymbol(n, n.getAttribute('type') + 'h');
    return;
  }
  for (var s in Symbols.symbols) {
    if (['psi', 'xi'].indexOf(s) > -1) {
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
