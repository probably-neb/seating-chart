import React from "react";

/**
 * A wrapper around useEffect with an empty dependency array
 * usefull to avoid footguns with useEffect and convey intent
 * clearly
 */
export default function onMount(callback: () => any) {
    React.useEffect(callback, [])
}
