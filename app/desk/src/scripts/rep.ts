import {
    Replicache,
    type ReadonlyJSONObject,
    type ReadTransaction,
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

// {{{
type TxW = WriteTransaction;
type TxR = ReadTransaction;
type TxAny = TxW | TxR;

export interface Seat extends ReadonlyJSONObject {
    id: string;
    gridX: number;
    gridY: number;
}
export interface Student extends ReadonlyJSONObject {
    id: string;
    seatID: string | null;
    name: string;
}
export interface SeatingChart extends ReadonlyJSONObject {
    id: string;
    seats: Array<Seat>;
    students: Array<Student>;
    cols: number;
    rows: number;
}
type SeatingChartBase = Pick<SeatingChart, "id" | "rows" | "cols">;
// }}}

// {{{ Mutations
async function seating_chart_save_inner(
    tx: WriteTransaction,
    chart: SeatingChart
) {
    console.log("seating_chart_save", chart);
    const base = {
        id: chart.id,
        cols: chart.cols,
        rows: chart.rows,
    };
    const seats = chart.seats;
    const students = chart.students;

    const removed_seat_ids = new Array<string>();

    if (await tx.has(Keys.SeatingChart.by_id(chart.id))) {
        const existing_chart = await query_seating_chart_get(tx, chart.id);


        for (let i = 0; i < existing_chart.seats.length; i++) {
            let found = false;
            for (let j = 0; j < seats.length; j++) {
                if (existing_chart.seats[i]!.id == seats[j]!.id) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                removed_seat_ids.push(existing_chart.seats[i]!.id);
            }
        }

        // TODO: removed students
    }


    const res = await Promise.allSettled([
        tx.set(Keys.SeatingChart.by_id(chart.id), base),
        ...students.map((student) =>
            tx.set(
                Keys.SeatingChart.Student.by_id(chart.id, student.id),
                student
            )
        ),
        ...removed_seat_ids.map((seat_id) =>
            tx.del(Keys.SeatingChart.Seat.by_id(chart.id, seat_id))
        ),
        ...seats.map((seat) =>
            tx.set(Keys.SeatingChart.Seat.by_id(chart.id, seat.id), seat)
        ),
    ]);

    if (!res.every((r) => r.status == "fulfilled")) {
        console.error("failed to save seating chart", res);
    }
}

export async function seating_chart_save(chart: SeatingChart) {
    const rep = get_assert_init();

    // FIXME: validate
    await rep.mutate.seating_chart_save(chart as any);
}
// }}}

// {{{ queries
export async function query_seating_chart_get(tx: TxAny, chart_id: string) {
    const seats_query = tx
        .scan({ prefix: Keys.SeatingChart.Seat.prefix(chart_id) })
        .toArray() as Promise<Array<Seat>>;
    const students_query = tx
        .scan({ prefix: Keys.SeatingChart.Student.prefix(chart_id) })
        .toArray() as Promise<Array<Student>>;
    const base_query = tx.get<SeatingChartBase>(
        Keys.SeatingChart.by_id(chart_id)
    );
    const [seats, students, base] = await Promise.all([
        seats_query,
        students_query,
        base_query,
    ]);
    if (!base) throw new Error(`no base found for ${chart_id}`);
    const res = {
        ...base,
        seats,
        students,
    } satisfies SeatingChart;
    return res;
}

export async function seating_chart_get(chart_id: string) {
    const rep = get_assert_init();
    const chart_does_exist = await rep.query((tx) =>
        tx.has(Keys.SeatingChart.by_id(chart_id))
    );
    if (!chart_does_exist) {
        return null;
    }
    return await rep.query((tx) => query_seating_chart_get(tx, chart_id));
}

export async function query_seating_chart_ids_list(tx: TxAny) {
    const charts = tx.scan<SeatingChartBase>({
        prefix: Keys.SeatingChart.prefix,
    });
    const ids = [];

    for await (const [key, chart] of charts.entries()) {
        if (chart == null) continue;
        if (!("id" in chart) || key !== Keys.SeatingChart.by_id(chart.id)) {
            continue;
        }
        ids.push(chart.id);
    }

    return ids;
}
// }}}
