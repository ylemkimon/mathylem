var mathylem;

$('document').ready(function () {
  // MathYlem.staticRenderAll();
  $('#xml_btn').on('click', function () {
    createText('xml');
  });
  $('#text_btn').on('click', function () {
    createText('text');
  });
  $('#latex_btn').on('click', function () {
    createText('latex');
  });
  $('#clear_btn').on('click', function () {
    $('#stuff')[0].innerHTML = '';
  });

  mathylem = new MathYlem('mathylem1', {
    'events': {
      'right_end': function () {},
      'left_end': function () {},
      'done': function () {
        createText('text');
      }
    },
    'options': {
      'emptyContent': '\\gray{\\text{Click here to start' +
        ' typing a mathematical expression}}'
    }
  });
});

function createText (texttype) {
  if (!mathylem) {
    return;
  }
  var text = mathylem.backend.getContent(texttype);
  if (texttype === 'xml') {
    text = formatXml(text);
  }
  $('#stuff').text(texttype.toUpperCase() + ':\n' + text);
}

function formatXml (xml) {
  /*
  The MIT License (MIT)

  Copyright (c) 2016 Stuart Powers

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  */
  var formatted = '';
  var reg = /(>)(<)(\/*)/g;
  xml = xml.replace(reg, '$1\n$2$3');
  var pad = 0;
  $.each(xml.split('\n'), function (index, node) {
    var indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    var padding = '';
    for (var i = 0; i < pad; i++) {
      padding += '  ';
    }

    formatted += padding + node + '\n';
    pad += indent;
  });
  formatted = formatted.replace(/<e>\s+<\/e>/g, '<e></e>');

  return formatted;
}
