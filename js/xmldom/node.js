var xmldom = require('xmldom');
module.exports = {
  Document: (new xmldom.DOMImplementation()).createDocument().constructor,
  XMLSerializer: xmldom.XMLSerializer,
  DOMParser: xmldom.DOMParser
};

require('wicked-good-xpath').install(module.exports);
delete module.exports.Document;
