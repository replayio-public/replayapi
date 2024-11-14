## Setup
* Install with `yarn` and initialize `yalc` linkage.

```sh
# Setup + install external dependencies.
yarn

# Install internal dependencies.
yarn yalc-all
```

**Test it:**
```sh
tsx main.ts version # 0.0.1
tsx main.ts --help
```

Expected result:
```
Usage: main [options] [command]

Options:
  -h, --help                Display help for command

Commands:
  fetch-comments [options]  Fetch comments from a recording
  help [command]            Display help for command
  session                   Manage persistent sessions with replay api
  version
```
