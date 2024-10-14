export function assert(value: unknown, ...args: Array<any>): asserts value {
    if (value) return

    console.assert(value, ...args)
    throw new Error('Assertion Failed: ' + args.map(String).join(' '))
}

export namespace assert {
    export function eql<A, B>(a: A, b: B, ...args: Array<any>): asserts A is B {
        if (a === b) return
        console.assert(a === b, `Assertion Failed: ${a} !== ${b} :: `, ...args)
        throw new Error(`Assertion Failed: ${a} !== ${b} :: ` + args.map(String).join(' '))
    }
}
