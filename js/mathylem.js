Mousetrap = require('mousetrap');
katex = require('../lib/katex/katex-modified.min.js');
MathYlemBackend = require('./mathylem_backend.js');
MathYlemUtils = require('./mathylem_utils.js');
MathYlemSymbols = require('./mathylem_symbols.js');
debounce = require('throttle-debounce/debounce');

var MathYlem = function (mathylem_div, config) {
  var self = this;
  var config = config || {};
  var options = config['options'] || {};

  if (typeof mathylem_div == 'string' || mathylem_div instanceof String) {
    mathylem_div = document.getElementById(mathylem_div);
  }

  if (!(mathylem_div.id)) {
    var i = MathYlem.max_uid || 0;
    while (document.getElementById('mathylem_uid_' + i)) i++;
    MathYlem.max_uid = i;
    mathylem_div.id = 'mathylem_uid_' + i;
  }
  mathylem_div.className += " mathylem";
  var i = MathYlem.max_tabIndex || 0;
  mathylem_div.tabIndex = i;
  MathYlem.max_tabIndex = i + 1;

  this.editor_active = true;
  this.empty_content = options['empty_content'] || '\\red{[?]}';
  this.editor = mathylem_div;
  this.blacklist = [];
  this.maintain_focus = false;
  this.processed_fake_input = 20;
  this.autoreplace = true;
  this.ready = false;

  MathYlem.instances[mathylem_div.id] = this;

  config['parent'] = self;

  if (/Mobi/.test(navigator.userAgent)) {
    var fakeInput = document.createElement('textarea');
    this.fakeInput = fakeInput;

    fakeInput.setAttribute('id', 'fakeInput_' + mathylem_div.id);
    fakeInput.setAttribute('autocapitalize', 'none');
    fakeInput.setAttribute('autocomplete', 'off');
    fakeInput.setAttribute('autocorrect', 'off');
    fakeInput.setAttribute('spellcheck', 'false');
    mathylem_div.insertAdjacentElement('afterend', fakeInput);

    fakeInput.style.position = 'absolute';
    fakeInput.style.top = mathylem_div.offsetTop + 'px';
    fakeInput.style.left = mathylem_div.offsetLeft + 'px';
    fakeInput.style.width = '1px';
    fakeInput.style.height = '1px';
    fakeInput.style.opacity = 0;
    fakeInput.style.padding = 0;
    fakeInput.style.margin = 0;
    fakeInput.style.border = 0;
    fakeInput.addEventListener('input', debounce(100, function () {
      for (; self.processed_fake_input > self.fakeInput.value.length; self.processed_fake_input--) {
        Mousetrap.trigger('backspace');
      }
      if (self.fakeInput.value.length == 0) {
        self.processed_fake_input = 20;
        self.fakeInput.value = '____________________';
      }
      for (; self.processed_fake_input < self.fakeInput.value.length; self.processed_fake_input++) {
        var c = self.fakeInput.value[self.processed_fake_input];
        if (c != c.toLowerCase()) { Mousetrap.trigger('shift+' + c.toLowerCase()) } else if (c == ' ') { Mousetrap.trigger('space') } else { Mousetrap.trigger(c) }
      }
    }));
    fakeInput.addEventListener('keydown', function (e) {
      if (e.keycode == 8) {
        Mousetrap.trigger('backspace');
        e.preventDefault();
      } else if (e.keycode == 13) {
        Mousetrap.trigger('enter');
        e.preventDefault();
      }
    });
    fakeInput.addEventListener('focus', function () {
      self.activate(false);
    });
    fakeInput.addEventListener('blur', function () {
      if (self.maintain_focus) {
        self.maintain_focus = false;
        this.focus();
      } else { self.deactivate(false) }
    });
    fakeInput.value = '____________________';
  }

  this.backend = new MathYlemBackend(config);
  this.temp_cursor = {'node': null, 'caret': 0};
  this.editor.addEventListener('click', function () {
    var g = MathYlem.instances[this.id];
    var b = g.backend;
    if (g.editor_active) { return }
    g.maintain_focus = true;
    setTimeout(function () {
      g.maintain_focus = false;
    }, 500);
    b.sel_clear();
    b.current = b.doc.root().lastChild;
    b.caret = MathYlemUtils.get_length(b.current);
    g.activate(true);
  });
  if (MathYlem.ready && !this.ready) {
    this.ready = true;
    this.backend.fire_event('ready');
    this.render(true);
  }
  this.deactivate(true);
  this.recompute_locations_paths();
};

