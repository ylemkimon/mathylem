export const Symbols = {};

export function addSymbols(data) {
  Object.entries(typeof data === 'string' ? JSON.parse(data) : data).forEach(([name, symbol]) => {
    if (symbol.builder) {
      symbol.args.forEach((item) => {
        if (Array.isArray(item)) {
          Symbols[item[0]] = symbol.builder(...item);
        } else {
          Symbols[item] = symbol.builder(item);
        }
      });
    } else {
      Symbols[name] = symbol;
    }
  });
}

const defaultSymbols = {
  text: {
    output: {
      latex: '\\text{{$0}}',
      text: '\'{$0}\'',
    },
    args: [
      {
        text: true,
      },
    ],
  },
  symbol: {
    output: {
      latex: '\\backslash\\texttt{{$0}}',
      text: '{$0}',
    },
    args: [
      {
        text: true,
      },
    ],
  },
  func: {
    output: {
      latex: '\\backslash\\mathrm{{$0}}\\left( {$1{ , }} \\right)',
      text: '$0({$1{,}})',
    },
    args: [
      {
        text: true,
      },
    ],
  },
  abs: {
    output: {
      latex: '\\left|{$0}\\right|',
      text: 'abs({$0})',
    },
  },
  sqrt: {
    output: {
      latex: '\\sqrt{{$0}}',
      text: 'sqrt({$0})',
    },
  },
  exp: {
    output: {
      latex: 'e^{{$0}}',
      text: 'exp({$0})',
    },
  },
  fact: {
    output: {
      latex: '{{$0}}!',
      text: 'factorial({$0})',
    },
    token: true,
    args: [
      {
        parentheses: true,
      },
    ],
  },
  binom: {
    output: {
      latex: '\\binom{{$0}}{{$1}}',
      text: 'binomial({$0},{$1})',
    },
    args: [
      {
        above: 1,
      },
      {
        below: 0,
      },
    ],
  },
  paren: {
    output: {
      latex: '\\left({$0}\\right)',
      text: '({$0})',
    },
  },
  floor: {
    output: {
      latex: '\\lfloor{$0}\\rfloor',
      text: 'floor({$0})',
    },
  },
  pow: {
    output: {
      latex: '{{$0}}^{{$1}}',
      text: '({$0})**({$1})',
    },
    token: true,
    args: [
      {
        below: 1,
        parentheses: true,
      },
      {
        above: 0,
      },
    ],
  },
  sub: {
    output: {
      latex: '{{$0}}_{{$1}}',
      text: '{$0}_{$1}',
    },
    token: true,
    args: [
      {
        above: 1,
        parentheses: true,
      },
      {
        below: 0,
      },
    ],
  },
  frac: {
    output: {
      latex: '\\frac{{$0}}{{$1}}',
      text: '({$0})/({$1})',
    },
    token: true,
    args: [
      {
        above: 1,
      },
      {
        below: 0,
      },
    ],
  },
  mod: {
    output: {
      latex: '{$0}\\bmod{$1}',
      text: '({$0})%({$1})',
    },
    token: true,
    args: [
      {
        parentheses: true,
      },
      {
        parentheses: true,
      },
    ],
  },
  infty: {
    output: {
      latex: '\\infty',
      text: 'oo',
    },
    char: true,
  },
  zoo: {
    output: {
      latex: '\\tilde{\\infty}',
      text: 'zoo',
    },
    char: true,
  },
  lim: {
    output: {
      latex: '\\lim_{{$0}\\to{$1}}{$2}',
      text: 'Limit({$2},{$0},{$1})',
    },
    main: 2,
    args: [
      {
        below: 2,
      },
      {
        below: 2,
        delete: false,
      },
      {
        above: 1,
        parentheses: true,
      },
    ],
  },
  antid: {
    output: {
      latex: '\\int{{$0}}d{$1}',
      text: 'Integral({$0},{$1})',
    },
    args: [
      null,
      {
        parentheses: true,
      },
    ],
  },
  int: {
    output: {
      latex: '\\int_{{$0}}^{{$1}}{$2}d{$3}',
      text: 'Integral({$2},({$3},{$0},{$1}))',
    },
    main: 2,
    args: [
      {
        below: 1,
      },
      {
        above: 0,
      },
      {
        above: 0,
        below: 1,
      },
      {
        above: 0,
        below: 1,
        parentheses: true,
      },
    ],
  },
  deriv: {
    output: {
      latex: '\\frac{d}{d{$0}}{$1}',
      text: 'Derivative({$1},{$0})',
    },
    main: 1,
    args: [
      {
        below: 1,
        parentheses: true,
      },
      {
        above: 0,
        parentheses: true,
      },
    ],
  },
  sum: {
    output: {
      latex: '\\sum_{{$0}={$1}}^{{$2}}{$3}',
      text: 'Sum({$3},({$0},{$1},{$2}))',
    },
    main: 3,
    args: [
      {
        below: 2,
      },
      {
        below: 2,
        delete: false,
      },
      {
        above: 1,
      },
      {
        above: 1,
        below: 2,
        parentheses: true,
      },
    ],
  },
  prod: {
    output: {
      latex: '\\prod_{{$0}={$1}}^{{$2}}{$3}',
      text: 'Product({$3},({$0},{$1},{$2}))',
    },
    main: 3,
    args: [
      {
        below: 2,
      },
      {
        below: 2,
        delete: false,
      },
      {
        above: 1,
      },
      {
        above: 1,
        below: 2,
        parentheses: true,
      },
    ],
  },
  root: {
    output: {
      latex: '\\sqrt[{$0}]{{$1}}',
      text: 'root({$1},{$0})',
    },
    main: 1,
    args: [
      {
        above: 1,
      },
      {
        below: 0,
      },
    ],
  },
  mat: {
    output: {
      latex: '\\left(\\begin{matrix} {$0{ & }{\\\\}} \\end{matrix}\\right)',
      text: 'Matrix([[{$0{,}{],[}}]])',
    },
  },
  _nonLaTeXFunc: {
    builder(name) {
      return {
        output: {
          latex: `\\mathrm{${name}}\\left({$0}\\right)`,
          text: `${name}({$0})`,
        },
      };
    },
    args: [
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
      'acsch',
    ],
  },
  _func: {
    builder(name) {
      return {
        output: {
          latex: `\\${name}\\left({$0}\\right)`,
          text: `${name}({$0})`,
        },
      };
    },
    args: [
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
      'arg',
    ],
  },
  _operator: {
    builder(name, ...subs) {
      return {
        output: {
          latex: subs[0],
          text: name,
        },
        char: true,
        op: true,
      };
    },
    args: [
      ['*', '\\cdot'],
      ['<=', '\\leq'],
      ['<', '<'],
      ['>=', '\\geq'],
      ['>', '>'],
    ],
  },
  _greek: {
    builder(name) {
      return {
        output: {
          latex: `\\${name}`,
          text: name,
        },
        char: true,
      };
    },
    args: [
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
      'eta',
    ],
  },
};
addSymbols(defaultSymbols);
