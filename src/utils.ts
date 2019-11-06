/**
 * Type which has optional property
 */
export type OptionalProperty<T> = {
  [K in keyof T]: T[K] | undefined;
};

/**
 * Mapping for optional
 * @param f
 * @param obj
 * @param args
 */
export function optMap<T, S>(
    f: (p: T, ...args: any[]) => S, obj: T | null | undefined, ...args: any[]
): OptionalProperty<S> {
  if (obj === null || obj === undefined) {
    // FIXME: This is not safe when S is not an object.
    return {} as OptionalProperty<S>;
  } else {
    return f(obj, ...args);
  }
}

/**
 * Try
 * @param f
 */
export function tryOpt<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}
