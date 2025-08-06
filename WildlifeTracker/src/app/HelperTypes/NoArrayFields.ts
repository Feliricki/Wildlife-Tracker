type NoArrayFields<T> = {
  [Property in keyof T as (NonNullable<T[Property]> extends unknown[] ? never : Property)]: T[Property];
}
