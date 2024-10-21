const pluginImportSort = require("prettier-plugin-import-sort");

const config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  arrowParens: "avoid",
  printWidth: 100,
  plugins: [pluginImportSort],
};

module.exports = config;
