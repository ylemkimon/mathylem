var MathYlemSymbols = { 'symbols': {} };

MathYlemSymbols.makeRawSymbol = function (name, latex, text, group) {
  return {
    'output': { 'latex': latex, 'text': text },
    'group': group,
    'char': true,
    'type': name
  };
};

MathYlemSymbols.makeFunctionSymbol = function (name, group) {
  return {
    'output': {
      'latex': '\\' + name + '\\left({$1}\\right)',
      'text': ' ' + name + '({$1})'
    },
    'type': name,
    'group': group,
    'attrs': [{ 'delete': '1' }]
  };
};

MathYlemSymbols.makeNonLaTeXFunctionSymbol = function (name, group) {
  return {
    'output': {
      'latex': '\\mathrm{' + name + '}\\left({$1}\\right)',
      'text': ' ' + name + '({$1})' },
    'type': name,
    'group': group,
    'attrs': [{ 'delete': '1' }]
  };
};

MathYlemSymbols.addSymbols = function (name, sym) {
  var symbols = {};
  if (name === '_raw') {
    for (var i = 0; i < sym.length; i++) {
      for (var t in sym[i]['symbols']) {
        symbols[t] = MathYlemSymbols.makeRawSymbol(t, sym[i]['symbols'][t]['latex'],
          sym[i]['symbols'][t]['text'], sym[i]['group']);
      }
    }
  } else if (name === '_literal') {
    for (var j = 0; j < sym.length; j++) {
      for (var i = 0; i < sym[j]['symbols'].length; i++) { // eslint-disable-line no-redeclare
        symbols[sym[j]['symbols'][i]] = MathYlemSymbols.makeRawSymbol(
          sym[j]['symbols'][i], '\\' + sym[j]['symbols'][i],
          ' $' + sym[j]['symbols'][i] + ' ', sym[j]['group']);
      }
    }
  } else if (name === '_func') {
    for (var j = 0; j < sym.length; j++) { // eslint-disable-line no-redeclare
      for (var i = 0; i < sym[j]['symbols'].length; i++) { // eslint-disable-line no-redeclare
        symbols[sym[j]['symbols'][i]] = MathYlemSymbols.makeFunctionSymbol(
          sym[j]['symbols'][i], sym[j]['group']);
      }
    }
  } else if (name === '_func_nonlatex') {
    for (var j = 0; j < sym.length; j++) { // eslint-disable-line no-redeclare
      for (var i = 0; i < sym[j]['symbols'].length; i++) { // eslint-disable-line no-redeclare
        symbols[sym[j]['symbols'][i]] = MathYlemSymbols.makeNonLaTeXFunctionSymbol(
          sym[j]['symbols'][i], sym[j]['group']);
      }
    }
  } else {
    symbols[name] = sym;
  }
  return symbols;
};

module.exports = MathYlemSymbols;
