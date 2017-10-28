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

  MathYlem.initialize(['build/symbols.json']);
  mathylem = new MathYlem('mathylem1', {
    'events': {
      'right_end': function () {},
      'left_end': function () {},
      'done': function () {
        createText('text');
      },
      'completion': completion
    },
    'options': {
      'emptyContent': '\\gray{\\text{Click here to start' +
        ' typing a mathematical expression}}'
    }
  });
});

function completion (data) {
  $('#stuff').text('INFO:\n' + data.candidates.join(', '));
}

function createText (texttype) {
  if (!mathylem) {
    return;
  }
  $('#stuff').text(texttype.toUpperCase() + ':\n' +
    mathylem.backend.getContent(texttype));
}
