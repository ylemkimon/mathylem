var MathYlemUtils = {};

MathYlemUtils.CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.TEMP_SMALL_CARET = '\\cursor{0em}{0.6em}';
MathYlemUtils.TEMP_CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.SMALL_CARET = '\\cursor{-0.05em}{0.5em}';
MathYlemUtils.SEL_CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.SMALL_SEL_CARET = '\\cursor{-0.05em}{0.5em}';
MathYlemUtils.SEL_COLOR = 'red';

MathYlemUtils.isBlank = function (n) {
  return n.firstChild == null || n.firstChild.nodeValue === '';
};

MathYlemUtils.getValue = function (n) {
  return n.firstChild ? n.firstChild.nodeValue : '';
};

MathYlemUtils.getLength = function (n) {
  if (MathYlemUtils.isBlank(n) || n.nodeName === 'f') {
    return 0;
  }
  return n.firstChild.nodeValue.length;
};

MathYlemUtils.getPath = function (n) {
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
  return MathYlemUtils.getPath(n.parentNode) + '_' + name + '' + ns;
};

MathYlemUtils.isText = function (nn) {
  return nn.parentNode.getAttribute('mode') && (nn.parentNode.getAttribute(
    'mode') === 'text' || nn.parentNode.getAttribute('mode') === 'symbol');
};

MathYlemUtils.isSymbol = function (nn) {
  return nn.parentNode.getAttribute('mode') &&
    nn.parentNode.getAttribute('mode') === 'symbol';
};

MathYlemUtils.isSmall = function (nn) {
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

module.exports = MathYlemUtils;
