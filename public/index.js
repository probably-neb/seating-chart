import * as Store from "/store.js";
import ID from "/id.js";
import { seat_shapes_render, svg_elem_create } from "/shape.js";

const SEAT_GRID_W = 4;
const SEAT_GRID_H = 4;
const SEAT_RADIUS_GRID = 0.5;
const PREVIEW_PAD_GRID = 2;

const content_ref = document.getElementById("content");
if (content_ref == null) {
    throw new Error("content_ref is null");
}

const new_chart_id = ID.generate_for("chart");
const new_chart_href = "/canvas/" + new_chart_id;
document.getElementById("create-chart").setAttribute("href", new_chart_href);

/**
 * Miniature of the chart, fitted to its seats, drawn the same way as the
 * editor (shape.js)
 *
 * @param {import("/store.js").SeatingChart} seating_chart
 */
function chart_preview_svg(seating_chart) {
    const seated_ids = new Set(seating_chart.students.map((student) => student.seatID));

    // seats can be anywhere on the infinite canvas, fit the view to them
    let min_x = 0, min_y = 0, max_x = SEAT_GRID_W, max_y = SEAT_GRID_H;
    if (seating_chart.seats.length > 0) {
        min_x = Math.min(...seating_chart.seats.map((seat) => seat.gridX));
        min_y = Math.min(...seating_chart.seats.map((seat) => seat.gridY));
        max_x = Math.max(...seating_chart.seats.map((seat) => seat.gridX + SEAT_GRID_W));
        max_y = Math.max(...seating_chart.seats.map((seat) => seat.gridY + SEAT_GRID_H));
    }
    min_x -= PREVIEW_PAD_GRID;
    min_y -= PREVIEW_PAD_GRID;
    max_x += PREVIEW_PAD_GRID;
    max_y += PREVIEW_PAD_GRID;

    const svg = svg_elem_create("svg", {
        viewBox: `${min_x} ${min_y} ${max_x - min_x} ${max_y - min_y}`,
        preserveAspectRatio: "xMidYMid meet",
    });
    const dots_id = "dots-" + seating_chart.id;
    svg.innerHTML = `
        <defs>
            <pattern id="${dots_id}" width="2" height="2" patternUnits="userSpaceOnUse">
                <circle class="preview-dot" cx="1" cy="1" r="0.12" />
            </pattern>
        </defs>
        <rect x="${min_x - 100}" y="${min_y - 100}" width="${max_x - min_x + 200}" height="${max_y - min_y + 200}" fill="url(#${dots_id})" />`;

    const seats_ref = svg_elem_create("g", { class: "seat-shapes" });
    seat_shapes_render(
        seats_ref,
        seating_chart.seats.map((seat) => ({
            box: [seat.gridX, seat.gridY, seat.gridX + SEAT_GRID_W, seat.gridY + SEAT_GRID_H],
            kind: seated_ids.has(seat.id) ? "seated" : "empty",
        })),
        SEAT_RADIUS_GRID,
        "preview-" + seating_chart.id
    );
    svg.appendChild(seats_ref);
    return svg;
}

/** @param {number} n @param {string} what */
function plural(n, what) {
    return `${n} ${what}${n == 1 ? "" : "s"}`;
}

{
    const ids = await Store.chart_ids_list();
    const charts = await Promise.all(ids.map((id) => Store.chart_get(id)));
    content_ref.innerHTML = "";
    if (ids.length == 0) {
        content_ref.innerHTML = `<p class="chart-grid-empty">No seating charts yet. Make your first one with <b>New chart</b>.</p>`;
    }
    for (const seating_chart of charts) {
        if (seating_chart == null) continue;
        const seated = seating_chart.students.filter((student) => student.seatID != null).length;
        const card = document.createElement("a");
        card.className = "chart-card";
        card.href = `/canvas/${seating_chart.id}`;
        card.innerHTML = `
            <div class="chart-card-preview"></div>
            <div class="chart-card-body">
                <h3>Untitled chart<small>${seating_chart.id.slice(-6)}</small></h3>
                <p>${plural(seating_chart.seats.length, "seat")} · ${seated}/${seating_chart.students.length} seated</p>
            </div>
        `;
        card.querySelector(".chart-card-preview").appendChild(chart_preview_svg(seating_chart));
        content_ref.appendChild(card);
    }
}
