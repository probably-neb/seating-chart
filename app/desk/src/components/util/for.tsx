import { assert } from "@/lib/assert";
import React from "react";
// TODO: consider checking for key prop in dev mode
// note, however, that is is not an easy check,
// but could possibly be done very simply and commented out
// for use when react gives a warning without giving any
// helpful information about where it happened

/**
 * A helper component that provides a useful alternative to the {list.map(c => <>{...}</>)}
 * pattern.
 * The main benefits are related to error/edge case handling, i.e. when the list is null or
 * undefined and you want to display nothing, or a fallback.
 * In the future it can be extended to handle filtering using predicates, and how to treat empty lists
 */
export default function For<T>(props: {
    each?: Array<T> | null | undefined;
    children: (elem: T, i: number) => React.ReactNode;
    fallback?: React.ReactNode;
    fallbackOnEmpty?: boolean | React.ReactNode;
}): React.ReactNode {
    const children = new Array<React.ReactNode>(props.each?.length);
    if (
        props.each == null ||
        (props.fallbackOnEmpty === true && props.each.length === 0)
    ) {
        return props.fallback ?? null;
    }
    if (props.each.length === 0 && props.fallbackOnEmpty != null && !!props.fallbackOnEmpty) {
        return props.fallbackOnEmpty ?? props.fallback ?? null;
    }
    const render = props.children;

    for (let i = 0; i < props.each.length; i++) {
        const node = render(props.each[i]!, i);
        children[i] = node;
    }
    return children;
}

export function ForI(props: {
    to: number;
    from?: number;
    children: (i: number) => React.ReactNode;
    step?: number;
}): React.ReactNode {
    let end = props.to;
    let start = props.from ?? 0;
    let step = props.step ?? (start <= end ? 1 : -1);

    let numChildren = Math.round(Math.abs((end - start) / step) + 0.5);
    let children = new Array<React.ReactNode>(numChildren).fill(null);

    if (end == start) {
        return null;
    }

    assert(
        sign(end - start) === sign(step),
        "step and range are in same direction",
    );
    assert(step !== 0, "step is not zero");

    const render = props.children;

    for (
        let i = start, childIndex = 0;
        step > 0 ? i < end : i > end;
        i += step, childIndex++
    ) {
        children[childIndex] = render(i);
    }
    return children;
}

function sign(num: number): -1 | 1 {
    return (num / Math.abs(num)) as -1 | 1;
}
