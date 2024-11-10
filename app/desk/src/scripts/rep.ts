import {
    Replicache,
    TEST_LICENSE_KEY,
    type WriteTransaction,
} from "replicache";
const TUTORIAL_LICENSE_KEY = `l00000000000000000000000000000001`;

import ID from "./id";

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
};

export type Rep = Replicache<typeof Mutations>;

export function init() {
    assert(typeof window != undefined, "window is defined");
    const user_id = get_user_id();
    window.replicache = new Replicache({
        name: user_id,
        licenseKey: TUTORIAL_LICENSE_KEY,
        mutators: Mutations,
    });

    console.log("initialized", window.replicache);
}

function get_user_id() {
    // FIXME: implement way for backend to pass user ID to frontend (probably in html)
    // and get it here

    const LOCAL_STORAGE_ID_KEY = "anon-user-id";
    let id = localStorage.getItem(LOCAL_STORAGE_ID_KEY);
    if (id) {
        return id;
    }
    id = ID.generate_for("user");
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

export function get_assert_init(): Rep {
    assert(window.replicache instanceof Replicache, "Replicache is defined");
    assert(!window.replicache.closed, "Replicache is not closed");
    return window.replicache;
}

export namespace Keys {
    export namespace SeatingChart {
        export const prefix = "seating-chart/";

        export function by_id(id: string) {
            return prefix + id;
        }

        export namespace Student {
            export function prefix(id: string) {
                return SeatingChart.prefix + id + "/students/";
            }

            export function by_id(id: string, student_id: string) {
                return prefix(id) + student_id;
            }
        }

        export namespace Seat {
            export function prefix(id: string) {
                return SeatingChart.prefix + id + "/seats/";
            }

            export function by_id(id: string, seat_id: string) {
                return prefix(id) + "/seats/" + seat_id;
            }
        }
    }
}

// {{{ Mutations
async function seating_chart_save_inner(
    tx: WriteTransaction,
    chart: {
        id: string;
        seats: Array<{ id: string; gridX: number; gridY: number }>;
        students: Array<{ id: string; seatID: string | null; name: string }>;
        width: number;
        height: number;
    }
) {
    console.log("seating_chart_save", tx.clientID, chart);
    const base = {
        id: chart.id,
        width: chart.width,
        height: chart.height,
    };
    const seats = chart.seats;
    const students = chart.students;

    const res = await Promise.allSettled([
        tx.set(Keys.SeatingChart.by_id(chart.id), base),
        ...students.map((student) =>
            tx.set(
                Keys.SeatingChart.Student.by_id(chart.id, student.id),
                student
            )
        ),
        ...seats.map((seat) =>
            tx.set(Keys.SeatingChart.Seat.by_id(chart.id, seat.id), seat)
        ),
    ]);

    if (!res.every((r) => r.status == "fulfilled")) {
        console.error("failed to save seating chart", res);
    }
}

export async function seating_chart_save(chart: {
    id: string;
    seats: Array<{ id?: string; gridX: number; gridY: number }>;
    students: Array<{ id: string; seatID: string | null; name: string }>;
    width: number;
    height: number;
}) {
    const rep = get_assert_init();

    // FIXME: validate
    await rep.mutate.seating_chart_save(chart as any);
}
// }}}

// {{{ queries
export async function seating_chart_get(chart_id: string) {
    const rep = get_assert_init();
    const chart_does_exist = await rep.query((tx) =>
        tx.has(Keys.SeatingChart.by_id(chart_id))
    );
    if (!chart_does_exist) {
        return null;
    }
    return await rep.query(async (tx) => {
        const seats_query = tx
            .scan({ prefix: Keys.SeatingChart.Seat.prefix(chart_id) })
            .toArray();
        const students_query = tx
            .scan({ prefix: Keys.SeatingChart.Student.prefix(chart_id) })
            .toArray();
        const base_query = tx.get(Keys.SeatingChart.by_id(chart_id));
        const [seats, students, base] = await Promise.all([
            seats_query,
            students_query,
            base_query,
        ]);
        return Object.assign(base!, { seats, students });
    });
}
// }}}