MathYlem.instances = {};
MathYlem.ready = false;

MathYlem.active_mathylem = null;

MathYlem.add_symbols = function (symbols) {
  for (var s in symbols) {
    var new_syms = MathYlemSymbols.add_symbols(s, symbols[s], MathYlemSymbols.symbols);
    for (var s in new_syms) { MathYlemSymbols.symbols[s] = new_syms[s] }
  }
  for (var i in MathYlem.instances) {
    for (var s in symbols) {
      MathYlem.instances[i].backend.symbols[s] = JSON.parse(JSON.stringify(symbols[s]));
    }
  }
};

MathYlem.set_global_symbols = function (symbols) {
  MathYlemSymbols.symbols = {};
  MathYlem.add_symbols(symbols);
};

MathYlem.reset_global_symbols = function () {
  for (var i in MathYlem.instances) {
    MathYlem.instances[i].backend.symbols = JSON.parse(JSON.stringify(MathYlemSymbols.symbols));
  }
};

MathYlem.init_symbols = function (symbols) {
  var all_ready = function () {
    MathYlem.register_keyboard_handlers();
    for (var i in MathYlem.instances) {
      MathYlem.instances[i].ready = true;
      MathYlem.instances[i].render(true);
      MathYlem.instances[i].backend.symbols = JSON.parse(JSON.stringify(MathYlemSymbols.symbols));
      MathYlem.instances[i].backend.fire_event('ready');
    }
    MathYlemBackend.ready = true;
  };
  if (!(Array.isArray(symbols))) {
    symbols = [symbols];
  }
  var calls = [];
  for (var i = 0; i < symbols.length; i++) {
    var x = (function outer (j) {
      return function (callback) {
        var req = new XMLHttpRequest();
        req.onload = function () {
          var syms = JSON.parse(this.responseText);
          for (var s in syms) {
            var new_syms = MathYlemSymbols.add_symbols(s, syms[s], MathYlemSymbols.symbols);
            for (var s in new_syms) { MathYlemSymbols.symbols[s] = new_syms[s] }
          }
          callback();
        };
        req.open('get', symbols[j], true);
        req.send();
      };
    }(i));
    calls.push(x);
  }
  calls.push(all_ready);
  var j = 0;
  var cb = function () {
    j += 1;
    if (j < calls.length) calls[j](cb);
  };
  if (calls.length > 0) calls[0](cb);
};

MathYlem.prototype.is_changed = function () {
  var bb = this.editor.getElementsByClassName('katex')[0];
  if (!bb) { return }
  var rect = bb.getBoundingClientRect();
  var ans = !this.bounding_box || this.bounding_box.top != rect.top || this.bounding_box.bottom != rect.bottom || this.bounding_box.right != rect.right || this.bounding_box.left != rect.left;
  this.bounding_box = rect;
  return ans;
};

MathYlem.prototype.recompute_locations_paths = function () {
  var ans = [];
  var bb = this.editor.getElementsByClassName('katex')[0];
  if (!bb) { return }
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
    if (elt.nodeName == 'mstyle') { continue }
    var rect = elt.getBoundingClientRect();
    if (rect.top == 0 && rect.bottom == 0 && rect.left == 0 && rect.right == 0) { continue }
    var cl = elt.className.split(/\s+/);
    for (var j = 0; j < cl.length; j++) {
      if (cl[j].startsWith('mathylem_loc')) {
        ans.push({
          'path': cl[j],
          'top': rect.top,
          'bottom': rect.bottom,
          'left': rect.left,
          'right': rect.right,
          'mid_x': (rect.left + rect.right) / 2,
          'mid_y': (rect.bottom + rect.top) / 2,
          'blank': cl.indexOf('mathylem_blank') >= 0
        });
        break;
      }
    }
  }
  this.boxes = ans;
};

