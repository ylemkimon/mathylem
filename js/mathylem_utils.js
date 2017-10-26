var MathYlemUtils = {};

MathYlemUtils.CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.TEMP_SMALL_CARET = '\\cursor{0em}{0.6em}';
MathYlemUtils.TEMP_CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.SMALL_CARET = '\\cursor{-0.05em}{0.5em}';
MathYlemUtils.SEL_CARET = '\\cursor{-0.2ex}{0.7em}';
MathYlemUtils.SMALL_SEL_CARET = '\\cursor{-0.05em}{0.5em}';
MathYlemUtils.SEL_COLOR = 'red';

MathYlemUtils.is_blank = function (n) {
  return n.firstChild == null || n.firstChild.nodeValue == '';
};

MathYlemUtils.get_value = function (n) {
  return n.firstChild ? n.firstChild.nodeValue : '';
};

MathYlemUtils.get_length = function (n) {
  if (MathYlemUtils.is_blank(n) || n.nodeName == 'f') return 0;
  return n.firstChild.nodeValue.length;
};

MathYlemUtils.path_to = function (n) {
  var name = n.nodeName;
  if (name == 'm') return 'mathylem_loc_m';
  var ns = 0;
  for (var nn = n; nn != null; nn = nn.previousSibling) if (nn.nodeType == 1 && nn.nodeName == name) ns++;
  return MathYlemUtils.path_to(n.parentNode) + '_' + name + '' + ns;
};

MathYlemUtils.is_text = function (nn) {
  return nn.parentNode.getAttribute('mode') && (nn.parentNode.getAttribute('mode') == 'text' || nn.parentNode.getAttribute('mode') == 'symbol');
};

MathYlemUtils.is_symbol = function (nn) {
  return nn.parentNode.getAttribute('mode') && nn.parentNode.getAttribute('mode') == 'symbol';
};

MathYlemUtils.is_small = function (nn) {
  var n = nn.parentNode;
  while (n != null && n.nodeName != 'm') {
    if (n.getAttribute('small') == 'yes') {
      return true;
    }
    n = n.parentNode;
    while (n != null && n.nodeName != 'c') { n = n.parentNode }
  }
  return false;
};

module.exports = MathYlemUtils;
