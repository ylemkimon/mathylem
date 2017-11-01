/* eslint-env browser */
var Mousetrap = require('mousetrap');
var katex = require('katex');
var Backend = require('./backend.js');
var Symbols = require('./symbols.js');
var Doc = require('./doc.js');
var debounce = require('throttle-debounce/debounce');

var MathYlem = function (el, config) {
  config = config || {};

  if (typeof el === 'string' || el instanceof String) {
    el = document.getElementById(el);
  }
  if (!el) {
    throw new Error('Invalid element.');
  } else if (el.mathylem) {
    throw new Error('MathYlem already attached.');
  }

  if (!el.id) {
    var i = MathYlem.maxUid;
    while (document.getElementById('mathylem_' + i)) {
      i++;
    }
    MathYlem.maxUid = i;
    el.id = 'mathylem_' + i;
  }

  MathYlem.instances[el.id] = this;
  el.mathylem = this;

  this.editor = this.createEditor(el);
  if (/Mobi/.test(navigator.userAgent)) { // TODO: Better unfocusable div detection
    this.fakeInput = this.createFakeInput(el);
  }

  this.active = true;
  this.emptyContent = config['emptyContent'] || '\\red{[?]}';
  this._focus = false;
  this.ready = false;

  this.backend = new Backend(config, this);
  this.tempCursor = { 'node': null, 'caret': 0 };
  if (Backend.ready) {
    this.ready = true;
    this.backend.emit('ready');
    this.render(true);
  }
  this.deactivate(true);
};

MathYlem.Backend = Backend;
MathYlem.Doc = Doc;
MathYlem.Symbols = Symbols;
MathYlem.katex = katex;

MathYlem.maxUid = 0;
MathYlem.maxTabIndex = 0;

MathYlem.instances = {};

MathYlem.activeMathYlem = null;

MathYlem.initialize = function (symbols) {
  var allReady = function () {
    MathYlem.registerKeyboardHandlers();
    for (var i in MathYlem.instances) {
      MathYlem.instances[i].ready = true;
      MathYlem.instances[i].render(true);
      MathYlem.instances[i].backend.emit('ready');
    }
    Backend.ready = true;
  };
  if (!Array.isArray(symbols)) {
    symbols = [symbols];
  }
  var calls = [];
  for (var i = 0; i < symbols.length; i++) {
    var x = (function outer (j) {
      return function (callback) {
        var req = new XMLHttpRequest();
        req.onload = function () {
          Symbols.addSymbols(this.responseText);
          callback();
        };
        req.open('get', symbols[j], true);
        req.send();
      };
    }(i));
    calls.push(x);
  }
  calls.push(allReady);
  var j = 0;
  var cb = function () {
    j++;
    calls[j](cb);
  };
  calls[0](cb);
};

MathYlem.prototype.createEditor = function (el) {
  var self = this;
  var editor = document.createElement('div');
  editor.className = 'mathylem';
  editor.tabIndex = MathYlem.maxTabIndex++;

  editor.addEventListener('click', function () {
    if (self.active) {
      return;
    }
    self._focus = true;
    setTimeout(function () {
      self._focus = false;
    }, 500);
    self.backend.end();
    self.activate(true);
  });

  el.appendChild(editor);
  return editor;
};

