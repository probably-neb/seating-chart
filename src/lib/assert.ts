export function assert(value: unknown, ...args: Array<any>): asserts value {
    if (value) return

    console.assert(value, ...args)
    throw new Error('Assertion Failed: ' + args.map(String).join(' '))
}
