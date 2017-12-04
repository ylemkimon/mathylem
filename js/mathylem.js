/* eslint-env browser */
import Mousetrap from 'mousetrap';
import katex from 'katex';
import Editor from './backend';
import { Symbols } from './symbols';
import Cursor from './cursor';
import Doc from './doc';

// touch capable devices might have not-div-focusable virtual keyboard
// https://github.com/ylemkimon/mathylem/issues/27
const touchCapable = 'ontouchstart' in window;

export default class MathYlem extends Editor {
  static DEFAULT_CONFIG = Object.assign({}, Editor.DEFAULT_CONFIG, {
    emptyContent: '\\red{[?]}',
    toolbar: [
      {
        action: 'undo',
        icon: 'undo',
        enabled: function () {
          return this.undoData.length > 0;
        }
      }, {
        action: 'redo',
        icon: 'redo',
        enabled: function () {
          return this.redoData.length > 0;
        }
      }, {
        icon: 'separator'
      }, {
        action: ['clipboardSelection', true],
        icon: 'cut',
        enabled: function () {
          return !!this.selStatus;
        }
      }, {
        action: ['clipboardSelection', false],
        icon: 'copy',
        enabled: 3
      }, {
        action: 'paste',
        icon: 'paste',
        enabled: function () {
          return Editor.Clipboard.length > 0;
        }
      }, {
        icon: 'separator'
      }, {
        action: ['extendList', 'up', false],
        icon: 'insert-up',
        enabled: function () {
          return !!Doc.getArrayIndex(this.mainCursor.node, true);
        },
        hideWhenDisabled: true
      }, {
        action: ['extendList', 'down', false],
        icon: 'insert-down',
        enabled: 7,
        hideWhenDisabled: true
      }, {
        action: ['extendList', 'left', false],
        icon: 'insert-left',
        enabled: function () {
          return !!Doc.getArrayIndex(this.mainCursor.node);
        },
        hideWhenDisabled: true
      }, {
        action: ['extendList', 'right', false],
        icon: 'insert-right',
        enabled: 9,
        hideWhenDisabled: true
      }, {
        action: ['removeList', true],
        icon: 'remove-row',
        enabled: function () {
          const index = Doc.getArrayIndex(this.mainCursor.node, true);
          return index && index[1][0].parentNode.childElementCount > 1;
        },
        hideWhenDisabled: true
      }, {
        action: ['removeList', false],
        icon: 'remove-column',
        enabled: function () {
          const index = Doc.getArrayIndex(this.mainCursor.node);
          return index && index[0][0].parentNode.childElementCount > 1;
        },
        hideWhenDisabled: true
      }
    ]
  });

  static instances = {};
  static activeMathYlem = null;
  static isMouseDown = false;

  constructor (el, config) {
    super(Object.assign({}, MathYlem.DEFAULT_CONFIG, config));

    if (typeof el === 'string' || el instanceof String) {
      el = document.getElementById(el);
    }
    if (!el) {
      throw new Error('Invalid element.');
    } else if (el.mathylem) {
      throw new Error('MathYlem already attached.');
    }

    if (!el.id) {
      let i = 0;
      while (document.getElementById('mathylem_' + i)) {
        i++;
      }
      el.id = 'mathylem_' + i;
    }

    this.container = el;
    MathYlem.instances[el.id] = this;
    el.mathylem = this;

    this.editor = this.createEditor();
    if (this.config.toolbar) {
      this.toolbar = this.createToolbar();
    }

    this.active = true;
    this._focus = false;
    this.deactivate(true);
  };
  
  createEditor () {
    const editor = document.createElement('div');
    editor.className = 'mathylem';

    const onFocus = () => {
      if (this.active) {
        return;
      }
      this._focus = true;
      setTimeout(() => {
        this._focus = false;
      }, 500);
      this.activate(true);
    };
    const onBlur = e => {
      if (this._focus) {
        this._focus = false;
        e.target.focus();
      } else {
        if (MathYlem.activeMathYlem === self) {
          MathYlem.activeMathYlem = null;
        }
        this.deactivate(false);
      }
    };
    if (touchCapable) {
      this.fakeInput = this.createFakeInput(el);
      editor.addEventListener('click', onFocus);
      this.fakeInput.addEventListener('blur', onBlur);
    } else {
      editor.tabIndex = 0;
      editor.addEventListener('focus', onFocus);
      editor.addEventListener('blur', onBlur);
    }

    this.container.appendChild(editor);
    return editor;
  };

