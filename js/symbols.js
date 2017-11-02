var Symbols = { 'symbols': {} };
var defaultSymbols = require('../data/symbols.json');

Symbols.makeRawSymbol = function (name, latex) {
  return {
    'output': { 'latex': latex, 'text': name },
    'char': true
  };
};

Symbols.makeOperatorSymbol = function (name, latex) {
  return {
    'output': { 'latex': latex, 'text': name },
    'char': true,
    'operator': true
  };
};

Symbols.makeFunctionSymbol = function (name, nonLaTeX) {
  return {
    'output': {
      'latex': '\\' + (!nonLaTeX ? name : 'mathrm{' + name + '}') +
        '\\left({$1}\\right)',
      'text': name + '({$1})'
    },
    'attrs': [{ 'delete': 1 }]
  };
};

Symbols.addSymbols = function (symbols) {
  if (typeof symbols === 'string' || symbols instanceof String) {
    symbols = JSON.parse(symbols);
  }

  for (var name in symbols) {
    var symbol = symbols[name];
    switch (name) {
      case '_operator':
        for (var t in symbol) {
          Symbols.symbols[t] = Symbols.makeOperatorSymbol(t, symbol[t]);
        }
        break;
      case '_greek':
        for (var i = 0; i < symbol.length; i++) {
          Symbols.symbols[symbol[i]] = Symbols.makeRawSymbol(symbol[i],
            '\\' + symbol[i]);
        }
        break;
      case '_func':
      case '_func_nonlatex':
        for (var i = 0; i < symbol.length; i++) { // eslint-disable-line no-redeclare
          Symbols.symbols[symbol[i]] = Symbols.makeFunctionSymbol(symbol[i],
            name === '_func_nonlatex');
        }
        break;
      default:
        Symbols.symbols[name] = symbol;
        break;
    }
  }
};

Symbols.addSymbols(defaultSymbols);
module.exports = Symbols;
