import baseConfig from "../../jest.config.base";
import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  ...baseConfig,
  rootDir: __dirname
};

export default config;