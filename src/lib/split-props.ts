import { useCallback, useMemo } from "react";

// CREDIT: https://github.com/solidjs/solid/blob/daa419be822ed343179cb06ec8f5a6600c91f4a0/packages/solid/src/server/rendering.ts#L162
export function splitProps<T extends object, K1 extends keyof T>(
    props: T,
    ...keys: [K1[]]
): [Pick<T, K1>, Omit<T, K1>];
export function splitProps<
    T extends object,
    K1 extends keyof T,
    K2 extends keyof T,
>(
    props: T,
    ...keys: [K1[], K2[]]
): [Pick<T, K1>, Pick<T, K2>, Omit<T, K1 | K2>];
export function splitProps<
    T extends object,
    K1 extends keyof T,
    K2 extends keyof T,
    K3 extends keyof T,
>(
    props: T,
    ...keys: [K1[], K2[], K3[]]
): [Pick<T, K1>, Pick<T, K2>, Pick<T, K3>, Omit<T, K1 | K2 | K3>];
export function splitProps<
    T extends object,
    K1 extends keyof T,
    K2 extends keyof T,
    K3 extends keyof T,
    K4 extends keyof T,
>(
    props: T,
    ...keys: [K1[], K2[], K3[], K4[]]
): [
    Pick<T, K1>,
    Pick<T, K2>,
    Pick<T, K3>,
    Pick<T, K4>,
    Omit<T, K1 | K2 | K3 | K4>,
];
export function splitProps<
    T extends object,
    K1 extends keyof T,
    K2 extends keyof T,
    K3 extends keyof T,
    K4 extends keyof T,
    K5 extends keyof T,
>(
    props: T,
    ...keys: [K1[], K2[], K3[], K4[], K5[]]
): [
    Pick<T, K1>,
    Pick<T, K2>,
    Pick<T, K3>,
    Pick<T, K4>,
    Pick<T, K5>,
    Omit<T, K1 | K2 | K3 | K4 | K5>,
];

export function splitProps<T>(props: T, ...keys: [(keyof T)[]]) {
    const descriptors = Object.getOwnPropertyDescriptors(props);

    const split = (k: (keyof T)[]) => {
        const clone: Partial<T> = {};
        for (let i = 0; i < k.length; i++) {
            const key = k[i]!;
            if (descriptors[key]) {
                Object.defineProperty(clone, key, descriptors[key]);
                delete descriptors[key];
            }
        }
        return clone;
    };

    return keys
        .map(split)
        .concat(split(Object.keys(descriptors) as (keyof T)[]));
}

export function splitPropsMemo<T>(props: T, ...keys: [(keyof T)[]]) {
    const descriptors = useMemo(
        () => Object.getOwnPropertyDescriptors(props),
        [props],
    );

    const split = (k: (keyof T)[]) => {
        const clone: Partial<T> = {};
        for (let i = 0; i < k.length; i++) {
            const key = k[i]!;
            if (descriptors[key]) {
                Object.defineProperty(clone, key, descriptors[key]);
                delete descriptors[key];
            }
        }
        return clone;
    };

    const splitProps = useMemo(() => {
        return keys
            .map(split)
            .concat(split(Object.keys(descriptors) as (keyof T)[]));
    }, [descriptors, keys]);

    return splitProps;
}