MathYlem.prototype.createFakeInput = function (el) {
  var self = this;

  var fakeInput = document.createElement('textarea');
  fakeInput.setAttribute('autocapitalize', 'none');
  fakeInput.setAttribute('autocomplete', 'off');
  fakeInput.setAttribute('autocorrect', 'off');
  fakeInput.setAttribute('spellcheck', 'false');
  fakeInput.value = '____________________';

  fakeInput.style.position = 'absolute';
  fakeInput.style.top = el.offsetTop + 'px';
  fakeInput.style.left = el.offsetLeft + 'px';
  fakeInput.style.width = '1px';
  fakeInput.style.height = '1px';
  fakeInput.style.opacity = 0;
  fakeInput.style.padding = 0;
  fakeInput.style.margin = 0;
  fakeInput.style.border = 0;

  this._processedFakeInput = 20;
  fakeInput.addEventListener('input', debounce(100, function () {
    for (; self._processedFakeInput >
        self.fakeInput.value.length; self._processedFakeInput--) {
      Mousetrap.trigger('backspace');
    }
    if (self.fakeInput.value.length === 0) {
      self._processedFakeInput = 20;
      self.fakeInput.value = '____________________';
    }
    for (; self._processedFakeInput <
        self.fakeInput.value.length; self._processedFakeInput++) {
      var c = self.fakeInput.value[self._processedFakeInput];
      console.log(c);
      if (c !== c.toLowerCase()) {
        Mousetrap.trigger('shift+' + c.toLowerCase());
      } else if (c === ' ') {
        Mousetrap.trigger('space');
      } else {
        Mousetrap.trigger(c);
      }
    }
  }));
  fakeInput.addEventListener('keydown', function (e) {
    if (e.keycode === 8) {
      Mousetrap.trigger('backspace');
      e.preventDefault();
    } else if (e.keycode === 13) {
      Mousetrap.trigger('enter');
      e.preventDefault();
    }
  });
  fakeInput.addEventListener('focus', function () {
    self.activate(false);
  });
  fakeInput.addEventListener('blur', function () {
    if (self._focus) {
      self._focus = false;
      this.focus();
    } else {
      self.deactivate(false);
    }
  });

  el.appendChild(fakeInput);
  return fakeInput;
};

MathYlem.prototype.isChanged = function () {
  var bb = this.editor.getElementsByClassName('katex')[0];
  if (!bb) {
    return;
  }
  var rect = bb.getBoundingClientRect();
  var ans = !this.boundingBox || this.boundingBox.top !== rect.top ||
    this.boundingBox.bottom !== rect.bottom || this.boundingBox.right !==
    rect.right || this.boundingBox.left !== rect.left;
  this.boundingBox = rect;
  return ans;
};

MathYlem.prototype.computeLocations = function () {
  var ans = [];
  var bb = this.editor.getElementsByClassName('katex')[0];
  if (!bb) {
    return;
  }
  var rect = bb.getBoundingClientRect();
  ans.push({
    'path': 'all',
    'top': rect.top,
    'bottom': rect.bottom,
    'left': rect.left,
    'right': rect.right
  });
  var elts = this.editor.getElementsByClassName('mathylem_elt');
  for (var i = 0; i < elts.length; i++) {
    var elt = elts[i];
    if (elt.nodeName === 'mstyle') {
      continue;
    }
    rect = elt.getBoundingClientRect();
    if (rect.top === 0 && rect.bottom === 0 &&
        rect.left === 0 && rect.right === 0) {
      continue;
    }
    var cl = elt.className.split(/\s+/);
    for (var j = 0; j < cl.length; j++) {
      if (cl[j].substr(0, 12) === 'mathylem_loc') {
        ans.push({
          'path': cl[j],
          'top': rect.top,
          'bottom': rect.bottom,
          'left': rect.left,
          'right': rect.right,
          'midX': (rect.left + rect.right) / 2,
          'midY': (rect.bottom + rect.top) / 2,
          'blank': cl.indexOf('mathylem_blank') >= 0
        });
        break;
      }
    }
  }
  this.boxes = ans;
};

MathYlem.getPath = function (n) {
  var name = n.nodeName;
  if (name === 'm') {
    return 'mathylem_loc_m';
  }
  var ns = 0;
  for (var nn = n; nn != null; nn = nn.previousSibling) {
    if (nn.nodeType === 1 && nn.nodeName === name) {
      ns++;
    }
  }
  return MathYlem.getPath(n.parentNode) + '_' + name + '' + ns;
};

