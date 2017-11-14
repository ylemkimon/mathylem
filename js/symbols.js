var Symbols = { symbols: {} };
var defaultSymbols = {
  text: {
    output: {
      latex: '\\text{{$1}}',
      text: "'{$1}'"
    },
    attrs: [
      {
        text: true
      }
    ]
  },
  symbol: {
    output: {
      latex: '\\backslash\\texttt{{$1}}',
      text: '{$1}'
    },
    attrs: [
      {
        text: true
      }
    ]
  },
  func: {
    output: {
      latex: '\\backslash\\mathrm{{$1}}\\left( {$2{ , }} \\right)',
      text: '$1({$2{,}})'
    },
    attrs: [
      {
        text: true
      }
    ]
  },
  abs: {
    output: {
      latex: '\\left|{$1}\\right|',
      text: 'abs({$1})'
    },
    current: 1,
    attrs: [
      {
        delete: 1
      }
    ]
  },
  sqrt: {
    output: {
      latex: '\\sqrt{{$1}}',
      text: 'sqrt({$1})'
    },
    attrs: [
      {
        delete: 1
      }
    ]
  },
  exp: {
    output: {
      latex: 'e^{{$1}}',
      text: 'exp({$1})'
    },
    attrs: [
      {
        delete: 1,
        small: true
      }
    ]
  },
  fact: {
    output: {
      latex: '{{$1}}!',
      text: 'factorial({$1})'
    },
    current: 1,
    current_type: 'token',
    attrs: [
      {
        delete: 1,
        bracket: true
      }
    ]
  },
  binom: {
    output: {
      latex: '\\displaystyle\\binom{{$1}}{{$2}}',
      small_latex: '\\binom{{$1}}{{$2}}',
      text: 'binomial({$1},{$2})'
    },
    attrs: [
      {
        down: 2
      },
      {
        up: 1
      }
    ]
  },
  paren: {
    output: {
      latex: '\\left({$1}\\right)',
      text: '({$1})'
    },
    current: 1,
    attrs: [
      {
        delete: 1
      }
    ]
  },
  floor: {
    output: {
      latex: '\\lfloor{$1}\\rfloor',
      text: 'floor({$1})'
    },
    attrs: [
      {
        delete: 1
      }
    ]
  },
  pow: {
    output: {
      latex: '{{$1}}^{{$2}}',
      text: '({$1})**({$2})'
    },
    current: 1,
    current_type: 'token',
    attrs: [
      {
        up: 2,
        bracket: true,
        delete: 1
      },
      {
        down: 1,
        delete: 1,
        small: true
      }
    ]
  },
  sub: {
    output: {
      latex: '{{$1}}_{{$2}}',
      text: '{$1}_{$2}'
    },
    current: 1,
    current_type: 'token',
    attrs: [
      {
        down: 2,
        bracket: true,
        delete: 1
      },
      {
        up: 1,
        delete: 1,
        small: true
      }
    ]
  },
  frac: {
    output: {
      latex: '\\dfrac{{$1}}{{$2}}',
      small_latex: '\\frac{{$1}}{{$2}}',
      text: '({$1})/({$2})'
    },
    current: 1,
    current_type: 'token',
    attrs: [
      {
        down: 2
      },
      {
        up: 1
      }
    ]
  },
  mod: {
    output: {
      latex: '{$1}\\bmod{$2}',
      text: '({$1})%({$2})'
    },
    current: 1,
    current_type: 'token',
    attrs: [
      {
        down: 2,
        delete: 1,
        bracket: true
      },
      {
        up: 1,
        delete: 1,
        bracket: true
      }
    ]
  },
  infty: {
    output: {
      latex: '\\infty',
      text: 'oo'
    },
    char: true
  },
  zoo: {
    output: {
      latex: '\\tilde{\\infty}',
      text: 'zoo'
    },
    char: true
  },
  lim: {
    output: {
      latex: '\\displaystyle\\lim_{{$1}\\to{$2}}{$3}',
      small_latex: '\\lim_{{$1}\\to{$2}}{$3}',
      text: 'Limit({$3},{$1},{$2})'
    },
    attrs: [
      {
        up: 3,
        small: true
      },
      {
        up: 3,
        small: true
      },
      {
        down: 2,
        delete: 3,
        bracket: true
      }
    ]
  },
  antid: {
    output: {
      latex: '\\displaystyle\\int{{$1}}d{$2}',
      small_latex: '\\int{{$1}}d{$2}',
      text: 'Integral({$1},{$2})'
    },
    attrs: [
      {
        delete: 1
      },
      {
        delete: 1,
        bracket: true
      }
    ]
  },
  int: {
    output: {
      latex: '\\displaystyle\\int_{{$1}}^{{$2}}{$3}d{$4}',
      small_latex: '\\int_{{$1}}^{{$2}}{$3}d{$4}',
      text: 'Integral({$3},({$4},{$1},{$2}))'
    },
    attrs: [
      {
        up: 2,
        small: true
      },
      {
        down: 1,
        small: true
      },
      {
        down: 1,
        up: 2,
        delete: 3
      },
      {
        down: 1,
        up: 2,
        bracket: true,
        delete: 3
      }
    ]
  },
  deriv: {
    output: {
      latex: '\\dfrac{d}{d{$1}}{$2}',
      small_latex: '\\frac{d}{d{$1}}{$2}',
      text: 'Derivative({$2},{$1})'
    },
    attrs: [
      {
        up: 2,
        bracket: true
      },
      {
        down: 1,
        delete: 2,
        bracket: true
      }
    ]
  },
  sum: {
    output: {
      latex: '\\displaystyle\\sum_{{$1}={$2}}^{{$3}}{$4}',
      small_latex: '\\sum_{{$1}={$2}}^{{$3}}{$4}',
      text: 'Sum({$4},({$1},{$2},{$3}))'
    },
    attrs: [
      {
        up: 3,
        small: true
      },
      {
        up: 3,
        small: true
      },
      {
        down: 2,
        small: true
      },
      {
        down: 2,
        up: 3,
        delete: 4,
        bracket: true
      }
    ]
  },
  prod: {
    output: {
      latex: '\\displaystyle\\prod_{{$1}={$2}}^{{$3}}{$4}',
      small_latex: '\\prod_{{$1}={$2}}^{{$3}}{$4}',
      text: 'Product({$4},({$1},{$2},{$3}))'
    },
    attrs: [
      {
        up: 3,
        small: true
      },
      {
        up: 3,
        small: true
      },
      {
        down: 2,
        small: true
      },
      {
        down: 2,
        up: 3,
        delete: 4,
        bracket: true
      }
    ]
  },
  root: {
    output: {
      latex: '\\sqrt[{$1}]{{$2}}',
      text: 'root({$2},{$1})'
    },
    attrs: [
      {
        down: 2,
        small: true,
        delete: 2
      },
      {
        up: 1,
        delete: 2
      }
    ]
  },
  list: {
    output: {
      latex: '\\left[ {$1{ , }} \\right]',
      text: '[{$1{,}}]'
    }
  },
  set: {
    output: {
      latex: '\\left\\{ {$1{ , }} \\right\\}',
      text: '{{$1{,}}}'
    }
  },
  tuple: {
    output: {
      latex: '\\left\\langle {$1{ , }} \\right\\rangle',
      text: '({$1{,}})'
    }
  },
  mat: {
    output: {
      latex: '\\left(\\begin{matrix} {$1{ & }{\\\\}} \\end{matrix}\\right)',
      text: 'Matrix([[{$1{,}{],[}}]])'
    }
  },
  _func_nonlatex: {
    builder: function (name) { return {
      output: {
        latex: '\\mathrm{' + name + '}\\left({$1}\\right)',
        text: name + '({$1})'
      },
      attrs: [
        {
          delete: 1
        }
      ]
    }; },
    arguments: [
      'sech',
      'csch',
      'asin',
      'acos',
      'atan',
      'acot',
      'asec',
      'acsc',
      'asinh',
      'acosh',
      'atanh',
      'acoth',
      'asech',
      'acsch'
    ]
  },
  _func: {
    builder: function (name) { return {
      output: {
        latex: '\\' + name + '\\left({$1}\\right)',
        text: name + '({$1})'
      },
      attrs: [
        {
          delete: 1
        }
      ]
    }; },
    arguments: [
      'sin',
      'cos',
      'tan',
      'sec',
      'csc',
      'cot',
      'log',
      'ln',
      'sinh',
      'cosh',
      'tanh',
      'coth',
      'Re',
      'Im',
      'arg'
    ]
  },
  _operator: {
    builder: function (name, ...subs) { return {
      output: {
        latex: subs[0],
        text: name
      },
      char: true,
      operator: true
    }; },
    arguments: [
      ['*', '\\cdot'],
      ['<=', '\\leq'],
      ['<', '<'],
      ['>=', '\\geq'],
      ['>', '>']
    ]
  },
  _greek: {
    builder: function (name) { return {
      output: {
        latex: '\\' + name,
        text: name
      },
      char: true
    }; },
    arguments: [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'theta',
      'iota',
      'kappa',
      'lambda',
      'mu',
      'nu',
      'xi',
      'omicron',
      'pi',
      'rho',
      'sigma',
      'tau',
      'upsilon',
      'phi',
      'chi',
      'psi',
      'omega',
      'Gamma',
      'Delta',
      'Theta',
      'Lambda',
      'Xi',
      'Pi',
      'Sigma',
      'Upsilon',
      'Phi',
      'Psi',
      'Omega',
      'eta'
    ]
  }
};

Symbols.addSymbols = function (symbols) {
  if (typeof symbols === 'string' || symbols instanceof String) {
    symbols = JSON.parse(symbols);
  }

  for (var name in symbols) {
    var symbol = symbols[name];
    if (symbol['builder']) {
      for (var i = 0; i < symbol['arguments'].length; i++) {
        var item = symbol['arguments'][i];
        if (Array.isArray(item)) {
          Symbols.symbols[item[0]] = symbol['builder'](...item);
        } else {
          Symbols.symbols[item] = symbol['builder'](item);
        }
      }
    } else {
      Symbols.symbols[name] = symbol;
    }
  }
};

Symbols.addSymbols(defaultSymbols);
module.exports = Symbols;
