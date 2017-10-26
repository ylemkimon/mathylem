var MathYlemUtils = require('./mathylem_utils.js');
var MathYlemDoc = require('./mathylem_doc.js');
var MathYlemSymbols = require('./mathylem_symbols.js');

var MathYlemBackend = function (config) {
  config = config || {};
  var events = config['events'] || {};
  var options = config['options'] || {};
  this.parent = config['parent'];

  if (!this.parent) {
    throw new Error('No MathYlem editor provided.');
  }

  this.blacklist = [];
  this.autoreplace = true;
  this.events = {};

  var evts = ['ready', 'change', 'leftEnd', 'rightEnd', 'done', 'completion',
    'focus'];

  for (var i = 0; i < evts.length; i++) {
    var e = evts[i];
    if (e in events) {
      this.events[e] = e in events ? events[e] : null;
    }
  }

  var opts = ['blankCaret', 'emptyContent', 'blacklist', 'autoreplace'];

  for (var i = 0; i < opts.length; i++) { // eslint-disable-line no-redeclare
    var p = opts[i];
    if (p in options) {
      this[p] = options[p];
    }
  }

  this.symbols = {};
  this.doc = new MathYlemDoc(options['xmlContent']);

  this.current = this.doc.root().firstChild;
  this.caret = 0;
  this.selStart = null;
  this.selEnd = null;
  this.undoData = [];
  this.undoCurrent = -1;
  this.selStatus = MathYlemBackend.SEL_NONE;
  this.checkpoint();
  if (MathYlemBackend.ready) {
    this.symbols = JSON.parse(JSON.stringify(MathYlemSymbols.symbols));
  }
};

MathYlemBackend.SEL_NONE = 0;
MathYlemBackend.SEL_CURSOR_AT_START = 1;
MathYlemBackend.SEL_CURSOR_AT_END = 2;

MathYlemBackend.Clipboard = null;

MathYlemBackend.prototype.getContent = function (t, r) {
  return this.doc.getContent(t, r);
};

MathYlemBackend.prototype.xml = function () {
  return this.doc.getContent('xml');
};

MathYlemBackend.prototype.latex = function () {
  return this.doc.getContent('latex');
};

MathYlemBackend.prototype.text = function () {
  return this.doc.getContent('text');
};

MathYlemBackend.prototype.setContent = function (xmlData) {
  this.doc = new MathYlemDoc(xmlData);
  this.current = this.doc.root().lastChild;
  this.caret = MathYlemUtils.getLength(this.current);
  this.selStart = null;
  this.selEnd = null;
  this.undoData = [];
  this.undoCurrent = -1;
  this.selStatus = MathYlemBackend.SEL_NONE;
  this.checkpoint();
};

MathYlemBackend.prototype.fireEvent = function (event, args) {
  args = args || {};
  args.target = this.parent;
  if (this.events[event]) {
    this.events[event](args);
  }
};

MathYlemBackend.prototype.removeSymbol = function (name) {
  if (this.symbols[name]) {
    delete this.symbols[name];
  }
};

MathYlemBackend.prototype.addSymbols = function (name, symbol) {
  var newSymbols = MathYlemSymbols.addSymbols(name, symbol);
  for (var s in newSymbols) {
    this.symbols[s] = newSymbols[s];
  }
};

MathYlemBackend.prototype.addNonLaTeXFuncSymbol = function (name, group) {
  var newSymbols = MathYlemSymbols.addSymbols('_func_nonlatex',
    [{ 'group': group, 'symbols': [name] }]);
  for (var s in newSymbols) {
    this.symbols[s] = newSymbols[s];
  }
};

MathYlemBackend.prototype.addFuncSymbol = function (name, group) {
  var newSymbols = MathYlemSymbols.addSymbols('_func',
    [{ 'group': group, 'symbols': [name] }]);
  for (var s in newSymbols) {
    this.symbols[s] = newSymbols[s];
  }
};

MathYlemBackend.prototype.addRawSymbol = function (name, latex, text, group) {
  var symbol = {};
  symbol[name] = { 'latex': latex, 'text': text };
  var newSymbols = MathYlemSymbols.addSymbols('_raw',
    [{ 'group': group, 'symbols': symbol }]);
  for (var s in newSymbols) {
    this.symbols[s] = newSymbols[s];
  }
};

