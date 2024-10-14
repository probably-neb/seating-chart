import React from "react";

type Falsey = null | undefined | false;
type Truthy<T> = Exclude<T, Falsey>;

export default function Show<T>(props: {
    when: T;
    fallback?: React.ReactNode;
    children: React.ReactNode | ((val: Truthy<T>) => React.ReactNode);
}) {
    if (!props.when || !props.children) {
        return props.fallback ?? null
    }
    if (typeof props.children === "function") {
        // cast required because we know that `when` is not falsey
        // but TS treats it as NonNullable (i.e. would say `false` gets passed)
        return <>{props.children(props.when as Truthy<T>)}</>;
    }
    return props.children
}

/**
 * Helper function for `Show` component
 * can be used to have some the Show be based on some predicate
 * of the value without having the null asserted `children` render function
 * take the result of the predicate
 *
 * ex.
 * ```{ts}
 * <Show when={when(user, (u): u is Admin => u.isAdmin)}>
*   {(admin) => <span>{admin.name}</span>}
*  </Show>
 * ```
 */
export function when<T, R extends T>(val: T, pred: (val: T) => val is R): R
export function when<T, R extends T>(val: T, pred: (val: T) => any) {
    if (pred(val))
        return val as R
    return null
}

/**
 *
 */
export function whenAll<T, R extends Truthy<T>>(...vals: T[]): Array<R> | null {
    let ok = true;
    for (const val of vals) {
        if (!val) {
            ok = false;
            break;
        }
    }
    if (ok) {
        return vals as any
    }
    return null;
}
