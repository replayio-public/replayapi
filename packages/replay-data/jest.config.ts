import type { Config } from "@jest/types";

import baseConfig from "../../jest.config.base";

const config: Config.InitialOptions = {
  ...baseConfig,
  rootDir: __dirname,
};

export default config;
