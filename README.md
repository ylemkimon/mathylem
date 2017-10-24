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
    <link rel="stylesheet" href="style/mathylem.css">
    <script type="text/javascript" src="build/mathylem.min.js"></script>
  </head>
  <body>
    <div id="mathylem_div"></div>
    
    <script>
        MathYlem.init_symbols(["sym/symbols.json"]);
        new MathYlem("mathylem_div");
    </script>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('xml'))">See XML</button>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('latex'))">See LaTeX</button>
    <button onclick="alert(MathYlem.instances.mathylem_div.get_content('text'))">See SymPy code</button>
  </body>
</html>
```

## Installation and deployment

* Download the `build`, `style` and `sym` folders.

* Include the `build/mathylem.min.js`, `build/mathylem.katex.min.css`,
  `style/mathylem.css` files in your page.

* Pass a list of paths to various symbol definition files (several of
  which are in `sym/`) as well as the string `"builtins"` (if you want
  the built-in symbols, such as Greek letters) to `MathYlem.init_symbols`
  as in the example above.  This only needs to happen once per page.
  Symbol names from files that appear later in the list will override
  symbol names from files earlier in the list.

* For each div that you want turned into a MathYlem instance, call `new
  MathYlem()` passing in as the first argument either the Element object
  for that div or its ID.

## FAQ

* How do I change the styling of the editor?

  MathYlem provides default styling at `style/mathylem.css`.

  There are multiple configuration options and CSS classes that can be
  used to customise the appearance of the editor.  See [the
  documentation](doc/style.md).

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
(e.g. [src/mathylem.js](https://github.com/ylemkimon/mathylem/blob/master/src/mathylem.js)
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

If you're in a position where you don't have internet connectivity,
you can test using
[localhost:8000/basic.html](localhost:8000/index.html) instead, as
this page does not require any outside resources.

## Further documentation

* [The Javascript API for controlling the editor](doc/editor_api.md)
* [The Javascript APIs for document manipulation, on-screen keyboard, and rendering](doc/other_api.md)
* [Editor styling options](doc/style.md)
* [The JSON specification used to describe available symbols](doc/symbols.md)
* [The XML format used to represent expressions](doc/format.md)
* [Editor internals](doc/internals.md)

## License

MathYlem is licensed under the [MIT License](https://github.com/ylemkimon/mathylem/blob/master/LICENSE).
