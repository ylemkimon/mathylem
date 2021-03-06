/* eslint-env browser */
export const MODKEY = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control';

export const KEYCODE_MAP = {
  // 32: , 48-57: 0-9, 59: ;, 60: <, 61: =, 64: @, 65-90: a-z
  3: 'Cancel',
  8: 'Backspace',
  9: 'Tab',
  10: 'Enter',
  12: 'Clear',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'CapsLock',
  27: 'Escape',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  39: 'ArrowRight',
  38: 'ArrowUp',
  40: 'ArrowDown',
  44: 'PrintScreen',
  45: 'Insert',
  46: 'Delete',
  91: 'Meta',
  93: 'Meta',
  96: '0',
  97: '1',
  98: '2',
  99: '3',
  100: '4',
  101: '5',
  102: '6',
  103: '7',
  104: '8',
  105: '9',
  106: '*',
  107: '+',
  109: '-',
  110: '.',
  111: '/',
  112: 'F1',
  113: 'F2',
  114: 'F3',
  115: 'F4',
  116: 'F5',
  117: 'F6',
  118: 'F7',
  119: 'F8',
  120: 'F9',
  121: 'F10',
  122: 'F11',
  123: 'F12',
  124: 'F13',
  125: 'F14',
  126: 'F15',
  127: 'F16',
  128: 'F17',
  129: 'F18',
  130: 'F19',
  131: 'F20',
  132: 'F21',
  133: 'F22',
  134: 'F23',
  135: 'F24',
  144: 'NumLock',
  145: 'ScrollLock',
  160: '^',
  161: '!',
  163: '#',
  164: '$',
  169: ')',
  170: '*',
  171: '+',
  172: '|',
  173: '-',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  194: '.',
  219: '[',
  220: '\\',
  221: ']',
  222: '\'',
  224: 'Meta',
};

export const KEY_MAP = {
  Esc: 'Escape',
  Spacebar: ' ',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Del: 'Delete',
  Decimal: '.',
  Multiply: '*',
  Add: '+',
  Divide: '/',
  Substract: '-',
  Scroll: 'ScrollLock',
};