MathYlemBackend.prototype.selectTo = function (loc, selCursor, selCaret, mouse) {
  if (loc.current === selCursor && loc.caret === selCaret) {
    this.selStatus = MathYlemBackend.SEL_NONE;
  } else if (loc.pos === 'left') {
    this.selEnd = {
      'node': selCursor,
      'caret': selCaret
    };
    this.setSelection(MathYlemBackend.SEL_CURSOR_AT_START, mouse);
  } else if (loc.pos === 'right') {
    this.selStart = {
      'node': selCursor,
      'caret': selCaret
    };
    this.setSelection(MathYlemBackend.SEL_CURSOR_AT_END, mouse);
  }
  this.current = loc.current;
  this.caret = loc.caret;
};

MathYlemBackend.prototype.setSelStart = function () {
  this.selStart = { 'node': this.current, 'caret': this.caret };
};

MathYlemBackend.prototype.setSelEnd = function () {
  this.selEnd = { 'node': this.current, 'caret': this.caret };
};

MathYlemBackend.prototype.addPaths = function (n, path) {
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

MathYlemBackend.prototype.addCursorClasses = function (n, path) {
  if (n.nodeName === 'e') {
    var text = MathYlemUtils.getValue(n);
    var ans = '';
    var selCursor;
    var isTextNode = MathYlemUtils.isText(n);
    if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_START) {
      selCursor = this.selEnd;
    }
    if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_END) {
      selCursor = this.selStart;
    }
    if (this.selStatus !== MathYlemBackend.SEL_NONE) {
      var selCaretText = MathYlemUtils.isSmall(selCursor.node)
        ? MathYlemUtils.SMALL_SEL_CARET : MathYlemUtils.SEL_CARET;
      if (!isTextNode && text.length === 0 && n.parentNode.childElementCount > 1) {
        selCaretText = '\\blue{\\xmlClass{mathylem_elt mathylem_blank ' +
          'mathylem_loc_' + n.getAttribute('path') + '_0}{' + selCaretText + '}}';
      } else {
        selCaretText = '\\blue{' + selCaretText + '}';
      }
      if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_END) {
        selCaretText = isTextNode ? '[' : selCaretText + '\\' +
          MathYlemUtils.SEL_COLOR + '{';
      }
      if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_START) {
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
          var blankCaret = this.blankCaret || (MathYlemUtils.isSmall(this.current)
            ? MathYlemUtils.SMALL_CARET : MathYlemUtils.CARET);
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
          if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_START) {
            caretText = '[';
          } else if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_END) {
            caretText = ']';
          } else {
            caretText = '\\_';
          }
        } else {
          caretText = MathYlemUtils.isSmall(this.current)
            ? MathYlemUtils.SMALL_CARET : MathYlemUtils.CARET;
          if (text.length === 0) {
            caretText = '\\red{\\xmlClass{main_cursor mathylem_elt mathylem_blank' +
              ' mathylem_loc_' + n.getAttribute('path') + '_0}{' + caretText + '}}';
          } else {
            caretText = '\\red{\\xmlClass{main_cursor}{' + caretText + '}}';
          }
          if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_START) {
            caretText = caretText + '\\' + MathYlemUtils.SEL_COLOR + '{';
          } else if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_END) {
            caretText = '}' + caretText;
          }
        }
        ans += caretText;
      } else if (n === this.current && i === this.caret && isTextNode) {
        ans += caretText;
      } else if (this.selStatus !== MathYlemBackend.SEL_NONE &&
          selCursor.node === n && i === selCursor.caret) {
        ans += selCaretText;
      } else if (this.tempCursor.node === n && i === this.tempCursor.caret &&
          (text.length > 0 || n.parentNode.childElementCount > 1)) {
        if (isTextNode) {
          tempCaretText = '.';
        } else {
          tempCaretText = MathYlemUtils.isSmall(this.current)
            ? MathYlemUtils.TEMP_SMALL_CARET : MathYlemUtils.TEMP_CARET;
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
      if (c.nodeName === 'c' || c.nodeName === 'l' || c.nodeName === 'f' ||
          c.nodeName === 'e') {
        this.addCursorClasses(c);
      }
    }
  }
};

