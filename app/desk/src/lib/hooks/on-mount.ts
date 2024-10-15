import {useEffect} from "react";
import useIsomorphicLayoutEffect from "./use-isomorphic-layout-effect";

/**
 * A wrapper around useEffect with an empty dependency array
 * usefull to avoid footguns with useEffect and convey intent
 * clearly
 */
export default function onMount(callback: () => any) {
    useIsomorphicLayoutEffect(() => {
        // useEffect with no dependencies will run on mount
        return callback();
    }, [])
}
