import { program } from "commander";
import path from "path";

const pkg = require(path.join(__dirname, "../../../package.json"));

program.command("version").action(() => {
  console.log(pkg.version);
});
