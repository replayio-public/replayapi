## Setup

* Make sure you have the correct `yarn` version:
  ```sh
  corepack enable
  # corepack prepare yarn@4.5.3 --activate # This part should not be necessary because we have `packageManager` set.
  ```
* Install with `yarn` and initialize `yalc` linkage:
  ```sh
  # Setup + install external dependencies.
  yarn

  # Install internal dependencies.
  yarn yalc-all
  ```
* Test your installation:
  ```sh
  tsx main.ts version # 0.0.1
  tsx main.ts --help
  ```
  * Expected result:
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