  createFakeInput () {
    const fakeInput = document.createElement('textarea');
    fakeInput.className = 'my-fakeinput';
    fakeInput.setAttribute('autocapitalize', 'none');
    fakeInput.setAttribute('autocomplete', 'off');
    fakeInput.setAttribute('autocorrect', 'off');
    fakeInput.setAttribute('spellcheck', 'false');
    fakeInput.value = '____________________';
    fakeInput.style.top = this.container.offsetTop + 'px';
    fakeInput.style.left = this.container.offsetLeft + 'px';

    this._processedFakeInput = 20;
    fakeInput.addEventListener('input', /*(func => {
      let timeout;
      return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          timeout = null;
          func();
        }, 100);
      };
    })*/(() => {
      for (; this._processedFakeInput >
          this.fakeInput.value.length; this._processedFakeInput--) {
        Mousetrap.trigger('backspace');
      }
      if (this.fakeInput.value.length === 0) {
        this._processedFakeInput = 20;
        this.fakeInput.value = '____________________';
      }
      for (; this._processedFakeInput <
          this.fakeInput.value.length; this._processedFakeInput++) {
        const c = this.fakeInput.value[this._processedFakeInput];
        if (c !== c.toLowerCase()) {
          Mousetrap.trigger('shift+' + c.toLowerCase());
        } else if (c === ' ') {
          Mousetrap.trigger('space');
        } else {
          Mousetrap.trigger(c);
        }
      }
    }));
    fakeInput.addEventListener('keydown', e => {
      if (e.keycode === 8) {
        Mousetrap.trigger('backspace');
        e.preventDefault();
      } else if (e.keycode === 13) {
        Mousetrap.trigger('enter');
        e.preventDefault();
      }
    });
    fakeInput.addEventListener('focus', () => {
      if (!this.active) {
        this.activate(false);
      }
    });

    this.container.appendChild(fakeInput);
    return fakeInput;
  };

  createToolbar () {
    const toolbar = document.createElement('div');
    toolbar.className = 'my-toolbar';

    const items = this.config.toolbar;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let itemEl;
      if (item.icon === 'separator') {
        itemEl = document.createElement('i');
        itemEl.innerHTML = '|';
        itemEl.className = 'separator';
      } else {
        itemEl = document.createElement('a');
        if (item.hideWhenDisabled) {
          itemEl.className = 'hide-when-disabled';
        }
        itemEl.innerHTML = '<i class="icon-' + item.icon + '"></i>';
        itemEl.setAttribute('data-target', this.container.id);
        itemEl.setAttribute('data-action', JSON.stringify(item.action));
        itemEl.addEventListener('click', MathYlem.onButtonClick);
      }
      toolbar.appendChild(itemEl);
    }

