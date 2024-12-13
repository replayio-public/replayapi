import { createRequire } from "module";

// @ts-expect-error - import.meta is handled by build tooling
const require = createRequire(import.meta.url);
const Module = require("module");

function ignoreMultiMediaImports() {
  const originalJsHandler = Module._extensions[".js"];
  Module._extensions[".js"] = function (module: any, filename: string) {
    // console.log(`Custom handler for: ${filename}`);
    if (filename.match(/\.(css|scss|svg)$/)) {
      // noop
    } else {
      // Call the original handler
      originalJsHandler(module, filename);
    }
  };
}

(async function main() {
  ignoreMultiMediaImports();

  await import("./_main_impl_.ts");
})();