MathYlem.get_loc = function (x, y, current_node, current_caret) {
  var g = MathYlem.active_mathylem;
  var min_dist = -1;
  var mid_dist = 0;
  var opt = null;
  // check if we go to first or last element
  if (current_node) {
    var current_path = MathYlemUtils.path_to(current_node);
    var current_pos = parseInt(current_path.substring(current_path.lastIndexOf('e') + 1));
  }

  var boxes = g.boxes;
  if (!boxes) { return }
  if (current_node) {
    current_path = current_path.replace(/e[0-9]+$/, 'e');
    var boxes2 = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].path == 'all') { continue }
      var loc = boxes[i].path.substring(0, boxes[i].path.lastIndexOf('_'));
      loc = loc.replace(/e[0-9]+$/, 'e');
      if (loc == current_path) {
        boxes2.push(boxes[i]);
      }
    }
    boxes = boxes2;
  }
  if (!boxes) { return }
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i];
    if (box.path == 'all') {
      if (!opt) { opt = { 'path': 'mathylem_loc_m_e1_0' } }
      continue;
    }
    var xdist = Math.max(box.left - x, x - box.right, 0);
    var ydist = Math.max(box.top - y, y - box.bottom, 0);
    var dist = Math.sqrt(xdist * xdist + ydist * ydist);
    if (min_dist == -1 || dist < min_dist) {
      min_dist = dist;
      mid_dist = x - box.mid_x;
      opt = box;
    }
  }
  var loc = opt.path.substring('mathylem_loc'.length);
  loc = loc.replace(/_/g, '/');
  loc = loc.replace(/([0-9]+)(?=.*?\/)/g, '[$1]');
  var cur = g.backend.doc.xpath_node(loc.substring(0, loc.lastIndexOf('/')), g.backend.doc.root());
  var car = parseInt(loc.substring(loc.lastIndexOf('/') + 1));
  // Check if we want the cursor before or after the element
  if (mid_dist > 0 && !(opt.blank)) {
    car++;
  }
  var ans = {
    'current': cur,
    'caret': car,
    'pos': 'none'
  };
  if (current_node && opt) {
    var opt_pos = parseInt(opt.path.substring(opt.path.lastIndexOf('e') + 1, opt.path.lastIndexOf('_')));
    if (opt_pos < current_pos) { ans['pos'] = 'left' } else if (opt_pos > current_pos) { ans['pos'] = 'right' } else if (car < current_caret) { ans['pos'] = 'left' } else if (car > current_caret) { ans['pos'] = 'right' }
  }
  return ans;
};

MathYlem.mouse_up = function (e) {
  MathYlem.kb.is_mouse_down = false;
  var g = MathYlem.active_mathylem;
  if (g) { g.render(true) }
};

MathYlem.mouse_down = function (e) {
  var n = e.target;
  MathYlem.kb.is_mouse_down = true;
  while (n != null) {
    if (n.id in MathYlem.instances) {
      var g = MathYlem.active_mathylem;
      if (MathYlem.instances[n.id] == g) {
        g.maintain_focus = true;
        setTimeout(function () {
          g.maintain_focus = false;
        }, 500);
        if (e.shiftKey) {
          g.select_to(e.clientX, e.clientY, true);
        } else {
          var loc = e.touches ? MathYlem.get_loc(e.touches[0].clientX, e.touches[0].clientY) : MathYlem.get_loc(e.clientX, e.clientY);
          if (!loc) { return }
          var b = g.backend;
          b.current = loc.current;
          b.caret = loc.caret;
          b.sel_status = MathYlemBackend.SEL_NONE;
        }
        g.render(true);
      } else if (g) { g.deactivate(true) }
      return;
    }
    n = n.parentNode;
  }
  MathYlem.active_mathylem = null;
  for (var i in MathYlem.instances) {
    MathYlem.instances[i].deactivate(true);
  }
};