    this.container.insertBefore(toolbar, this.editor);
    return toolbar;
  };

  computeLocations () {
    let result = [];
    const elems = this.editor.getElementsByClassName('my-elem');
    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i];
      if (elem.nodeName === 'mstyle') {
        continue;
      }

      const rect = elem.getBoundingClientRect();
      const classes = elem.className.split(/\s+/);
      for (let j = 0; j < classes.length; j++) {
        const className = classes[j];
        if (className.substr(0, 3) === 'loc') {
          const lastIndex = className.lastIndexOf('-');
          result.push({
            path: className.substring(0, lastIndex),
            pos: parseInt(className.substring(lastIndex + 1)),
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            blank: classes.indexOf('my-blank') >= 0
          });
          break;
        }
      }
    }
    this.boxes = result;
  };

  static getLocation (e, selCursor) {
    const x = e.clientX;
    const y = e.clientY;

    const ylem = MathYlem.activeMathYlem;
    let minDist = Number.MAX_VALUE;
    let closest = null;
    let boxes = ylem.boxes;
    if (selCursor) {
      let path = Doc.getPath(selCursor.node);
      path = path.substring(0, path.lastIndexOf('_'));
      boxes = boxes.filter(
        box => box.path.substring(0, box.path.lastIndexOf('_')) === path);
    }
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const xdist = Math.max(box.left - x, x - box.right, 0);
      const ydist = Math.max(box.top - y, y - box.bottom, 0);
      const dist = Math.sqrt(xdist * xdist + ydist * ydist);
      if (dist < minDist) {
        minDist = dist;
        closest = box;
      }
    }

    const loc = closest.path.substring('loc_'.length).split(/_/);
    let optNode = ylem.doc.root;
    for (let i = 0; i < loc.length; i++) {
      optNode = optNode.childNodes[parseInt(loc[i])];
    }
    let optCaret = (x < (closest.left + closest.right)/2 || closest.blank) ?
      closest.pos : closest.pos + 1;

    return new Cursor(optNode, optCaret);
  };

  static mouseUp () {
    MathYlem.isMouseDown = false;
    const y = MathYlem.activeMathYlem;
    if (y) {
      y.render();
    }
  };

  static mouseDown (e) {
    let n = e.target;
    const y = MathYlem.activeMathYlem;
    while (n != null) {
      if (y && n === y.editor) {
        MathYlem.isMouseDown = true;
        if (e.shiftKey) {
          y.selectTo(e);
        } else {
          y.mainCursor = MathYlem.getLocation(e.touches ? e.touches[0] : e);
          y.clearSelection();
        }
        y.render();
      } else if (n.mathylem) {
        if (y) {
          if (n.mathylem === y) {
            y._focus = true;
            setTimeout(function () {
              y._focus = false;
            }, 500);
          } else {
            y.deactivate(true);
          }
        }
        return;
      }
      n = n.parentNode;
    }
    MathYlem.activeMathYlem = null;
    for (let i in MathYlem.instances) {
      MathYlem.instances[i].deactivate(true);
    }
  };

  static onButtonClick () {
    if (/(?:\s+|^)my-disabled(?:\s+|$)/.test(this.className)) {
      return;
    }
    MathYlem.instances[this.getAttribute('data-target')].executeAction(JSON.parse(this.getAttribute('data-action')));
  };

  static mouseMove (e) {
    const y = MathYlem.activeMathYlem;
    if (!y) {
      return;
    }
    if (!MathYlem.isMouseDown) {
      let resetTempCursor = false;
      const rect = y.editor.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY <= rect.bottom && e.clientY >= rect.top) {
        const loc = MathYlem.getLocation(e);
        if (loc.equals(y.tempCursor)) {
          return;
        } else if (!loc.equals(y.mainCursor)) {
          y.tempCursor = loc;
        } else {
          resetTempCursor = true;
        }
      } else {
        resetTempCursor = true;
      }
      if (resetTempCursor) {
        if (y.tempCursor.node == null) {
          return;
        }
        y.tempCursor.set(null);
      }
    } else if (!y.selectTo(e)) {
      return;
    }
    y.render(true);
  };

  static touchMove (e) {
    const y = MathYlem.activeMathYlem;
    if (!y || !y.selectTo(e.touches[0])) {
      return;
    }
    y.render(true);
  };

  selectTo (e) {
    const from = this.selStatus ? this.selCursor : this.mainCursor;
    const to = MathYlem.getLocation(e, from);
    if (to.equals(this.mainCursor)) {
      return false;
    }
    this.select(from, to);
    return true;
  };

  updateToolbar () {
    const toolbarConfig = this.config.toolbar;
    if (toolbarConfig) {
      let btn = this.toolbar.firstElementChild;
      let result = [];
      for (let i = 0; i < toolbarConfig.length; i++) {
        let enabled = true;
        const check = toolbarConfig[i].enabled;
        if (typeof check === 'function') {
          enabled = check.apply(this);
        } else if (typeof check === 'number') {
          enabled = result[check];
        }
        result.push(enabled);

        if (!enabled && !/(?:\s+|^)my-disabled(?:\s+|$)/.test(btn.className)) {
          btn.className += ' my-disabled';
        } else if (enabled) {
          btn.className = btn.className.replace(/(\s+|^)my-disabled(\s+|$)/, ' ');
        }
        btn = btn.nextElementSibling;
      }
    }
  }

  render (temp) {
    if (!temp) {
      this.updateToolbar();
    }

    if (!this.active && !this.latex) {
      katex.render(this.config.emptyContent, this.editor);
      return;
    }
    const tex = this.getContent('latex', true)
      .replace(/&amp;/g, '&');
    try {
      katex.render(tex, this.editor);
    } catch (e) {
      console.warn(tex); // eslint-disable-line no-console
      console.warn(e); // eslint-disable-line no-console
      this.undo();
      this.render();
    }
    this.computeLocations();
  };

  activate (focus) {
    MathYlem.activeMathYlem = this;
    this.active = true;
    this.editor.className += ' my-active';
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
    this.render();
    this.emit('focus');
  };

  deactivate (blur) {
    this.active = false;
    this.editor.className = this.editor.className.replace(/(\s+|^)my-active(\s+|$)/, ' ');
    if (blur && this.fakeInput) {
      this.fakeInput.blur();
    }
    this.render();
    this.emit('blur');
  };
}

