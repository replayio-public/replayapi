import path from "path";

import { program } from "commander";

const pkg = require(path.join(__dirname, "../../../package.json"));

program.command("version").action(() => {
  console.log(pkg.version);
});