MathYlem.getLocation = function (x, y, currentNode, currentCaret) {
  var g = MathYlem.activeMathYlem;
  var minDist = -1;
  var midDist = 0;
  var opt = null;
  // check if we go to first or last element
  if (currentNode) {
    var currentPath = MathYlem.getPath(currentNode);
    var currentPos = parseInt(currentPath.substring(
      currentPath.lastIndexOf('e') + 1));
  }

  var boxes = g.boxes;
  if (!boxes) {
    return;
  }
  if (currentNode) {
    currentPath = currentPath.replace(/e[0-9]+$/, 'e');
    var boxes2 = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].path === 'all') {
        continue;
      }
      var path = boxes[i].path.substring(0, boxes[i].path.lastIndexOf('_'));
      path = path.replace(/e[0-9]+$/, 'e');
      if (path === currentPath) {
        boxes2.push(boxes[i]);
      }
    }
    boxes = boxes2;
  }
  if (!boxes) {
    return;
  }
  for (var i = 0; i < boxes.length; i++) { // eslint-disable-line no-redeclare
    var box = boxes[i];
    if (box.path === 'all') {
      if (!opt) {
        opt = { 'path': 'mathylem_loc_m_e1_0' };
      }
      continue;
    }
    var xdist = Math.max(box.left - x, x - box.right, 0);
    var ydist = Math.max(box.top - y, y - box.bottom, 0);
    var dist = Math.sqrt(xdist * xdist + ydist * ydist);
    if (minDist === -1 || dist < minDist) {
      minDist = dist;
      midDist = x - box.midX;
      opt = box;
    }
  }
  var loc = opt.path.substring('mathylem_loc_m_'.length).split(/_/);
  var node = g.backend.doc.root();
  for (var i = 0; i < loc.length - 1; i++) { // eslint-disable-line no-redeclare
    var name = loc[i][0];
    var index = parseInt(loc[i].substring(1));
    for (node = node.firstChild; ; node = node.nextSibling) {
      if (node.nodeName === name) {
        index--;
      }
      if (index === 0) {
        break;
      }
    }
  }
  var car = parseInt(loc[loc.length - 1]);
  // Check if we want the cursor before or after the element
  if (midDist > 0 && !opt.blank) {
    car++;
  }
  var ans = {
    'current': node,
    'caret': car,
    'pos': 'none'
  };
  if (currentNode && opt) {
    var optPos = parseInt(opt.path.substring(opt.path.lastIndexOf('e') + 1,
      opt.path.lastIndexOf('_')));
    if (optPos < currentPos) {
      ans['pos'] = 'left';
    } else if (optPos > currentPos) {
      ans['pos'] = 'right';
    } else if (car < currentCaret) {
      ans['pos'] = 'left';
    } else if (car > currentCaret) {
      ans['pos'] = 'right';
    }
  }
  return ans;
};

MathYlem.mouseUp = function (e) {
  MathYlem.kb.isMouseDown = false;
  var g = MathYlem.activeMathYlem;
  if (g) {
    g.render(true);
  }
};

MathYlem.mouseDown = function (e) {
  var n = e.target;
  MathYlem.kb.isMouseDown = true;
  var g = MathYlem.activeMathYlem;
  if (g) {
    while (n != null) {
      if (n === g.editor) {
        if (e.shiftKey) {
          g.selectTo(e.clientX, e.clientY);
        } else {
          var loc = e.touches ? MathYlem.getLocation(e.touches[0].clientX,
            e.touches[0].clientY) : MathYlem.getLocation(e.clientX, e.clientY);
          if (!loc) {
            return;
          }
          var b = g.backend;
          b.current = loc.current;
          b.caret = loc.caret;
          b.selStatus = Backend.SEL_NONE;
        }
        g.render(true);
      } else if (n.mathylem) {
        if (n.mathylem === g) {
          g._focus = true;
          setTimeout(function () {
            g._focus = false;
          }, 500);
        } else {
          g.deactivate(true);
        }
        return;
      }
      n = n.parentNode;
    }
    n = n.parentNode;
  }
  MathYlem.activeMathYlem = null;
  for (var i in MathYlem.instances) {
    MathYlem.instances[i].deactivate(true);
  }
};

MathYlem.mouseMove = function (e) {
  var g = MathYlem.activeMathYlem;
  if (!g) {
    return;
  }
  if (!MathYlem.kb.isMouseDown) {
    var bb = g.editor;
    var rect = bb.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY > rect.bottom || e.clientY < rect.top) {
      if (g.tempCursor.node == null) {
        return;
      }
      g.tempCursor = {
        'node': null,
        'caret': 0
      };
    } else {
      var loc = MathYlem.getLocation(e.clientX, e.clientY);
      if (!loc || (loc.current === g.tempCursor.node &&
          loc.caret === g.tempCursor.caret)) {
        return;
      }
      if (loc.current === g.backend.current && loc.caret === g.backend.caret) {
        if (g.tempCursor.node == null) {
          return;
        }
        g.tempCursor = {
          'node': null,
          'caret': 0
        };
      } else {
        g.tempCursor = {
          'node': loc.current,
          'caret': loc.caret
        };
      }
    }
  } else if (!g.selectTo(e.clientX, e.clientY)) {
    return;
  }
  g.render(g.isChanged());
};

