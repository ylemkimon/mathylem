var Utils = {};

Utils.CARET = '\\cursor{-0.2ex}{0.7em}';
Utils.TEMP_SMALL_CARET = '\\cursor{0em}{0.6em}';
Utils.TEMP_CARET = '\\cursor{-0.2ex}{0.7em}';
Utils.SMALL_CARET = '\\cursor{-0.05em}{0.5em}';
Utils.SEL_CARET = '\\cursor{-0.2ex}{0.7em}';
Utils.SMALL_SEL_CARET = '\\cursor{-0.05em}{0.5em}';
Utils.SEL_COLOR = 'red';

Utils.isBlank = function (n) {
  return n.firstChild == null || n.firstChild.nodeValue === '';
};

Utils.getValue = function (n) {
  return n.firstChild ? n.firstChild.nodeValue : '';
};

Utils.getLength = function (n) {
  if (Utils.isBlank(n) || n.nodeName === 'f') {
    return 0;
  }
  return n.firstChild.nodeValue.length;
};

Utils.getPath = function (n) {
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
  return Utils.getPath(n.parentNode) + '_' + name + '' + ns;
};

Utils.isText = function (nn) {
  return nn.parentNode.getAttribute('mode') && (nn.parentNode.getAttribute(
    'mode') === 'text' || nn.parentNode.getAttribute('mode') === 'symbol');
};

Utils.isSymbol = function (nn) {
  return nn.parentNode.getAttribute('mode') &&
    nn.parentNode.getAttribute('mode') === 'symbol';
};

Utils.isSmall = function (nn) {
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

module.exports = Utils;