MathYlem.mouse_move = function (e) {
  var g = MathYlem.active_mathylem;
  if (!g) { return }
  if (!MathYlem.kb.is_mouse_down) {
    var bb = g.editor;
    var rect = bb.getBoundingClientRect();
    if ((e.clientX < rect.left || e.clientX > rect.right) || (e.clientY > rect.bottom || e.clientY < rect.top)) {
      g.temp_cursor = {
        'node': null,
        'caret': 0
      };
    } else {
      var loc = MathYlem.get_loc(e.clientX, e.clientY);
      if (!loc) { return }
      g.temp_cursor = {
        'node': loc.current,
        'caret': loc.caret
      };
    }
  } else {
    g.select_to(e.clientX, e.clientY, true);
  }
  g.render(g.is_changed());
};

MathYlem.touch_move = function (e) {
  var g = MathYlem.active_mathylem;
  if (!g) { return }
  g.select_to(e.touches[0].clientX, e.touches[0].clientY, true);
  g.render(g.is_changed());
};

MathYlem.prototype.select_to = function (x, y, mouse) {
  var sel_caret = this.backend.caret;
  var sel_cursor = this.backend.current;
  if (this.backend.sel_status == MathYlemBackend.SEL_CURSOR_AT_START) {
    sel_cursor = this.backend.sel_end.node;
    sel_caret = this.backend.sel_end.caret;
  } else if (this.backend.sel_status == MathYlemBackend.SEL_CURSOR_AT_END) {
    sel_cursor = this.backend.sel_start.node;
    sel_caret = this.backend.sel_start.caret;
  }
  var loc = MathYlem.get_loc(x, y, sel_cursor, sel_caret);
  if (!loc) { return }
  this.backend.select_to(loc, sel_cursor, sel_caret, mouse);
};

if ('ontouchstart' in window) {
  window.addEventListener('touchstart', MathYlem.mouse_down, false);
  window.addEventListener('touchmove', MathYlem.touch_move, false);
} else {
  window.addEventListener('mousedown', MathYlem.mouse_down, false);
  window.addEventListener('mouseup', MathYlem.mouse_up, false);
  window.addEventListener('mousemove', MathYlem.mouse_move, false);
}

MathYlem.prototype.render_node = function (t) {
  // All the interesting work is done by transform.  This function just adds in the cursor and selection-start cursor
  var output = '';
  if (t == 'render') {
    var root = this.backend.doc.root();
    this.backend.add_paths(root, 'm');
    this.backend.temp_cursor = this.temp_cursor;
    this.backend.add_classes_cursors(root);
    this.backend.current.setAttribute('current', 'yes');
    if (this.temp_cursor.node) this.temp_cursor.node.setAttribute('temp', 'yes');
    output = this.backend.get_content('latex', true);
    this.backend.remove_cursors_classes(root);
    output = output.replace(new RegExp('&amp;', 'g'), '&');
    return output;
  } else {
    output = this.backend.get_content(t);
  }
  return output;
};

MathYlem.prototype.render = function (updated) {
  if (!this.editor_active && this.backend.doc.is_blank()) {
    katex.render(this.empty_content, this.editor);
    return;
  }
  var tex = this.render_node('render');
  katex.render(tex, this.editor);
  if (updated) {
    this.recompute_locations_paths();
  }
};

MathYlem.prototype.activate = function (focus) {
  MathYlem.active_mathylem = this;
  this.editor_active = true;
  this.editor.className = this.editor.className.replace(new RegExp('(\\s|^)mathylem_inactive(\\s|$)'), ' mathylem_active ');
  if (focus) {
    if (this.fakeInput) {
      this.fakeInput.style.top = this.editor.offsetTop + 'px';
      this.fakeInput.style.left = this.editor.offsetLeft + 'px';
      this.fakeInput.focus();
      this.fakeInput.setSelectionRange(this.fakeInput.value.length, this.fakeInput.value.length);
    } else { this.editor.focus() }
  }
  if (this.ready) {
    this.render(true);
    this.backend.fire_event('focus', {'focused': true});
  }
};

