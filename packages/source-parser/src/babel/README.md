# Babel for Source Parsing

We generally want to use `tree-sitter` for source parsing to stay language-agnostic. However, we add Babel for 2 reasons:

* `tree-sitter` does not provide bindings, and `babel` does.
* We already use `babel` for our analysis in the backend. We can move it there, if we find it sufficiently useful to do so.