MathYlem.touchMove = function (e) {
  var g = MathYlem.activeMathYlem;
  if (!g || !g.selectTo(e.touches[0].clientX, e.touches[0].clientY)) {
    return;
  }
  g.render(g.isChanged());
};

MathYlem.prototype.selectTo = function (x, y) {
  var b = this.backend;
  var selCaret;
  var selCursor;
  if (this.backend.selStatus === Backend.SEL_NONE) {
    selCaret = this.backend.caret;
    selCursor = this.backend.current;
  } else if (this.backend.selStatus === Backend.SEL_CURSOR_AT_START) {
    selCursor = this.backend.selEnd.node;
    selCaret = this.backend.selEnd.caret;
  } else if (this.backend.selStatus === Backend.SEL_CURSOR_AT_END) {
    selCursor = this.backend.selStart.node;
    selCaret = this.backend.selStart.caret;
  }
  var loc = MathYlem.getLocation(x, y, selCursor, selCaret);
  if (!loc || (loc.current === b.current && loc.caret === b.caret)) {
    return false;
  }
  this.backend.selectTo(loc, selCursor, selCaret, true);
  return true;
};

if ('ontouchstart' in window) {
  window.addEventListener('touchstart', MathYlem.mouseDown, false);
  window.addEventListener('touchmove', MathYlem.touchMove, false);
} else {
  window.addEventListener('mousedown', MathYlem.mouseDown, false);
  window.addEventListener('mouseup', MathYlem.mouseUp, false);
  window.addEventListener('mousemove', MathYlem.mouseMove, false);
}

MathYlem.prototype.renderNode = function (t) {
  // All the interesting work is done by transform.
  // This function just adds in the cursor and selection-start cursor
  var output = '';
  if (t === 'render') {
    var root = this.backend.doc.root();
    this.backend.addPaths(root, 'm');
    this.backend.tempCursor = this.tempCursor;
    this.backend.addCursorClasses(root);
    this.backend.current.setAttribute('current', '');
    if (this.tempCursor.node) {
      this.tempCursor.node.setAttribute('temp', '');
    }
    output = this.backend.getContent('latex', true);
    this.backend.removeCursorClasses(root);
    output = output.replace(new RegExp('&amp;', 'g'), '&');
    return output;
  } else {
    output = this.backend.getContent(t);
  }
  return output;
};

MathYlem.prototype.render = function (updated) {
  if (!this.active && this.backend.doc.isBlank()) {
    katex.render(this.emptyContent, this.editor);
    return;
  }
  var tex = this.renderNode('render');
  try {
    katex.render(tex, this.editor);
  } catch (e) {
    this.backend.undo();
    this.render(false);
  }
  if (updated) {
    this.computeLocations();
  }
};

MathYlem.prototype.activate = function (focus) {
  MathYlem.activeMathYlem = this;
  this.active = true;
  this.editor.className = this.editor.className.replace(
    new RegExp('(\\s|^)mathylem_inactive(\\s|$)'), ' mathylem_active ');
  if (focus) {
    if (this.fakeInput) {
      this.fakeInput.style.top = this.editor.offsetTop + 'px';
      this.fakeInput.style.left = this.editor.offsetLeft + 'px';
      this.fakeInput.focus();
      this.fakeInput.setSelectionRange(this.fakeInput.value.length,
        this.fakeInput.value.length);
    } else {
      this.editor.focus();
    }
  }
  if (this.ready) {
    this.render(true);
    this.backend.emit('focus', { 'focused': true });
  }
};

MathYlem.prototype.deactivate = function (blur) {
  this.active = false;
  var r1 = new RegExp('(?:\\s|^)mathylem_active(?:\\s|$)');
  var r2 = new RegExp('(?:\\s|^)mathylem_inactive(?:\\s|$)');
  if (this.editor.className.match(r1)) {
    this.editor.className = this.editor.className.replace(r1,
      ' mathylem_inactive ');
  } else if (!this.editor.className.match(r2)) {
    this.editor.className += ' mathylem_inactive ';
  }
  if (blur && this.fakeInput) {
    this.fakeInput.blur();
  }
  if (this.ready) {
    this.render();
    this.backend.emit('focus', { 'focused': false });
  }
};

