# MathYlem

## Synopsis

MathYlem is a Javascript-based WYSIWYG editor for mathematics whose
content is stored in an XML format that makes MathYlem mathematical
expressions **searchable**, **parseable**, and **renderable**.

The content of the editor can easily be extracted in a very flexible
XML format (for searching or otherwise manipulating), LaTeX (for
rendering), or a SymPy Python code format (for parsing).

## Demo

A live demo can be found at 
[https://ylemkimon.github.io/mathylem/](https://ylemkimon.github.io/mathylem/)

## Code example

A stripped-down version of the demo page would look like:

```
<html>
  <head>
    <link rel="stylesheet" href="build/mathylem.katex.min.css">
    <link rel="stylesheet" href="build/mathylem.css">
    <script type="text/javascript" src="build/mathylem.min.js"></script>
  </head>
  <body>
    <div id="mathylem_div"></div>
    
    <script>
        MathYlem.init_symbols(["build/symbols.json"]);
        new MathYlem("mathylem_div");
    </script>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('xml'))">See XML</button>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('latex'))">See LaTeX</button>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('text'))">See SymPy code</button>
  </body>
</html>
```

## Installation and deployment

* Download the `build` folder.

* Include the `build/mathylem.min.js`, `build/mathylem.katex.min.css`,
  `build/mathylem.css` files in your page.

* Pass a list of paths to symbol definition files to `MathYlem.init_symbols`
  as in the example above.  This only needs to happen once per page.
  Symbol names from files that appear later in the list will override
  symbol names from files earlier in the list.

* For each div that you want turned into a MathYlem instance, call `new
  MathYlem()` passing in as the first argument either the Element object
  for that div or its ID.

## FAQ

* How do I change the styling of the editor?

  MathYlem provides default styling at `css/mathylem.css`.

  There are multiple configuration options and CSS classes that can be
  used to customise the appearance of the editor.  See [the
  documentation](https://github.com/ylemkimon/mathylem/wiki/CSS-styling).

## Editor usage

The editor has many of the usual keyboard text-editing features:
Navigation with the arrow keys, backspace, home, end, selection with
shift-left/right, mod-z/x/c/v for undo, cut, copy, paste
(respectively).  Using the mouse to navigate and select is also
supported.

If you type the name of a mathematical object such as `sqrt`, the
editor will automatically replace that entered text with the
corresponding object.  The list of symbols supported by default is
documented in index.html (or just see the demo page).  Further symbols
can be added by modifying `symbols.json`.

## Development

When working on the editor, any changes made to the Javascript source
(e.g. [js/mathylem.js](https://github.com/ylemkimon/mathylem/blob/master/js/mathylem.js)
need to be complied by running `./make -d`).

Because the editor makes AJAX requests as part of its normal
functioning, testing is best done with a small webserver.  For
example, running

```python3 -m http.server --bind 127.0.0.1 8000```

in the root directory of the mathylem repository and then browsing to
[localhost:8000/index.html](localhost:8000/index.html) will let you
see the current state of the editor with all your modifications.  As
you're making edits, be sure to run `./make` before refreshing in
order to see your changes reflected in the page.

---

This project is tested using

[<img src="https://bstacksupport.zendesk.com/attachments/token/eGJd0L8s6a53f55gVsGTPpTSX/?name=Logo-01.svg" width="250" />](https://www.browserstack.com/)

which provides a wonderful cross-browser, cross-platform testing tool!

## Further documentation

* [The Javascript API for controlling the editor](https://github.com/ylemkimon/mathylem/wiki/Editor-API-reference)
* [The Javascript APIs for document manipulation, on-screen keyboard, and rendering](https://github.com/ylemkimon/mathylem/wiki/Auxiliary-APIs)
* [Editor styling options](https://github.com/ylemkimon/mathylem/wiki/CSS-styling)
* [The JSON specification used to describe available symbols](https://github.com/ylemkimon/mathylem/wiki/Symbol-definition-reference)
* [The XML format used to represent expressions](https://github.com/ylemkimon/mathylem/wiki/XML-data-format)
* [Editor internals](https://github.com/ylemkimon/mathylem/wiki/Internals)

## License

MathYlem is licensed under the [MIT License](https://github.com/ylemkimon/mathylem/blob/master/LICENSE).
