// INFO: Conditional types that excludes properties that do not have a value set.
type NoUndefinedFields<T> = {
  [Property in keyof T as (T[Property] extends NonNullable<T[Property]> ? Property : never)]: T[Property];
}