// Keyboard stuff

MathYlem.kb = {};

MathYlem.kb.isMouseDown = false;

/* keyboard behaviour definitions */

// keys aside from 0-9,a-z,A-Z
MathYlem.kb.chars = {
  '=': '=',
  '+': '+',
  '-': '-',
  '*': '*',
  '.': '.',
  ',': ',',
  '<': '<',
  '>': '>',
  'shift+/': '/',
  'shift+=': '+'
};
MathYlem.kb.symbols = {
  '/': 'frac',
  '%': 'mod',
  '^': 'pow',
  '_': 'sub',
  '|': 'abs',
  '!': 'fact',
  '\\': 'symbol',
  'shift+up': 'pow',
  'shift+down': 'sub'
};
MathYlem.kb.controls = {
  'up': 'up',
  'down': 'down',
  'right': 'right',
  'left': 'left',
  'alt+k': 'up',
  'alt+j': 'down',
  'alt+l': 'right',
  'alt+h': 'left',
  'space': 'spacebar',
  'home': 'home',
  'end': 'end',
  'backspace': 'backspace',
  'del': 'deleteKey',
  'mod+a': 'selectAll',
  'mod+c': 'copySelection',
  'mod+x': 'cutSelection',
  'mod+v': 'paste',
  'mod+z': 'undo',
  'mod+y': 'redo',
  'enter': 'done',
  'mod+shift+right': 'copyExtendListRight',
  'mod+shift+left': 'copyExtendListLeft',
  'mod+right': 'extendListRight',
  'mod+left': 'extendListLeft',
  'mod+up': 'extendListUp',
  'mod+down': 'extendListDown',
  'mod+shift+up': 'copyExtendListUp',
  'mod+shift+down': 'copyExtendListDown',
  'mod+backspace': 'removeListItem',
  'mod+shift+backspace': 'removeListRow',
  'shift+left': 'selectLeft',
  'shift+right': 'selectRight',
  '(': 'leftParen',
  ')': 'rightParen',
  'tab': 'tab'
};

// letters
for (var i = 65; i <= 90; i++) {
  MathYlem.kb.chars[String.fromCharCode(i).toLowerCase()] =
    String.fromCharCode(i).toLowerCase();
  MathYlem.kb.chars['shift+' + String.fromCharCode(i).toLowerCase()] =
    String.fromCharCode(i).toUpperCase();
}

// numbers
for (var i = 48; i <= 57; i++) { // eslint-disable-line no-redeclare
  MathYlem.kb.chars[String.fromCharCode(i)] = String.fromCharCode(i);
}

MathYlem.registerKeyboardHandlers = function () {
  // Firefox's special minus (needed for _ = sub binding)
  Mousetrap.addKeycodes({ 173: '-' });
  for (var i in MathYlem.kb.chars) { // eslint-disable-line no-redeclare
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.activeMathYlem) {
          return true;
        }
        MathYlem.activeMathYlem.tempCursor.node = null;
        MathYlem.activeMathYlem.backend.insertString(MathYlem.kb.chars[i]);
        MathYlem.activeMathYlem.render(true);
        return false;
      };
    }(i)));
  }
  for (var i in MathYlem.kb.symbols) { // eslint-disable-line no-redeclare
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.activeMathYlem) {
          return true;
        }
        MathYlem.activeMathYlem.tempCursor.node = null;
        MathYlem.activeMathYlem.backend.insertSymbol(MathYlem.kb.symbols[i]);
        MathYlem.activeMathYlem.render(true);
        return false;
      };
    }(i)));
  }
  for (var i in MathYlem.kb.controls) { // eslint-disable-line no-redeclare
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.activeMathYlem) {
          return true;
        }
        MathYlem.activeMathYlem.backend[MathYlem.kb.controls[i]]();
        MathYlem.activeMathYlem.tempCursor.node = null;
        MathYlem.activeMathYlem.render(['up', 'down', 'right', 'left', 'home',
          'end', 'selectLeft', 'selectRight'].indexOf(i) < 0);
        return false;
      };
    }(i)));
  }
};

module.exports = MathYlem;
