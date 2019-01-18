/**
 * Type which has optional property
 */
type OptionalProperty<T> = {
  [K in keyof T]: T[K] | undefined;
};

/**
 * Optional property
 * @param obj
 */
export function opt<T>(obj: T | null | undefined): OptionalProperty<T> {
  return obj || ({} as OptionalProperty<T>);
}

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
