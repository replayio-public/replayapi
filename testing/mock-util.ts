export type Mocked<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any 
    ? jest.Mock 
    : T[P]
};

/**
 * Mocks all methods on the class'es prototype.
 * NOTE: This does work with private and other internal methods.
 */
export function mockClassMethods<T extends abstract new (...args: any) => any>(Class: T): void {
  Object.getOwnPropertyNames(Class.prototype)
    .filter(prop => prop !== "constructor" && typeof Class.prototype[prop] === 'function')
    .forEach(method => {
      Class.prototype[method] = jest.fn();
    });
}
