## CSS styling

The following CSS selectors will provide access to various elements of the editor:

* `.mathylem_active`: The mathylem div when it is active.  For example, one
  can use the `border` property of this class to cause the editor to
  have a glowing blue border when active.

* `.mathylem_inactive`: The mathylem div when it is inactive.  For example,
  set the `background-color` of this class to a share of grey to
  grey out the editor when inactive.

* `.mathylem_active .main_cursor`: The span for the main cursor.  CSS
  animations can be used, for example, to make the cursor blink.

* `.mathylem_text_current`: The span for any plain text content currently
  under selection.  For example, to highlight a textbox with a grey
  border while selected, set a `border` style for this CSS class.

### Example

Here, we present the stylesheet for the example MathYlem page, with
commentary on what each of the styles does

```
/* Make the mathylem background white when active */
.mathylem_active {
    background-color: #ffffff;
}

/* Make the mathylem background grey when inactive */
.mathylem_inactive {
    background-color: #fafafa;
}

/* Give active textboxes a grey border */
.mathylem_text_current {
    border: 1px solid #ccc;
}

/* Make the cursor blink */
.mathylem_active .main_cursor {
  animation: blink-animation 1s steps(2, start) infinite;
  -webkit-animation: blink-animation 1s steps(2, start) infinite;
}

@keyframes blink-animation {
  to { visibility: hidden; }
}

@-webkit-keyframes blink-animation {
  to { visibility: hidden; }
}

```

