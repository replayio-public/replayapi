# NOTE: This was part of an experiment to understand how fundamentally different the tree-sitter nodes would be between py and ts.

def f1(x): pass                    # basic parameter
def f2(x=1): pass                  # default value
def f3(*args): pass                # var positional
def f4(**kwargs): pass             # var keyword
def f5(*, x): pass                 # keyword-only
def f6(x, /): pass                 # positional-only 
def f7(x, /, y, *, z): pass       # mixed param kinds
