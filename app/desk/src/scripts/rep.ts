import {
    Replicache,
    TEST_LICENSE_KEY,
    type WriteTransaction,
} from "replicache";

function assert(val: any, ...msg: any[]): asserts val {
    if (val) return;
    console.error("Assertion failed: ", ...msg);
    throw new Error("Assertion failed: " + msg?.map(String).join(" ") ?? "");
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
    window.replicache = new Replicache({
        name: "desk", // FIXME: use user ID
        licenseKey: TEST_LICENSE_KEY,
        mutators: Mutations,
    });

    console.log("initialized", window.replicache);
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

// {{{ ID
const ID_LENGTH = 32;
const ID_ENTITY_PREFIX_LENGTH = 4;
const ID_PREFIX_LENGTH = ID_ENTITY_PREFIX_LENGTH + "_".length;
const ID_SUFFIX_LENGTH = ID_LENGTH - ID_PREFIX_LENGTH;

import {customAlphabet} from "nanoid"

const generate_nano_id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ").bind(null, ID_SUFFIX_LENGTH)

const ID_PREFIXES = {
    seat: "seat",
    student: "stud",
    chart: "chrt",
} as const

for (const prefix of Object.values(ID_PREFIXES)) {
    assert(prefix.length == ID_ENTITY_PREFIX_LENGTH, "prefix is length", ID_ENTITY_PREFIX_LENGTH);
}

function generate_id(forEntity: keyof typeof ID_PREFIXES) {
    return ID_PREFIXES[forEntity] + "_" + generate_nano_id(); // FIXME: use nanoid
}
// }}

async function seating_chart_save_inner(
    tx: WriteTransaction,
    chart: {
        id: string;
        seats: Array<{ id: string; gridX: number; gridY: number }>;
        students: Array<{ id: string; seatID: string | null, name: string}>;
    }
) {
    console.log("seating_chart_save", chart);
}

export async function seating_chart_save(chart: {
    id: string;
    seats: Array<{ id?: string; gridX: number; gridY: number }>;
    students: Array<{ id?: string; seatID: string | number | null, name: string }>;
}) {
    const rep = assert_init();

    for (const seat of chart.seats) {
        if (seat.id == null) {
            seat.id = generate_id("seat");
        }
    }

    for (const student of chart.students) {
        if (student.id == null) {
            student.id = generate_id("student");
        }
    }

    await rep.mutate.seating_chart_save(chart as any);
}