MathYlemBackend.prototype.removeCursorClasses = function (n) {
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

MathYlemBackend.prototype.downFromF = function () {
  var nn = this.current.firstChild;
  while (nn != null && nn.nodeName !== 'c' && nn.nodeName !== 'l') {
    nn = nn.nextSibling;
  }
  if (nn != null) {
    while (nn.nodeName === 'l') {
      nn = nn.firstChild;
    }
    this.current = nn.firstChild;
  }
};

MathYlemBackend.prototype.downFromFToBlank = function () {
  var nn = this.current.firstChild;
  while (nn != null && !(nn.nodeName === 'c' && nn.childNodes.length === 1 &&
      MathYlemUtils.isBlank(nn.firstChild))) {
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

MathYlemBackend.prototype.deleteFromF = function (toInsert) {
  var n = this.current;
  var p = n.parentNode;
  var prev = n.previousSibling;
  var next = n.nextSibling;
  var middle = toInsert || '';
  var newNode = this.makeE(MathYlemUtils.getValue(prev) + middle +
    MathYlemUtils.getValue(next));
  this.current = newNode;
  this.caret = MathYlemUtils.getLength(prev);
  p.insertBefore(newNode, prev);
  p.removeChild(prev);
  p.removeChild(n);
  p.removeChild(next);
};

MathYlemBackend.prototype.symbolToNode = function (name, content) {
  var base = this.doc.base;
  var s = this.symbols[name];
  var f = base.createElement('f');
  if ('type' in s) {
    f.setAttribute('type', s['type']);
  }
  if ('group' in s) {
    f.setAttribute('group', s['group']);
  }
  if (s['char']) {
    f.setAttribute('c', 'yes');
  }

  var firstRef = -1;
  var refsCount = 0;
  var lists = {};
  var first;

  // Make the b nodes for rendering each output    
  for (var t in s['output']) {
    var b = base.createElement('b');
    b.setAttribute('p', t);

    var out = s['output'][t];
    if (typeof out === 'string') {
      out = out.split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
      for (var i = 0; i < out.length; i++) {
        var m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
        if (m) {
          out[i] = { 'ref': parseInt(m[1]) };
          if (m[2].length > 0) {
            var mm = m[2].match(/\{[^}]*\}/g);
            out[i]['d'] = mm.length;
            for (var j = 0; j < mm.length; j++) {
              out[i]['sep' + j] = mm[j].substring(1, mm[j].length - 1);
            }
          }
        }
      }
    }
    for (var i = 0; i < out.length; i++) { // eslint-disable-line no-redeclare
      var nt;
      if (typeof out[i] === 'string' || out[i] instanceof String) {
        nt = base.createTextNode(out[i]);
        b.appendChild(nt);
      } else {
        nt = base.createElement('r');
        for (var attr in out[i]) {
          nt.setAttribute(attr, out[i][attr]);
        }
        if (t === 'latex') {
          if (firstRef === -1) {
            firstRef = out[i]['ref'];
          }
          if ('d' in out[i]) {
            lists[refsCount] = out[i]['d'];
          }
          refsCount++;
        }
        b.appendChild(nt);
      }
    }
    f.appendChild(b);
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

MathYlemBackend.prototype.insertSymbol = function (name) {
  if (name === 'power' && this.caret === 0 && this.current.parentNode.parentNode
    .nodeName === 'f' && this.current.parentNode.childNodes.length === 1) {
    this.current = this.current.parentNode.parentNode.nextSibling;
  }

  var s = this.symbols[name];
  if (this.isBlacklisted(s['type'])) {
    return false;
  }
  var content = {};
  var leftPiece, rightPiece;
  var cur = s['current'] == null ? 0 : parseInt(s['current']);
  var toRemove = [];
  var toReplace = null;
  var replace = false;

  if (cur > 0) {
    cur--;
    if (this.selStatus !== MathYlemBackend.SEL_NONE) {
      var sel = this.getSelection();
      toRemove = sel.involved;
      leftPiece = this.makeE(MathYlemUtils.getValue(sel.remnant)
        .slice(0, this.selStart.caret));
      rightPiece = this.makeE(MathYlemUtils.getValue(sel.remnant)
        .slice(this.selStart.caret));
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
        var prev = MathYlemUtils.getValue(this.current).substring(0, this.caret);
        var token = prev.match(/[0-9.]+$|[a-zA-Z]$/);
        if (token != null && token.length > 0) {
          token = token[0];
          leftPiece = this.makeE(MathYlemUtils.getValue(this.current)
            .slice(0, this.caret - token.length));
          rightPiece = this.makeE(MathYlemUtils.getValue(this.current)
            .slice(this.caret));
          content[cur] = [this.makeE(token)];
        }
      }
    }
  }
  if (!replace && (leftPiece == null || rightPiece == null)) {
    leftPiece = this.makeE(MathYlemUtils.getValue(this.current)
      .slice(0, this.caret));
    rightPiece = this.makeE(MathYlemUtils.getValue(this.current)
      .slice(this.caret));
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

MathYlemBackend.prototype.getSelection = function () {
  if (this.selStatus === MathYlemBackend.SEL_NONE) {
    return null;
  }
  var involved = [];
  var nodeList = [];
  var remnant = null;

  if (this.selStart.node === this.selEnd.node) {
    return {
      'nodeList': [this.makeE(MathYlemUtils.getValue(this.selStart.node)
        .substring(this.selStart.caret, this.selEnd.caret))],
      'remnant': this.makeE(MathYlemUtils.getValue(this.selStart.node)
        .substring(0, this.selStart.caret) + MathYlemUtils.getValue(
          this.selEnd.node).substring(this.selEnd.caret)),
      'involved': [this.selStart.node]
    };
  }

  nodeList.push(this.makeE(MathYlemUtils.getValue(this.selStart.node)
    .substring(this.selStart.caret)));
  involved.push(this.selStart.node);
  involved.push(this.selEnd.node);
  remnant = this.makeE(MathYlemUtils.getValue(this.selStart.node)
    .substring(0, this.selStart.caret) + MathYlemUtils.getValue(this.selEnd.node)
      .substring(this.selEnd.caret));
  var n = this.selStart.node.nextSibling;
  while (n != null && n !== this.selEnd.node) {
    involved.push(n);
    nodeList.push(n);
    n = n.nextSibling;
  }
  nodeList.push(this.makeE(MathYlemUtils.getValue(this.selEnd.node)
    .substring(0, this.selEnd.caret)));
  return { 'nodeList': nodeList,
    'remnant': remnant,
    'involved': involved,
    'cursor': 0 };
};

MathYlemBackend.prototype.makeE = function (text) {
  var base = this.doc.base;
  var newNode = base.createElement('e');
  newNode.appendChild(base.createTextNode(text));
  return newNode;
};

MathYlemBackend.prototype.insertString = function (s) {
  if (this.selStatus !== MathYlemBackend.SEL_NONE) {
    this.deleteSelection();
    this.clearSelection();
  }
  if (s === '*' && this.checkForPower()) {
    return;
  }
  if (this.current.firstChild) {
    var value = this.current.firstChild.nodeValue;
    this.current.firstChild.nodeValue = value.slice(0, this.caret) +
      s + value.slice(this.caret);
  } else {
    this.current.appendChild(this.doc.base.createTextNode(s));
  }
  this.caret += s.length;
  this.checkpoint();
  if (this.autoreplace) {
    this.checkForSymbol();
  }
};

MathYlemBackend.prototype.copySelection = function () {
  var sel = this.getSelection();
  if (!sel) {
    return;
  }
  MathYlemBackend.Clipboard = [];
  for (var i = 0; i < sel.nodeList.length; i++) {
    MathYlemBackend.Clipboard.push(sel.nodeList[i].cloneNode(true));
  }
  this.clearSelection();
};

MathYlemBackend.prototype.cutSelection = function () {
  var nodeList = this.deleteSelection();
  if (!nodeList) {
    return;
  }
  MathYlemBackend.Clipboard = [];
  for (var i = 0; i < nodeList.length; i++) {
    MathYlemBackend.Clipboard.push(nodeList[i].cloneNode(true));
  }
  this.clearSelection();
  this.checkpoint();
};

MathYlemBackend.prototype.insertNodes = function (nodeList, moveCursor) {
  var clipboard = [];
  for (var i = 0; i < nodeList.length; i++) {
    clipboard.push(nodeList[i].cloneNode(true));
  }

  if (!this.current.firstChild) {
    this.current.appendChild(this.doc.base.createTextNode(''));
  }
  if (clipboard.length === 1) {
    if (clipboard[0].firstChild) {
      this.current.firstChild.nodeValue = this.current.firstChild.nodeValue
        .substring(0, this.caret) + clipboard[0].firstChild.nodeValue +
          this.current.firstChild.nodeValue.substring(this.caret);
      if (moveCursor) {
        this.caret += clipboard[0].firstChild.nodeValue.length;
      }
    }
  } else {
    var nn = this.makeE(MathYlemUtils.getValue(clipboard[clipboard.length - 1]) +
      this.current.firstChild.nodeValue.substring(this.caret));
    this.current.firstChild.nodeValue = this.current.firstChild.nodeValue
      .substring(0, this.caret) + MathYlemUtils.getValue(clipboard[0]);
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
      this.caret = MathYlemUtils.getLength(clipboard[clipboard.length - 1]);
    }
  }
};

MathYlemBackend.prototype.paste = function () {
  this.deleteSelection();
  this.clearSelection();
  if (!MathYlemBackend.Clipboard || MathYlemBackend.Clipboard.length === 0) {
    return;
  }
  this.insertNodes(MathYlemBackend.Clipboard, true);
  this.checkpoint();
};

MathYlemBackend.prototype.clearSelection = function () {
  this.selStart = null;
  this.selEnd = null;
  this.selStatus = MathYlemBackend.SEL_NONE;
};

MathYlemBackend.prototype.deleteSelection = function () {
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

MathYlemBackend.prototype.selectAll = function () {
  this.home();
  this.setSelStart();
  this.end();
  this.setSelEnd();
  if (this.selStart.node !== this.selEnd.node ||
      this.selStart.caret !== this.selEnd.caret) {
    this.selStatus = MathYlemBackend.SEL_CURSOR_AT_END;
  }
};

MathYlemBackend.prototype.selectRight = function () {
  if (this.selStatus === MathYlemBackend.SEL_NONE) {
    this.setSelStart();
    this.selStatus = MathYlemBackend.SEL_CURSOR_AT_END;
  }
  if (this.caret >= MathYlemUtils.getLength(this.current)) {
    var nn = this.current.nextSibling;
    if (nn != null) {
      this.current = nn.nextSibling;
      this.caret = 0;
      this.setSelection(MathYlemBackend.SEL_CURSOR_AT_END);
    } else {
      this.setSelection(MathYlemBackend.SEL_CURSOR_AT_END);
    }
  } else {
    this.caret += 1;
    this.setSelection(MathYlemBackend.SEL_CURSOR_AT_END);
  }
  if (this.selStart.node === this.selEnd.node &&
      this.selStart.caret === this.selEnd.caret) {
    this.selStatus = MathYlemBackend.SEL_NONE;
  }
};

MathYlemBackend.prototype.setSelection = function (sstatus, mouse) {
  if (this.selStatus === MathYlemBackend.SEL_NONE || mouse) {
    this.selStatus = sstatus;
  }
  if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_START) {
    this.setSelStart();
  } else if (this.selStatus === MathYlemBackend.SEL_CURSOR_AT_END) {
    this.setSelEnd();
  }
};

MathYlemBackend.prototype.selectLeft = function () {
  if (this.selStatus === MathYlemBackend.SEL_NONE) {
    this.setSelEnd();
    this.selStatus = MathYlemBackend.SEL_CURSOR_AT_START;
  }
  if (this.caret <= 0) {
    var nn = this.current.previousSibling;
    if (nn != null) {
      this.current = nn.previousSibling;
      this.caret = MathYlemUtils.getLength(this.current);
      this.setSelection(MathYlemBackend.SEL_CURSOR_AT_START);
    } else {
      this.setSelection(MathYlemBackend.SEL_CURSOR_AT_START);
    }
  } else {
    this.caret -= 1;
    this.setSelection(MathYlemBackend.SEL_CURSOR_AT_START);
  }
  if (this.selStart.node === this.selEnd.node &&
      this.selStart.caret === this.selEnd.caret) {
    this.selStatus = MathYlemBackend.SEL_NONE;
  }
};

MathYlemBackend.prototype.copyExtendListRight = function () {
  this.extendList('right', true);
};
MathYlemBackend.prototype.copyExtendListLeft = function () {
  this.extendList('left', true);
};
MathYlemBackend.prototype.extendListRight = function () {
  this.extendList('right', false);
};
MathYlemBackend.prototype.extendListLeft = function () {
  this.extendList('left', false);
};
MathYlemBackend.prototype.extendListUp = function () {
  this.extendList('up', false);
};
MathYlemBackend.prototype.extendListDown = function () {
  this.extendList('down', false);
};
MathYlemBackend.prototype.copyExtendListUp = function () {
  this.extendList('up', true);
};
MathYlemBackend.prototype.copyExtendListDown = function () {
  this.extendList('down', true);
};

MathYlemBackend.prototype.moveVerticalList = function (down) {
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
  this.caret = down ? 0 : MathYlemUtils.getLength(this.current);
};

MathYlemBackend.prototype.extendList = function (direction, copy) {
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
    this.caret = MathYlemUtils.getLength(this.current);
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

MathYlemBackend.prototype.removeListColumn = function () {
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
    this.caret = MathYlemUtils.getLength(this.current);
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

MathYlemBackend.prototype.removeListRow = function () {
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
    this.caret = MathYlemUtils.getLength(this.current);
  } else if (n.nextSibling != null) {
    this.current = n.nextSibling.firstChild.firstChild;
    this.caret = 0;
  } else {
    return;
  }

  n.parentNode.setAttribute('s', parseInt(n.parentNode.getAttribute('s')) - 1);
  n.parentNode.removeChild(n);
};

MathYlemBackend.prototype.removeListItem = function () {
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
    this.caret = MathYlemUtils.getLength(this.current);
  } else if (n.nextSibling != null) {
    this.current = n.nextSibling.firstChild;
    this.caret = 0;
  } else {
    return;
  }
  n.parentNode.setAttribute('s', parseInt(n.parentNode.getAttribute('s')) - 1);
  n.parentNode.removeChild(n);
};

MathYlemBackend.prototype.right = function () {
  this.clearSelection();
  if (this.caret >= MathYlemUtils.getLength(this.current)) {
    var nn = this.doc.XPathNode('following::e[1]', this.current);
    if (nn != null) {
      this.current = nn;
      this.caret = 0;
    } else {
      this.fireEvent('rightEnd');
    }
  } else {
    this.caret += 1;
  }
};

MathYlemBackend.prototype.spacebar = function () {
  if (MathYlemUtils.isText(this.current)) {
    this.insertString(' ');
  }
};

MathYlemBackend.prototype.left = function () {
  this.clearSelection();
  if (this.caret <= 0) {
    var pn = this.doc.XPathNode('preceding::e[1]', this.current);
    if (pn != null) {
      this.current = pn;
      this.caret = MathYlemUtils.getLength(this.current);
    } else {
      this.fireEvent('leftEnd');
    }
  } else {
    this.caret -= 1;
  }
};

MathYlemBackend.prototype.deleteFromC = function () {
  var pos = 0;
  var c = this.current.parentNode;
  while (c && c.nodeName === 'c') {
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

MathYlemBackend.prototype.deleteFromE = function () {
  // return false if we deleted something, and true otherwise.
  if (this.caret > 0) {
    var value = this.current.firstChild.nodeValue;
    this.current.firstChild.nodeValue = value.slice(0, this.caret - 1) +
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
    } else if (this.current.parentNode.previousSibling != null &&
        this.current.parentNode.previousSibling.nodeName === 'c') {
      // We're in a c child of an f node, but not the first one.
      // Go to the previous c
      if (this.current.parentNode.hasAttribute('delete')) {
        this.deleteFromC();
      } else {
        this.left();
        return false;
      }
    } else if (this.current.previousSibling == null && this.current.parentNode
      .nodeName === 'c' && (this.current.parentNode.previousSibling == null ||
        this.current.parentNode.previousSibling.nodeName !== 'c')) {
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

MathYlemBackend.prototype.deleteForwardFromE = function () {
  // return false if we deleted something, and true otherwise.
  if (this.caret < this.current.firstChild.nodeValue.length) {
    var value = this.current.firstChild.nodeValue;
    this.current.firstChild.nodeValue = value.slice(0, this.caret) +
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

MathYlemBackend.prototype.backspace = function () {
  if (this.selStatus !== MathYlemBackend.SEL_NONE) {
    this.deleteSelection();
    this.selStatus = MathYlemBackend.SEL_NONE;
    this.checkpoint();
  } else if (this.deleteFromE()) {
    this.checkpoint();
  }
};

MathYlemBackend.prototype.deleteKey = function () {
  if (this.selStatus !== MathYlemBackend.SEL_NONE) {
    this.deleteSelection();
    this.selStatus = MathYlemBackend.SEL_NONE;
    this.checkpoint();
  } else if (this.deleteForwardFromE()) {
    this.checkpoint();
  }
};

MathYlemBackend.prototype.backslash = function () {
  if (MathYlemUtils.isText(this.current)) {
    return;
  }
  this.insertSymbol('sym_name');
};

MathYlemBackend.prototype.tab = function () {
  if (!MathYlemUtils.isSymbol(this.current)) {
    this.checkForSymbol();
    return;
  }
  var name = this.current.firstChild.textContent;
  var candidates = [];
  for (var n in this.symbols) {
    if (n.substr(0, name.length) === name) {
      candidates.push(n);
    }
  }
  if (candidates.length === 1) {
    this.current.firstChild.textContent = candidates[0];
    this.caret = candidates[0].length;
  } else {
    this.fireEvent('completion', { 'candidates': candidates });
  }
};

MathYlemBackend.prototype.rightParen = function () {
  if (this.current.nodeName !== 'e' ||
      this.caret === MathYlemUtils.getLength(this.current)) {
    this.right();
  }
};

MathYlemBackend.prototype.up = function () {
  this.clearSelection();
  if (this.current.parentNode.hasAttribute('up')) {
    var t = parseInt(this.current.parentNode.getAttribute('up'));
    var f = this.current.parentNode.parentNode;
    var n = f.firstChild;
    while (n != null && t > 0) {
      if (n.nodeName === 'c') {
        t--;
      }
      if (t > 0) {
        n = n.nextSibling;
      }
    }
    this.current = n.lastChild;
    this.caret = MathYlemUtils.getLength(this.current);
  } else {
    this.moveVerticalList(false);
  }
};

MathYlemBackend.prototype.down = function () {
  this.clearSelection();
  if (this.current.parentNode.hasAttribute('down')) {
    var t = parseInt(this.current.parentNode.getAttribute('down'));
    var f = this.current.parentNode.parentNode;
    var n = f.firstChild;
    while (n != null && t > 0) {
      if (n.nodeName === 'c') {
        t--;
      }
      if (t > 0) {
        n = n.nextSibling;
      }
    }
    this.current = n.lastChild;
    this.caret = MathYlemUtils.getLength(this.current);
  } else {
    this.moveVerticalList(true);
  }
};

MathYlemBackend.prototype.home = function () {
  this.current = this.doc.root().firstChild;
  this.caret = 0;
};

MathYlemBackend.prototype.end = function () {
  this.current = this.doc.root().lastChild;
  this.caret = MathYlemUtils.getLength(this.current);
};

MathYlemBackend.prototype.checkpoint = function () {
  var base = this.doc.base;
  this.current.setAttribute('current', 'yes');
  this.current.setAttribute('caret', this.caret.toString());
  this.undoCurrent++;
  this.undoData[this.undoCurrent] = base.cloneNode(true);
  this.undoData.splice(this.undoCurrent + 1, this.undoData.length);
  this.fireEvent('change', { 'old': this.undoData[this.undoCurrent - 1],
    'new': this.undoData[this.undoCurrent] });
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
  if (this.parent.ready) {
    this.parent.render(true);
  }
};

MathYlemBackend.prototype.restore = function (t) {
  this.doc.base = this.undoData[t].cloneNode(true);
  this.findCurrent();
  this.current.removeAttribute('current');
  this.current.removeAttribute('caret');
};

MathYlemBackend.prototype.findCurrent = function () {
  this.current = this.doc.XPathNode("//*[@current='yes']");
  this.caret = parseInt(this.current.getAttribute('caret'));
};

MathYlemBackend.prototype.undo = function () {
  this.clearSelection();
  if (this.undoCurrent <= 0) {
    return;
  }
  this.undoCurrent--;
  this.restore(this.undoCurrent);
};

MathYlemBackend.prototype.redo = function () {
  this.clearSelection();
  if (this.undoCurrent >= this.undoData.length - 1) {
    return;
  }
  this.undoCurrent++;
  this.restore(this.undoCurrent);
};

MathYlemBackend.prototype.done = function (s) {
  if (MathYlemUtils.isSymbol(this.current)) {
    this.completeSymbol();
  } else {
    this.fireEvent('done');
  }
};

MathYlemBackend.prototype.completeSymbol = function () {
  var name = this.current.firstChild.textContent;
  if (!this.symbols[name]) {
    return;
  }
  this.current = this.current.parentNode.parentNode;
  this.deleteFromF();
  this.insertSymbol(name);
};

MathYlemBackend.prototype.isBlacklisted = function (type) {
  for (var i = 0; i < this.blacklist.length; i++) {
    if (type === this.blacklist[i]) {
      return true;
    }
  }
  return false;
};

MathYlemBackend.prototype.checkForPower = function () {
  if (this.autoreplace && this.caret === 0 && this.current.previousSibling &&
      this.current.previousSibling.nodeName === 'f' &&
      this.current.previousSibling.getAttribute('type') === '*') {
    var n = this.current.previousSibling;
    var p = n.parentNode;
    var prev = n.previousSibling;
    var next = n.nextSibling;
    var newNode = this.makeE(MathYlemUtils.getValue(prev) +
      MathYlemUtils.getValue(next));
    this.current = newNode;
    this.caret = MathYlemUtils.getLength(prev);
    p.insertBefore(newNode, prev);
    p.removeChild(prev);
    p.removeChild(n);
    p.removeChild(next);
    this.insertSymbol('power');
    return true;
  }
  return false;
};

MathYlemBackend.prototype.checkForSymbol = function () {
  if (MathYlemUtils.isText(this.current)) {
    return;
  }
  var value = this.current.firstChild.nodeValue;

  if (this.current.parentNode.parentNode.nodeName === 'f' &&
      this.current.parentNode.childNodes.length === 1 && value === 'h') {
    var n = this.current.parentNode.parentNode;
    var name = n.getAttribute('type') + 'h';
    var symbol = this.symbols[name];
    if (!symbol || this.isBlacklisted(symbol['type'])) {
      return;
    }
    var f = this.symbolToNode(name, []).f;
    n.parentNode.replaceChild(f, n);
    this.caret = 0;
    this.current = f;
    this.downFromFToBlank();
    this.checkpoint();
    return;
  }
  for (var s in this.symbols) {
    if (this.current.nodeName === 'e' && !MathYlemUtils.isBlank(this.current) &&
        value.substring(this.caret - s.length, this.caret) === s) {
      var temp = value;
      var tempCaret = this.caret;
      this.current.firstChild.nodeValue = value.slice(0, this.caret - s.length) +
        value.slice(this.caret);
      this.caret -= s.length;
      var success = this.insertSymbol(s);
      if (!success) {
        this.current.firstChild.nodeValue = temp;
        this.caret = tempCaret;
      }
      return;
    }
  }
};

module.exports = MathYlemBackend;
