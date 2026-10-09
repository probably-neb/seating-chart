// Persistence for seating charts. Each chart is stored as a single JSON
// document on the worker (see src/worker.js).

/**
 * @typedef {{ id: string, gridX: number, gridY: number }} Seat
 * @typedef {{ id: string, seatID: string | null, name: string }} Student
 * @typedef {{ id: string, seats: Seat[], students: Student[], cols: number, rows: number }} SeatingChart
 */

/** @param {string} chart_id */
function chart_url(chart_id) {
    return "/api/charts/" + encodeURIComponent(chart_id);
}

/**
 * @param {Response} res
 * @param {string} what
 */
function assert_ok(res, what) {
    if (!res.ok) {
        throw new Error(`${what} failed: ${res.status} ${res.statusText}`);
    }
}

/**
 * @param {string} chart_id
 * @returns {Promise<SeatingChart | null>}
 */
export async function chart_get(chart_id) {
    const res = await fetch(chart_url(chart_id));
    if (res.status == 404) {
        return null;
    }
    assert_ok(res, "chart_get");
    return await res.json();
}

/** @param {SeatingChart} chart */
export async function chart_save(chart) {
    const res = await fetch(chart_url(chart.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chart),
        // lets the save finish when it is triggered by the page unloading
        keepalive: true,
    });
    assert_ok(res, "chart_save");
}

/** @returns {Promise<string[]>} */
export async function chart_ids_list() {
    const res = await fetch("/api/charts");
    assert_ok(res, "chart_ids_list");
    return await res.json();
}