MathYlem.Editor = Editor;
MathYlem.Doc = Doc;
MathYlem.Symbols = Symbols;
MathYlem.katex = katex;

let shortcuts = {
  '=': '=',
  '+': '+',
  '-': '-',
  '.': '.',
  'shift+/': '/',
  'shift+=': '+',

  '*': '*',
  '/': 'frac',
  '%': 'mod',
  '^': 'pow',
  '_': 'sub',
  '|': 'abs',
  '!': 'fact',
  '<': '<',
  '>': '>',
  '\\': 'symbol',
  'shift+up': 'pow',
  'shift+down': 'sub',

  '(': {
    symbol: ['replaceF', 'func', 0],
    '*': 'paren'
  },

  'up': ['moveCursor', 'up'],
  'down': ['moveCursor', 'down'],
  'right': ['moveCursor', 1],
  'left': ['moveCursor', -1],
  'alt+k': ['moveCursor', 'up'],
  'alt+j': ['moveCursor', 'down'],
  'alt+l': ['moveCursor', 1],
  'alt+h': ['moveCursor', -1],
  ')': ['moveCursor', 1, true],
  'home': 'home',
  'end': 'end',
  'shift+left': ['moveSelection', -1],
  'shift+right': ['moveSelection', 1],
  'mod+a': 'selectAll',
  'backspace': 'deleteBackward',
  'del': 'deleteForward',
  'mod+c': ['clipboardSelection', false],
  'mod+x': ['clipboardSelection', true],
  'mod+v': 'paste',
  'mod+z': 'undo',
  'mod+y': 'redo',
  'space': {
    text: ' ',
    symbol: 'autocompleteSymbol',
    '*': ['checkSymbol', true]
  },
  'enter': {
    symbol: 'completeSymbol',
    '*': ['emit', 'done']
  },
  'mod+left': ['extendList', 'left', false],
  'mod+right': ['extendList', 'right', false],
  'mod+shift+left': ['extendList', 'left', true],
  'mod+shift+right': ['extendList', 'right', true],
  ',': ['extendList', 'right', false],
  'mod+up': ['extendList', 'up', false],
  'mod+down': ['extendList', 'down', false],
  'mod+shift+up': ['extendList', 'up', true],
  'mod+shift+down': ['extendList', 'down', true],
  ';': ['extendList', 'down', false],
  'mod+backspace': ['removeList', false],
  'mod+shift+backspace': ['removeList', true]
};
for (let i = 48; i <= 57; i++) {
  shortcuts[String.fromCharCode(i)] = String.fromCharCode(i);
}
for (let i = 97; i <= 122; i++) {
  const letter = String.fromCharCode(i);
  shortcuts[letter] = letter;
  shortcuts['shift+' + letter] = String.fromCharCode(i - 32);
}

Mousetrap.addKeycodes({ 173: '-' }); // Firefox

for (let i in shortcuts) {
  Mousetrap.bind(i, () => {
    const y = MathYlem.activeMathYlem;
    if (!y) {
      return true;
    }
    y.tempCursor.set(null);
    y.executeAction(shortcuts[i]);
    return false;
  });
}

const recomputeLocations = (func => {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func();
    }, 100);
  };
})(() => {
  const y = MathYlem.activeMathYlem;
  if (y) {
    y.computeLocations();
  }
});

if (touchCapable) {
  window.addEventListener('touchstart', MathYlem.mouseDown);
  window.addEventListener('touchmove', MathYlem.touchMove);
} else {
  window.addEventListener('mousedown', MathYlem.mouseDown);
  window.addEventListener('mouseup', MathYlem.mouseUp);
  window.addEventListener('mousemove', MathYlem.mouseMove);
}
window.addEventListener('scroll', recomputeLocations);
window.addEventListener('resize', recomputeLocations);

module.exports = exports['default'];
