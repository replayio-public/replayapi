/**
 * Return an empty object so imports work,
 * even though running any react-dependent code won't.
 */
module.exports = {
  /**
   * This is used by `suspense/src/cache/createCache.ts`.
   * @see https://github.com/replayio/devtools/blob/main/node_modules/suspense/src/utils/defaultGetCache.ts
   */
  unstable_getCacheForType() {
    return new Map();
  },
  
  /**
   * There is a file-level call to createContext (which will then not be used).
   */
  createContext() {
    return {};
  },

  /**
   * This is used by Jest when formatting certain errors.
   */
  isElement() {
    return false;
  },
};
