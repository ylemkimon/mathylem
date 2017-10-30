var xmldom = require('./xmldom/node');
var Symbols = require('./symbols.js');

var Doc = function (doc) {
  doc = doc || '<m><e></e></m>';
  this.setContent(doc);
};

Doc.isSmall = function (nn) {
  var n = nn.parentNode;
  while (n != null && n.nodeName !== 'm') {
    if (n.getAttribute('small') === 'yes') {
      return true;
    }
    n = n.parentNode;
    while (n != null && n.nodeName !== 'c') {
      n = n.parentNode;
    }
  }
  return false;
};

Doc.getFName = function (n) {
  if (n.nodeName === 'e') {
    n = n.parentNode;
  }
  if (n.parentNode.nodeName === 'f') {
    return n.parentNode.getAttribute('type');
  }
};

Doc.prototype.ensureTextNodes = function () {
  var l = this.base.getElementsByTagName('e');
  for (var i = 0; i < l.length; i++) {
    if (!l[i].firstChild) {
      l[i].appendChild(this.base.createTextNode(''));
    }
  }
};

Doc.prototype.isBlank = function () {
  if (this.base.getElementsByTagName('f').length > 0) {
    return false;
  }
  var l = this.base.getElementsByTagName('e');
  if (l.length === 1 && (!l[0].firstChild || l[0].firstChild.textContent === '')) {
    return true;
  }
  return false;
};

Doc.prototype.root = function () {
  return this.base.documentElement;
};

Doc.prototype.getContent = function (t, r) {
  if (t !== 'xml') {
    return this.render(t, this.root(), r);
  } else {
    return (new xmldom.XMLSerializer()).serializeToString(this.base);
  }
};

Doc.prototype.XPathNode = function (xpath, node) {
  node = node || this.root();
  return this.base.evaluate(xpath, node, null,
    xmldom.XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
};

Doc.prototype.XPathList = function (xpath, node) {
  node = node || this.root();
  return this.base.evaluate(xpath, node, null,
    xmldom.XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
};

Doc.prototype.setContent = function (data) {
  this.base = (new xmldom.DOMParser()).parseFromString(data, 'text/xml');
  this.ensureTextNodes();
};

var BRACKET_XPATH = "(count(./*) != 1 and not \
                  ( \
                            count(./e)=2 and \
                count(./f)=1 and \
                count(./e[string-length(text())=0])=2 and \
                ( \
                  (\
                                count(./f/c)=1 and\
                    count(./f/c[@is_bracket='yes'])=1\
                  )\
                  or\
                  (\
                    f/@c='yes' and \
                count(./e[@current='yes'])=0 and \
                count(./e[@temp='yes'])=0 \
                  )\
                )\
              )\
            )  \
            or\
                (\
              count(./*) = 1 and \
              string-length(./e/text()) != 1 and \
              number(./e/text()) != ./e/text() \
            ) \
            or \
                ( \
              count(./*) = 1 and \
              ./e/@current = 'yes' \
            ) \
            or \
                ( \
              count(./*) = 1 and \
              ./e/@temp = 'yes' \
            )";

Doc.prototype.render = function (t, n, r) {
  var ans = '';
  if (n.nodeName === 'e') {
    if (t === 'latex' && r) {
      ans = n.getAttribute('render');
    } else if (t === 'text') {
      ans = n.textContent;
      if (n.previousSibling && n.nextSibling && ans === '' &&
          Symbols.symbols[n.previousSibling.getAttribute('type')].operator &&
          Symbols.symbols[n.nextSibling.getAttribute('type')].operator) {
        ans = '*';
      } else {
        ans = ans.replace(/([a-zA-Z])(?=\.)/g, '$1*');
        ans = ans.replace(/(\.)(?=[a-zA-Z])/g, '$1*');
        ans = ans.replace(/([a-zA-Z])(?=[a-zA-Z0-9])/g, '$1*');
        ans = ans.replace(/([a-zA-Z0-9])(?=[a-zA-Z])/g, '$1*');
        if (n.previousSibling &&
            Symbols.symbols[n.previousSibling.getAttribute('type')].operator) {
          ans = ans.replace(/^([a-zA-Z0-9])/g, '*$1');
        }
        if (n.nextSibling &&
            Symbols.symbols[n.nextSibling.getAttribute('type')].operator) {
          ans = ans.replace(/([a-zA-Z0-9])$/g, '$1*');
        }
      }
    } else {
      ans = n.textContent;
    }
  } else if (n.nodeName === 'f') {
    var cs = [];
    for (var nn = n.firstChild; nn != null; nn = nn.nextSibling) { // eslint-disable-line no-redeclare
      cs.push(this.render(t, nn, r));
    }

    var s = Symbols.symbols[n.getAttribute('type')];
    var type = t;
    if (t === 'latex' && Doc.isSmall(n) && 'small_latex' in s['output']) {
      type = 'small_latex';
    }
    var out = s['output'][type].split(/(\{\$[0-9]+(?:\{[^}]+\})*\})/g);
    for (var i = 0; i < out.length; i++) {
      var m = out[i].match(/^\{\$([0-9]+)((?:\{[^}]+\})*)\}$/);
      if (!m) {
        ans += out[i];
      } else {
        if (m[2].length === 0) {
          ans += cs[parseInt(m[1]) - 1];
        } else {
          var mm = m[2].match(/\{[^}]*\}/g);
          var joiner = function (d, l) {
            if (d > 1) {
              for (var k = 0; k < l.length; k++) {
                l[k] = joiner(d - 1, l[k]);
              }
            }
            return l.join(mm[d - 1].substring(1, mm[d - 1].length - 1));
          };
          ans += joiner(mm.length, cs[parseInt(m[1]) - 1]);
        }
      }
    }
  } else if (n.nodeName === 'l') {
    ans = [];
    var i = 0; // eslint-disable-line no-redeclare
    for (var nn = n.firstChild; nn != null; nn = nn.nextSibling) { // eslint-disable-line no-redeclare
      ans[i++] = this.render(t, nn, r);
    }
  } else if (n.nodeName === 'c' || n.nodeName === 'm') {
    for (var nn = n.firstChild; nn != null; nn = nn.nextSibling) { // eslint-disable-line no-redeclare
      ans += this.render(t, nn, r);
    }
    if (t === 'latex' &&
                n.getAttribute('bracket') === 'yes' &&
                this.base.evaluate(BRACKET_XPATH, n, null,
                  xmldom.XPathResult.BOOLEAN_TYPE, null).booleanValue) {
      ans = '\\left(' + ans + '\\right)';
    }
  }
  return ans;
};

module.exports = Doc;
