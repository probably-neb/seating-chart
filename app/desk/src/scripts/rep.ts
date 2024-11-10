import {
    Replicache,
    TEST_LICENSE_KEY,
    type WriteTransaction,
} from "replicache";

import ID from "./id"

function assert(val: any, ...msg: any[]): asserts val {
    if (val) return;
    console.error("Assertion failed: ", ...msg);
    throw new Error("Assertion failed: " + (msg?.map(String).join(" ") ?? ""));
}

declare global {
    interface Window {
        replicache?: Rep;
    }
}

const Mutations = {
        seating_chart_save: seating_chart_save_inner,
}

export type Rep = Replicache<typeof Mutations>;

export function init() {
    assert(typeof window != undefined, "window is defined");
    const user_id = get_user_id()
    window.replicache = new Replicache({
        name: user_id, 
        licenseKey: TEST_LICENSE_KEY,
        mutators: Mutations,
    });

    console.log("initialized", window.replicache);
}

function get_user_id() {
    // FIXME: implement way for backend to pass user ID to frontend (probably in html)
    // and get it here

    const LOCAL_STORAGE_ID_KEY = "anon-user-id"
    let id = localStorage.getItem(LOCAL_STORAGE_ID_KEY);
    if (id) {
        return id;
    }
    id = ID.generate_for("user")
    localStorage.setItem(LOCAL_STORAGE_ID_KEY, id);

    return id;
}

export function ensure_init() {
    if (window.replicache) {
        return;
    }
    init();
}

function close() {
    if (window.replicache) {
        assert(!window.replicache.closed, "rep not closed");
        window.replicache.close();
        delete window.replicache;
    }
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        close();
    });
}

function assert_init(): Rep {
    assert(window.replicache instanceof Replicache, "Replicache is defined");
    assert(!window.replicache.closed, "Replicache is not closed");
    return window.replicache
}


async function seating_chart_save_inner(
    tx: WriteTransaction,
    chart: {
        id: string;
        seats: Array<{ id: string; gridX: number; gridY: number }>;
        students: Array<{ id: string; seatID: string | null, name: string}>;
    }
) {
    console.log("seating_chart_save", tx.clientID, chart);
}

export async function seating_chart_save(chart: {
    id: string;
    seats: Array<{ id?: string; gridX: number; gridY: number }>;
    students: Array<{ id: string; seatID: string | null, name: string }>;
}) {
    const rep = assert_init();

    // FIXME: validate
    await rep.mutate.seating_chart_save(chart as any);
}
