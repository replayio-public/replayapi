import baseConfig from "./jest.config.base";
import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  ...baseConfig,
  projects: ["<rootDir>/packages/*"],
};

export default config;
