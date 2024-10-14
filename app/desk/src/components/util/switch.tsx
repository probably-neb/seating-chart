
const ElseSymbol = Symbol("case-else")
/**
 * Switch component is the alternative to `Show` for multiple mutually exclusive cases
 */
export function Switch<T>(props: {on: T, children: JSX.Element[]}) {
    // TODO: add fallback prop
    const children = props.children;
    const value = props.on;
    let elseChildren: any | null = null;
    for (let i = 0; i < children.length; i++) {
        const c = children[i]!;
        if (!("when" in c.props)) {
            console.warn("Child of Switch component is missing when prop")
            continue
        }
        const cVal = c.props["when"];
        if (cVal !== value) {
            if (cVal === ElseSymbol) {
                if (elseChildren != null) {
                    console.warn("Multiple Else children in Switch component")
                }
                elseChildren = c.props.children

            }
            continue
        }
        return c.props.children
    }
    return elseChildren; /* either the children of the else case or null if there was no else case */
}

type CaseProps<T> = React.PropsWithChildren<{when: T }>

export function Case<T>(props: CaseProps<T>) {
    return <>{props.children}</>
}

Case.Else = ElseSymbol
