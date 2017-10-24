katex = require('../lib/katex/katex-modified.min.js');
MathYlemDoc = require('./mathylem_doc.js');

MathYlemRender = {};

MathYlemRender.render_all = function () {
  var l = document.getElementsByTagName('script');
  var ans = [];
  for (var i = 0; i < l.length; i++) {
    if (l[i].getAttribute('type') == 'text/mathylem_xml') {
      var n = l[i];
      var d = new MathYlemDoc(n.innerHTML);
      var s = document.createElement('span');
      s.setAttribute('id', 'eqn1_render');
      katex.render(d.get_content('latex'), s);
      n.parentNode.insertBefore(s, n);
      ans.push({'container': s, 'doc': d});
    }
  }
  return ans;
};

MathYlemRender.render = function (doc, target_id) {
  var d = new MathYlemDoc(doc);
  var target = document.getElementById(target_id);
  katex.render(d.get_content('latex'), target);
  return {'container': target, 'doc': d};
};

module.exports = MathYlemRender;