MathYlem.prototype.deactivate = function (blur) {
  this.editor_active = false;
  var r1 = new RegExp('(?:\\s|^)mathylem_active(?:\\s|$)');
  var r2 = new RegExp('(?:\\s|^)mathylem_inactive(?:\\s|$)');
  if (this.editor.className.match(r1)) {
    this.editor.className = this.editor.className.replace(r1, ' mathylem_inactive ');
  } else if (!this.editor.className.match(r2)) {
    this.editor.className += ' mathylem_inactive ';
  }
  if (blur && this.fakeInput) { this.fakeInput.blur() }
  if (this.ready) {
    this.render();
    this.backend.fire_event('focus', {'focused': false});
  }
};

// Keyboard stuff

MathYlem.kb = {};

MathYlem.kb.is_mouse_down = false;

/* keyboard behaviour definitions */

// keys aside from 0-9,a-z,A-Z
MathYlem.kb.k_chars = {
  '=': '=',
  '+': '+',
  '-': '-',
  '*': '*',
  '.': '.',
  ',': ',',
  'shift+/': '/',
  'shift+=': '+'
};
MathYlem.kb.k_syms = {
  '/': 'frac',
  '%': 'mod',
  '^': 'power',
  '(': 'paren',
  '<': 'less',
  '>': 'greater',
  '_': 'sub',
  '|': 'abs',
  '!': 'fact',
  'shift+up': 'power',
  'shift+down': 'sub'
};
MathYlem.kb.k_controls = {
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
  'del': 'delete_key',
  'mod+a': 'sel_all',
  'mod+c': 'sel_copy',
  'mod+x': 'sel_cut',
  'mod+v': 'sel_paste',
  'mod+z': 'undo',
  'mod+y': 'redo',
  'enter': 'done',
  'mod+shift+right': 'list_extend_copy_right',
  'mod+shift+left': 'list_extend_copy_left',
  'mod+right': 'list_extend_right',
  'mod+left': 'list_extend_left',
  'mod+up': 'list_extend_up',
  'mod+down': 'list_extend_down',
  'mod+shift+up': 'list_extend_copy_up',
  'mod+shift+down': 'list_extend_copy_down',
  'mod+backspace': 'list_remove',
  'mod+shift+backspace': 'list_remove_row',
  'shift+left': 'sel_left',
  'shift+right': 'sel_right',
  ')': 'right_paren',
  '\\': 'backslash',
  'tab': 'tab'
};

// letters

for (var i = 65; i <= 90; i++) {
  MathYlem.kb.k_chars[String.fromCharCode(i).toLowerCase()] = String.fromCharCode(i).toLowerCase();
  MathYlem.kb.k_chars['shift+' + String.fromCharCode(i).toLowerCase()] = String.fromCharCode(i).toUpperCase();
}

// numbers

for (var i = 48; i <= 57; i++) { MathYlem.kb.k_chars[String.fromCharCode(i)] = String.fromCharCode(i) }

MathYlem.register_keyboard_handlers = function () {
  Mousetrap.addKeycodes({173: '-'}); // Firefox's special minus (needed for _ = sub binding)
  for (var i in MathYlem.kb.k_chars) {
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.active_mathylem) return true;
        MathYlem.active_mathylem.temp_cursor.node = null;
        MathYlem.active_mathylem.backend.insert_string(MathYlem.kb.k_chars[i]);
        MathYlem.active_mathylem.render(true);
        return false;
      };
    }(i)));
  }
  for (var i in MathYlem.kb.k_syms) {
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.active_mathylem) return true;
        MathYlem.active_mathylem.temp_cursor.node = null;
        MathYlem.active_mathylem.backend.insert_symbol(MathYlem.kb.k_syms[i]);
        MathYlem.active_mathylem.render(true);
        return false;
      };
    }(i)));
  }
  for (var i in MathYlem.kb.k_controls) {
    Mousetrap.bind(i, (function (i) {
      return function () {
        if (!MathYlem.active_mathylem) return true;
        MathYlem.active_mathylem.backend[MathYlem.kb.k_controls[i]]();
        MathYlem.active_mathylem.temp_cursor.node = null;
        MathYlem.active_mathylem.render(['up', 'down', 'right', 'left', 'home', 'end', 'sel_left', 'sel_right'].indexOf(i) < 0);
        MathYlem.active_mathylem.render(false);
        return false;
      };
    }(i)));
  }
};

module.exports = MathYlem;
