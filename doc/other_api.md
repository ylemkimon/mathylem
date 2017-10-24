## Auxiliary APIs

A few additional objects beyond the main editor are documented here:

* `MathYlemDoc` found in `build/mathylem_doc.min.js`: For manipulating standalone
  documents.  For example, if you have an XML string and want to load
  it as a MathYlem document, convert it to LaTeX, or run an XPath query
  on it, this class has that functionality.

* `MathYlemRender` found in `build/mathylem_render.min.js`: For rendering
  documents found on the page.


### `MathYlemDoc`

#### Constructor

* `new MathYlemDoc(doc)`: Takes an XML string `doc` and creates a MathYlem
  document from it.

  * `doc` is a string which should be valid MathYlem XML.

#### Instance methods

* `get_content(format)`: Return the content of the document.

  * `format` is a string--either `"latex"`, `"text"`, or `"xml"`.
    Determines the format of in which to return the content.

* `set_content(xml_data)`: Sets the content of the document.

  * `xml_data` is a string which should be valid MathYlem XML.

* `xpath_node(xpath)`: Returns the first node matching the given xpath
  expression.

  * `xpath`: A string containing XPath.  

* `xpath_list(xpath)`: Returns an iterator over all nodes matching the
  given XPath expression.

  * `xpath`: A string containing XPath.  

* `get_symbols(groups)`: Returns a list of all string types of symbols
  involved in any of the groups in `groups`.

  * `groups` is either empty (in which case all symbol types will be
    returned) or an array of string names of groups whose symbol types
    should be included.

* `root()`: Returns an Element object for the root node of the
  document.


### `MathYlemRender`

#### Static methods

* `MathYlemRender.render_all()`: Renders all MathYlem XML documents found on
  the page.  These should be placed in script tags with
  `type="mathylem_xml"` in the source before this function is called.

  For example if the page has

  ```<script type="mathylem_xml"><m><e>x+1</e></m></script>```

  Then a call to `MathYlemRender.render_all()` will replace this element with a
  span containing the renered equation.

* `MathYlemRender.render(doc, target_id)`: Render the provided XML
  document in the element `#target_id`.

  * `doc`: A string representing the XML document to be rendered

  * `target_id`: The ID of an element on the page into which the
    rendered content should be placed.
