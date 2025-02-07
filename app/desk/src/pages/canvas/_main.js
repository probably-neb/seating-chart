// vim: foldmethod=marker

import ID from "@/scripts/id";
import * as Replicache from "@/scripts/rep";
const app = document.getElementById("app");
assert(app != null, "app not null");

/**
 * setup in init
 * @type {string}
 */
let chart_id;

const AUTOSAVE_INTERVAL_MS = 30 * 1000; // 30s

// grid
const GRID_PROP_COLS = "--grid-cols";
const GRID_PROP_ROWS = "--grid-rows";

const GRID_PROP_OFFSET_X = "--grid-offset-x";
const GRID_PROP_OFFSET_Y = "--grid-offset-y";

const PROP_GRID_POS_X = "--grid-x";
const PROP_GRID_POS_Y = "--grid-y";

const GRID_POS_TRANSFORM =
    `translate(calc(var(--grid-cell-px) * (var(${PROP_GRID_POS_X}) - var(${GRID_PROP_OFFSET_X}))), calc(var(--grid-cell-px) * (var(${PROP_GRID_POS_Y}) - var(${GRID_PROP_OFFSET_Y}))))`;

const GRID_POS_TRANSFORM_NO_OFFSET =
    `translate(calc(var(--grid-cell-px) * var(${PROP_GRID_POS_X})), calc(var(--grid-cell-px) * var(${PROP_GRID_POS_Y})))`;


// seats
const SEAT_GRID_W = 4;
const SEAT_GRID_H = 4;

const SEAT_PROP_GRID_W = "--seat-grid-w";
const SEAT_PROP_GRID_H = "--seat-grid-h";

const SEAT_DATA_IDENTIFIER = "seat";
const SEAT_ID_PREFIX = "drag-";

const SEAT_DATA_STUDENT_DROP_INDICATION = "studentdragover";

let seat_refs = [];

const seat_preview_ref = document.createElement("div");

// chart
const CHART_PROP_SCALE = "--scale";

/** @type {HTMLDivElement} */
const chart_ref = document.getElementById("container");
assert(chart_ref != null, "chart not null");
// TODO: Consider Remove
let chartDomRect;

// selection
const SELECTION_PROP_WIDTH = "--width";
const SELECTION_PROP_HEIGHT = "--height";

const SELECTION_PROP_GRID_POS_X = "--selection-grid-x";
const SELECTION_PROP_GRID_POS_Y = "--selection-grid-y";

const SELECTION_CLIPBOARD_DATA_TYPE = "deskribe/selection";
const selection_ref = document.createElement("div");
let is_creating_selection = false;
/** @type {{anchor: {gridX: number, gridY: number}, start: {gridX: number, gridY: number}, end: {gridX: number, gridY: number}} | undefined}*/
let selected_region;

// drag
const DRAG_DATA_TYPE_KIND = "application/kind";

const DRAG_DATA_TYPE_KIND_SEAT = "seat";
const DRAG_DATA_TYPE_KIND_SELECTION = "selection";
const DRAG_DATA_TYPE_KIND_STUDENT = "student";

const invisible_drag_preview_ref = document.createElement("span");
{
    invisible_drag_preview_ref.style.display = "none";
    app.appendChild(invisible_drag_preview_ref);
}

// student
const STUDENT_DATA_SEAT_ID = "seatid";
const student_refs = [];
const STUDENT_DATA_IDENTIFIER = "student";

// zoom
const ZOOM_BTN_SCALE_FACTOR = 0.1;
const ZOOM_DISPLAY_ID = "zoom-display";

// sidebar
const sidebar_ref = document.getElementById("sidebar");
assert(sidebar_ref != null, "sidebar not null");
const sidebar_student_list_ref = sidebar_ref.querySelector("#students");

// top bar
const topbar_ref = document.getElementById("top-bar");
assert(topbar_ref != null, "top bar not null");

const STUDENT_CLASSLIST_SIDEBAR =
    "ring-2 rounded-md w-40 h-8 flex items-center justify-center font-semibold text-xs bg-white text-black";

const STUDENT_CLASSLIST_SEATING =
    "border-2 border-black rounded-md w-min px-2 py-1 flex items-center justify-center font-semibold text-xs bg-white text-black break-normal";


/** @returns {asserts val} */
function assert(val, ...msg) {
    if (val) return;
    console.error("Assertion failed: ", ...msg);
    throw new Error("Assertion failed: " + msg?.map(String).join(" ") ?? "");
}

Number.isSafeFloat = function (val) {
    return Number.isFinite(val) && !Number.isNaN(val);
};

function grid_cell_px_dim(v) {
    assert(v.startsWith("--"), "grid cell px dim must reference a variable");
    return `calc(var(--grid-cell-px) * var(${v}))`;
}

function grid_cell_px_get() {
    const gridCellPxStr = chart_ref.style.getPropertyValue("--grid-cell-px");
    const gridCellPx = Number.parseFloat(gridCellPxStr.slice(0, -"px".length));

    assert(
        Number.isSafeFloat(gridCellPx),
        "gridCellPx is valid float",
        gridCellPx,
        gridCellPxStr
    );

    return gridCellPx;
}

function grid_cell_px_adjust(factor) {
    const current_scale_str = chart_ref.style.getPropertyValue(CHART_PROP_SCALE);
    const current_scale = current_scale_str ? Number.parseFloat(current_scale_str) : 1.0;

    assert(
        Number.isSafeFloat(current_scale),
        "current_scale is safe float",
        current_scale
    );

    const desired_scale = current_scale + factor;
    if (desired_scale <= 0) {
        return;
    }

    const scale_transform = desired_scale / current_scale;

    const current_value = grid_cell_px_get();

    const new_value = current_value * scale_transform;
    // console.log({ new_value, current_value, scale_transform });

    chart_ref.style.setProperty("--grid-cell-px", new_value + "px");

    zoom_display_update(desired_scale);

    chart_ref.style.setProperty(CHART_PROP_SCALE, desired_scale);
}

function px_point_to_grid_round(gridCellPx, x, y) {
    assert(
        gridCellPx != null && x != null && y != null,
        "signature is (gridCellPx, x, y) got: (",
        [gridCellPx, x, y].join(", "),
        ")"
    );
    const [offset_x, offset_y] = grid_offset_get();

    const gridX = Math.round(( x / gridCellPx ) + offset_x);
    const gridY = Math.round(( y / gridCellPx ) + offset_y);

    return [gridX, gridY];
}

function px_point_to_grid_unsafe(gridCellPx, x, y) {
    const [offset_x, offset_y] = grid_offset_get();
    const gridX = (x / gridCellPx) + offset_x;
    const gridY = (y / gridCellPx) + offset_y;

    return [gridX, gridY];
}

/**
 * @param {number} scale
 */
function zoom_display_update(scale) {
    document.getElementById(ZOOM_DISPLAY_ID).innerText =
        (scale * 100).toFixed(0) + "%";
}

function preview_show(gridX, gridY) {
    elem_grid_pos_set(seat_preview_ref, gridX, gridY);
    seat_preview_ref.style.display = "block";
}

function preview_hide() {
    seat_preview_ref.style.display = "none";
}

function selection_region_is_normalized() {
    if (selected_region == null) {
        console.warn(
            "cannot check if selection region is normalized - region is null"
        );
        return;
    }

    const {
        start: { gridX: startX, gridY: startY },
        end: { gridX: endX, gridY: endY },
    } = selected_region;

    return startX <= endX && startY <= endY;
}

function selected_region_end_set(newX, newY) {
    assert(selected_region != null, "selected_region not null");
    assert(selected_region.end != null, "selected_region.end not null");

    const startX = Math.min(selected_region.anchor.gridX, newX);
    const startY = Math.min(selected_region.anchor.gridY, newY);
    const endX = Math.max(selected_region.anchor.gridX, newX);
    const endY = Math.max(selected_region.anchor.gridY, newY);

    selected_region.start.gridX = startX;
    selected_region.start.gridY = startY;
    selected_region.end.gridX = endX;
    selected_region.end.gridY = endY;

    assert(selection_region_is_normalized(), "selection region is normalized");
}

function selection_update() {
    if (selected_region == null) {
        return;
    }

    selection_ref.style.display = "block";

    const {
        start: { gridX: startX, gridY: startY },
        end: { gridX: endX, gridY: endY },
    } = selected_region;

    elem_grid_pos_set(selection_ref, startX, startY);

    selection_dims_set(Math.abs(endX - startX), Math.abs(endY - startY));

    selection_ref.style.width = grid_cell_px_dim(SELECTION_PROP_WIDTH);
    selection_ref.style.height = grid_cell_px_dim(SELECTION_PROP_HEIGHT);

    // update selected seats abs loc

    const selected_seat_refs = selected_seat_refs_get();

    let found_invalid_seat_pos = false;

    for (const selected_seat_ref of selected_seat_refs) {
        const [seat_gridX, seat_gridY] = elem_grid_pos_get(selected_seat_ref);
        const absX = startX + seat_gridX;
        const absY = startY + seat_gridY;
        seat_abs_loc_set(selected_seat_ref, absX, absY);
        const is_invalid_pos = !seat_is_valid_position(
            selected_seat_ref,
            absX,
            absY
        );

        found_invalid_seat_pos ||= is_invalid_pos;
        elem_invalid_set(selected_seat_ref, is_invalid_pos);
    }

    elem_invalid_set(selection_ref, found_invalid_seat_pos);
}

function selected_seat_refs_get() {
    return selection_ref.querySelectorAll(`[data-${SEAT_DATA_IDENTIFIER}]`);
}

function selection_force_appear_above_seats() {
    if (selection_ref.nextElementSibling == null) {
        return;
    }
    chart_ref.appendChild(selection_ref);
}

function selection_force_appear_below_seats() {
    if (selection_ref.previousElementSibling == null) {
        return;
    }
    chart_ref.insertBefore(selection_ref, chart_ref.firstChild);
}

function selection_dims_set(width, height) {
    assert(Number.isSafeInteger(width));
    assert(Number.isSafeInteger(height));
    assert(width >= 0, width);
    assert(height >= 0, height);
    selection_ref.style.setProperty(SELECTION_PROP_WIDTH, width);
    selection_ref.style.setProperty(SELECTION_PROP_HEIGHT, height);
}

function selection_dims_get() {
    const width = Number.parseInt(
        selection_ref.style.getPropertyValue(SELECTION_PROP_WIDTH)
    );
    const height = Number.parseInt(
        selection_ref.style.getPropertyValue(SELECTION_PROP_HEIGHT)
    );

    assert(Number.isSafeInteger(width));
    assert(Number.isSafeInteger(height));
    assert(width >= 0, width);
    assert(height >= 0, height);

    return [width, height];
}

function selection_clear() {
    // FIXME: do not clear if invalid
    // console.log("selection clear");
    const selected_seats = selected_seat_refs_get();
    if (selected_region == null) {
        assert(
            selected_seats.length == 0,
            "no selection -> no seats",
            selected_seats
        );
        assert(
            is_creating_selection == false,
            "no selection -> not creating",
            is_creating_selection
        );
        assert(
            selection_ref.style.display === "none",
            "no selection -> style is hidden",
            selection_ref.style.display
        );
        return;
    }
    for (const seat of selected_seats) {
        seat.remove();
        chart_ref.appendChild(seat);
        delete seat.dataset.selected;
        seat_grid_pos_revert_to_abs_loc(seat);
        seat.draggable = true;
    }
    selection_ref.style.display = "none";
    selected_region = null;
    is_creating_selection = false;
}

// ?PERF: use IntersectionObserver instead of manual calculation
/**
 * @returns {Array<{gridX: number, gridY: number} | null> | null} Array with same length as seat_refs where indices corresponding to selected seats in seat_refs are the offsets from the start of the selection. Or null if no selected seats
 */
function selected_seats_compute() {
    assert(selected_region != null);
    // console.log({ selected_region });
    const {
        start: { gridX: startX, gridY: startY },
        end: { gridX: endX, gridY: endY },
    } = selected_region;

    if (Math.abs(endX - startX) < 1 || Math.abs(endY - startY) < 1) {
        return null;
    }

    const selected_seats = new Array(seat_refs.length).fill(null);

    let found_selected_seats = false;

    for (let i = 0; i < seat_refs.length; i++) {
        const seat_ref = seat_refs[i];
        if (seat_ref == null) {
            continue;
        }
        const [seat_gridX, seat_gridY] = seat_abs_loc_get(seat_ref);

        // adjust by 1 so selection must be inside of seat not just adjacent
        // to count as selection
        const seat_left = seat_gridX + 1;
        const seat_top = seat_gridY + 1;
        const seat_right = seat_gridX + SEAT_GRID_W - 1;
        const seat_bottom = seat_gridY + SEAT_GRID_H - 1;

        const corners = [
            [seat_left, seat_top],
            [seat_right, seat_top],
            [seat_left, seat_bottom],
            [seat_right, seat_bottom],
        ];

        let is_in_selection = false;
        for (let i = 0; i < corners.length && !is_in_selection; i++) {
            const [seatX, seatY] = corners[i];
            is_in_selection ||=
                startX <= seatX && startY <= seatY && endX >= seatX && endY >= seatY;
        }
        if (is_in_selection) {
            found_selected_seats = true;
            const seatSelectionOffset = {
                gridX: seat_gridX - startX,
                gridY: seat_gridY - startY,
            };
            selected_seats[i] = seatSelectionOffset;
        }
    }

    return found_selected_seats ? selected_seats : null;
}

/**
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 *
 * Used to manually create a selection
 * clears selection if already exists,
 * then creates new selection from start to end and calculates selected seats within region
 */
function selection_create(startX, startY, endX, endY) {
    assert(Number.isSafeInteger(startX), "startX is int", startX);
    assert(Number.isSafeInteger(startY), "startY is int", startY);
    assert(Number.isSafeInteger(endX), "endX is int", endX);
    assert(Number.isSafeInteger(endY), "endY is int", endY);

    selection_clear();
    selected_region = {
        start: { gridX: startX, gridY: startY },
        end: { gridX: endX, gridY: endY },
    };
    const selected_seat_offsets = selected_seats_compute();
    assert(selected_seat_offsets != null, "selected seats found");

    selected_seats_update(selected_seat_offsets);
    selection_update();
}

/**
 * @param {Array<{gridX: number, gridY: number} | null>} selected_seat_offsets
 */
function selected_seats_update(selected_seat_offsets) {
    for (let i = 0; i < seat_refs.length; i++) {
        const seat_ref = seat_refs[i];
        if (seat_ref == null) {
            continue;
        }
        const selected_offset = selected_seat_offsets[i];
        if (selected_offset == null && seat_is_selected(seat_ref)) {
            if ("selected" in seat_ref.dataset) {
                delete seat_ref.dataset.selected;
            }
            if (seat_ref.parentElement == selection_ref) {
                seat_ref.remove();
                chart_ref.appendChild(seat_ref);
            }
            seat_ref.style.transform = GRID_POS_TRANSFORM;
            seat_ref.draggable = true;
        } else if (selected_offset != null && !seat_is_selected(seat_ref)) {
            seat_make_selected(
                seat_ref,
                selected_offset.gridX,
                selected_offset.gridY
            );
        }
    }
}

function seat_make_selected(seat_ref, ofsX, ofsY) {
    elem_grid_pos_set(seat_ref, ofsX, ofsY);
    // NOTE: has to happen after elem_grid_pos_set because that sets the transform
    seat_ref.style.transform = GRID_POS_TRANSFORM_NO_OFFSET;
    seat_ref.dataset["selected"] = "";
    selection_ref.appendChild(seat_ref);
    seat_ref.draggable = false;
}

function seat_is_selected(seat_ref) {
    if (seat_ref.parentElement === selection_ref) {
        assert(
            "selected" in seat_ref.dataset,
            "selected seat should have selected in dataset"
        );
        return true;
    }
    return false;
}

function* dbg_generate_rainbow_colors(max_colors = 360) {
    const hueStep = 360 / max_colors;

    for (let i = 0; i < max_colors; i++) {
        const hue = i * hueStep;
        yield `hsl(${hue}, 100%, 50%)`;
    }

    return null;
}

function dbg_render_dot_in_grid_square(color, gridX, gridY) {
    const dbg_dot = document.createElement("div");
    dbg_dot.style.backgroundColor = color;
    const gridCellPx = grid_cell_px_get();

    dbg_dot.style.position = "absolute";
    dbg_dot.style.top = 0;
    dbg_dot.style.left = 0;

    const size = Math.round(0.8 * gridCellPx);

    const x = gridCellPx * gridX + gridCellPx / 2 - size / 2;
    const y = gridCellPx * gridY + gridCellPx / 2 - size / 2;

    dbg_dot.style.transform = `translate(${x}px, ${y}px)`;
    dbg_dot.style.width = size + "px";
    dbg_dot.style.height = size + "px";
    dbg_dot.classList = "rounded-full";

    dbg_dot.dataset["dbgdot"] = "";
    chart_ref.appendChild(dbg_dot);
}

function dbg_clear_all_dots() {
    const dots = document.querySelectorAll("[data-dbgdot]");
    for (const dot of dots) {
        dot.remove();
    }
}

function dbg_sleep(milliseconds) {
    console.warn("sleep", milliseconds);
    const start = Date.now();
    while (Date.now() - start < milliseconds) {
        // Do nothing, just wait
    }
}

/**
 * @param {HTMLElement} seat_ref
 * @param {number | undefined} gridX
 * @param {number | undefined} gridY
 * @returns {boolean}
 * Check if the seat is in a valid position (not overlapping with other seats)
 * // TODO: check if seat is in bounds of grid
 * gridX and gridY are optional, if provided they will be used instead of the seat_ref's abs_loc
 */
function seat_is_valid_position(seat_ref, gridX, gridY) {
    if (gridX == null || gridY == null) {
        [gridX, gridY] = seat_abs_loc_get(seat_ref);
    }
    let is_not_overlapping = true;

    for (let i = 0; i < seat_refs.length && is_not_overlapping; i++) {
        const other_seat_ref = seat_refs[i];
        if (other_seat_ref == null || other_seat_ref == seat_ref) continue;
        const [seat_gridX, seat_gridY] = seat_abs_loc_get(other_seat_ref);

        const is_overlapping =
            Math.abs(gridX - seat_gridX) < SEAT_GRID_W &&
            Math.abs(gridY - seat_gridY) < SEAT_GRID_H;

        is_not_overlapping = !is_overlapping;
    }
    return is_not_overlapping;
}

function closest_non_overlapping_pos(dragging_seat_ref, absX, absY) {
    // console.time("closest non overlapping pos circ");

    const gridCellPx = grid_cell_px_get();

    const [gridX, gridY] = px_point_to_grid_round(gridCellPx, absX, absY);

    if (seat_is_valid_position(dragging_seat_ref, gridX, gridY)) {
        // console.timeEnd("closest non overlapping pos circ");
        return { gridX, gridY };
    }

    const [absGridX, absGridY] = px_point_to_grid_unsafe(gridCellPx, absX, absY);
    const [centerX, centerY] = seat_center_exact(absGridX, absGridY);

    // FIXME: make non arbitrary
    const max_radius = 100;

    for (let radius = 1; radius <= max_radius; radius++) {
        for (let angle = 0; angle < 360; angle++) {
            const x = Math.round(
                centerX + radius * Math.cos((angle * Math.PI) / 180) - SEAT_GRID_W / 2
            );
            const y = Math.round(
                centerY + radius * Math.sin((angle * Math.PI) / 180) - SEAT_GRID_H / 2
            );

            if (seat_is_valid_position(dragging_seat_ref, x, y)) {
                // console.timeEnd("closest non overlapping pos circ");
                // console.log('angle', angle, 'radius', radius)
                console.log('cnop', { x, y })
                return { gridX: x, gridY: y };
            }
        }
    }
    // FIXME: handle better
    throw new Error("No valid position found");
}

/**
 * @returns {[centerX: number, centerY: number]} [centerX, centerY]
 */
function seat_center_exact(gridX, gridY) {
    return [gridX + SEAT_GRID_W / 2, gridY + SEAT_GRID_H / 2];
}

function calculate_distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

/**
 * Set the transform on the seat
 * Same as abs_loc if not selected, when selected the transform is
 * relative to the start of the selection
 */
function elem_grid_pos_set(elem_ref, gridX, gridY) {
    elem_ref.style.transform = GRID_POS_TRANSFORM;
    elem_ref.style.setProperty(PROP_GRID_POS_X, gridX);
    elem_ref.style.setProperty(PROP_GRID_POS_Y, gridY);
}

/**
 * Get the transform of the seat
 * Same as abs_loc if not selected, when selected the transform is
 * relative to the start of the selection
 */
function elem_grid_pos_get(elem_ref) {
    const x = Number.parseInt(elem_ref.style.getPropertyValue(PROP_GRID_POS_X));
    const y = Number.parseInt(elem_ref.style.getPropertyValue(PROP_GRID_POS_Y));

    assert(Number.isSafeInteger(x), "x is int", x);
    assert(Number.isSafeInteger(y), "y is int", y);
    return [x, y];
}

/**
 * @param {HTMLElement} elem_ref
 * @param {boolean} is_invalid
 */
function elem_invalid_set(elem_ref, is_invalid) {
    if (is_invalid) {
        elem_ref.dataset["invalid"] = "";
    } else {
        delete elem_ref.dataset["invalid"];
    }
}

/**
 * Set the transform on the seat to the seats abs_loc
 * Used to restore seat position after failed move or when deselecting
 */
function seat_grid_pos_revert_to_abs_loc(seat_ref) {
    const [absX, absY] = seat_abs_loc_get(seat_ref);
    elem_grid_pos_set(seat_ref, absX, absY);
}

/**
 * Get the absolute location of the seat, regardless of selection status.
 * Will not effect the transform (visual location)
 */
function seat_abs_loc_set(seat_ref, gridX, gridY) {
    assert(is_seat_ref(seat_ref), "seat_ref is seat", seat_ref);
    assert(Number.isSafeInteger(gridX), "gridX is int", gridX);
    assert(Number.isSafeInteger(gridY), "gridY is int", gridY);

    seat_ref.dataset.x = gridX;
    seat_ref.dataset.y = gridY;
}

/**
 * Get the absolute location of the seat, regardless of selection status.
 * used for storage only
 */
function seat_abs_loc_get(seat_ref) {
    assert(seat_ref instanceof Element, "seat_ref is element", seat_ref);
    const gridX = Number.parseInt(seat_ref.dataset.x);
    const gridY = Number.parseInt(seat_ref.dataset.y);
    assert(Number.isSafeInteger(gridX), "gridX is int", gridX);
    assert(Number.isSafeInteger(gridY), "gridY is int", gridY);
    return [gridX, gridY];
}

/**
 * Set the transform and abs_loc on the seat
 */
function seat_loc_set(seat_ref, gridX, gridY) {
    assert(seat_ref instanceof Element, "seat_ref is element", seat_ref);

    assert(Number.isSafeInteger(gridX), "gridX is number", gridX);
    assert(Number.isSafeInteger(gridY), "gridY is number", gridY);

    elem_grid_pos_set(seat_ref, gridX, gridY);

    seat_abs_loc_set(seat_ref, gridX, gridY);
}

function seat_student_drop_indication_enable(seat_ref) {
    seat_ref.dataset[SEAT_DATA_STUDENT_DROP_INDICATION] = "";
}

function seat_student_drop_indication_disable(seat_ref) {
    if (SEAT_DATA_STUDENT_DROP_INDICATION in seat_ref.dataset) {
        delete seat_ref.dataset[SEAT_DATA_STUDENT_DROP_INDICATION];
    }
}

function unseated_students_get() {
    const students = sidebar_student_list_ref.querySelectorAll("[data-student]"); // TODO: constantt
    return students;
}

/**
 * @param {HTMLElement} seat_ref
 * @returns {HTMLElement | null}
 */
function seat_student_get(seat_ref) {
    const students = seat_ref.querySelectorAll("[data-student]"); // TODO: constant
    assert(students.length <= 1, "no more than 1 student per seat", students);
    if (students.length === 0) {
        return null;
    }
    return students[0];
}

/**
 * @param {HTMLElement} seat_ref
 * @param {HTMLElement} student_ref
 */
function seat_student_set(seat_ref, student_ref) {
    student_ref.className = STUDENT_CLASSLIST_SEATING;
    seat_ref.appendChild(student_ref);
    // TODO: assert seat_ref.id is valid id
    student_ref.dataset[STUDENT_DATA_SEAT_ID] = seat_ref.id;
}

/**
 * @param {HTMLElement} seat_ref
 * @returns {HTMLElement | null} student_ref or null if no student
 */
function seat_student_pop(seat_ref) {
    const student = seat_student_get(seat_ref);
    if (student == null) {
        return null;
    }

    assert(
        STUDENT_DATA_SEAT_ID in student.dataset,
        "seat-index in student dataset",
        student.dataset
    );

    delete student.dataset[STUDENT_DATA_SEAT_ID];
    return student;
}

/**
 * @param {HTMLElement} dest_seat_ref
 * @param {HTMLElement} student_ref
 */
function seat_student_transfer(dest_seat_ref, student_ref) {
    const student_in_seat_ref = seat_student_get(dest_seat_ref);

    const original_seat_ref = student_seat_get(student_ref);

    if (original_seat_ref === dest_seat_ref) {
        return;
    }

    if (original_seat_ref) {
        const original_student_ref = seat_student_pop(original_seat_ref);
        assert(
            original_student_ref == student_ref,
            "student in original seat and transferring student are the same student"
        );

        if (student_in_seat_ref) {
            // move student in dest to the incoming students original seat
            elem_animate_move_swap(
                student_in_seat_ref,
                () => {
                    const also_student_in_seat_ref = seat_student_pop(dest_seat_ref);
                    assert(
                        also_student_in_seat_ref === student_in_seat_ref,
                        "student in seat did not change",
                        { also_student_in_seat_ref, student_in_seat_ref }
                    );
                    seat_student_set(original_seat_ref, student_in_seat_ref);
                },
                student_ref
            );
        }
    } else if (student_in_seat_ref) {
        // move student in seat to sidebar if thats where incomming student
        // came from
        elem_animate_move(student_in_seat_ref, () =>
            student_make_unseated(student_in_seat_ref)
        );
    }

    seat_student_set(dest_seat_ref, student_ref);
}

/** @returns {elem is HTMLDivElement} */
function is_seat_ref(elem) {
    return (
        elem != null &&
        elem instanceof HTMLDivElement &&
        SEAT_DATA_IDENTIFIER in elem.dataset
    );
}

function seat_ref_get_by_id(seat_id) {
    const seat_ref = document.getElementById(seat_id);
    assert(seat_ref != null, "seat ref not null", seat_id, seat_ref);
    assert(is_seat_ref(seat_ref), "seat ref is seat", seat_id, seat_ref);
    return seat_ref;
}

function seat_create(gridX, gridY, id = null) {
    const element = document.createElement("div");
    const elementClassName =
        "bg-cerulean border-2 border-cerulean-dark text-center text-xl font-bold absolute data-[selected]:ring-2 data-[selected]:ring-cerulean-light data-[studentdragover]:border-cerulean-light data-[studentdragover]:border-4 data-[invalid]:border-melon-dark flex items-center justify-center focus:ring-2 focus:ring-blue-500";
    element.className = elementClassName;
    element.id = id ?? ID.generate_for("seat");
    element.tabIndex = 0;
    element.draggable = true;
    element.style.width = grid_cell_px_dim(SEAT_PROP_GRID_W);
    element.style.height = grid_cell_px_dim(SEAT_PROP_GRID_H);
    element.dataset[SEAT_DATA_IDENTIFIER] = "";
    seat_refs.push(element);

    const gridCellPx = grid_cell_px_get();
    const { gridX: snapX, gridY: snapY } = closest_non_overlapping_pos(
        element,
        gridX * gridCellPx,
        gridY * gridCellPx
    );
    seat_loc_set(element, snapX, snapY);

    element.ondragstart = function (event) {
        const seat_ref = event.currentTarget;
        assert(is_seat_ref(seat_ref), "seat ref is seat", seat_ref);

        dbg_clear_all_dots();
        console.log("DRAG SEAT START", element.dataset);
        if ("selected" in element.dataset) {
            console.log("dragging selected seat");
            return;
        }

        selection_clear();

        event.dataTransfer.setData("text/plain", seat_ref.id); // TODO: deskribe/id mime type
        event.dataTransfer.setData(DRAG_DATA_TYPE_KIND, DRAG_DATA_TYPE_KIND_SEAT);
        elem_drag_offset_set(event.target, event.clientX, event.clientY);
        // seat_gridloc_save(event.target);
        event.dataTransfer.setDragImage(invisible_drag_preview_ref, 0, 0);

        {
            // create drag preview
            const [seatGridX, seatGridY] = elem_grid_pos_get(element);
            preview_show(seatGridX, seatGridY);
        }

        element.style.zIndex = 999;
    };

    element.ondrag = function (event) {
        chartDomRect = chart_ref.getBoundingClientRect();
        assert(chartDomRect != null, "chartDomRect not null");

        const [offsetX, offsetY] = elem_drag_offset_get(event.target);
        const [grid_offset_x, grid_offset_y] = grid_offset_get();
        const grid_cell_px = grid_cell_px_get();
        const grid_offset_x_px = grid_offset_x * grid_cell_px;
        const grid_offset_y_px = grid_offset_y * grid_cell_px;

        const grid_scroll_x_px = chart_ref.scrollLeft;
        const grid_scroll_y_px = chart_ref.scrollTop;

        const x =
            event.clientX -
            chartDomRect.left -
            offsetX
            ;
        const y =
            event.clientY -
            chartDomRect.top -
            offsetY
            ;

        element.style.transform = `translate(${x}px, ${y}px)`;

        const snapped_loc = closest_non_overlapping_pos(element, x, y);
        console.log("snapped_loc", snapped_loc)
        {
            assert(seat_preview_ref != null, "preview not null");
            elem_grid_pos_set(seat_preview_ref, snapped_loc.gridX, snapped_loc.gridY);
        }
    };

    element.ondragend = function (event) {
        preview_hide();

        const seat_ref = event.target;

        if (!is_seat_ref(seat_ref)) {
            console.warn("drag end bubbled from non-seat", seat_ref);
            return;
        }

        elem_drag_offset_clear(seat_ref);
        if (event.dataTransfer.dropEffect !== "none") {
            return;
        }
        // drop failed

        elem_apply_onetime_transition(seat_ref, "transform 0.3s ease-out");
        seat_grid_pos_revert_to_abs_loc(seat_ref);
        // const abs_loc = seat_abs_loc_get(element);
    };

    element.ondragover = function (event) {
        if (
            event.dataTransfer.getData(DRAG_DATA_TYPE_KIND) !==
            DRAG_DATA_TYPE_KIND_STUDENT
        ) {
            return;
        }

        e.preventDefault();
        // e.stopPropagation()
    };

    element.ondragenter = function (event) {
        if (!event.dataTransfer.types.includes("deskribe/student")) {
            return;
        }

        seat_student_drop_indication_enable(event.target);
    };

    element.ondragleave = function (event) {
        if (!event.dataTransfer.types.includes("deskribe/student")) {
            return;
        }

        const seat_student = seat_student_get(event.currentTarget);
        const is_dragging_over_student_in_seat =
            seat_student != null &&
            (event.composedPath().includes(seat_student) ||
                event.relatedTarget === seat_student);
        if (is_dragging_over_student_in_seat) {
            // don't disable drop indication when student is dragged over the
            // student in this seat
            return;
        }

        seat_student_drop_indication_disable(event.currentTarget);
    };

    element.ondrop = function (event) {
        const seat_ref = event.currentTarget;

        const is_dragging_student =
            event.dataTransfer.getData(DRAG_DATA_TYPE_KIND) ===
            DRAG_DATA_TYPE_KIND_STUDENT;

        if (!is_dragging_student) {
            return;
        }

        const student_index = Number.parseInt(
            event.dataTransfer.getData("text/plain")
        );

        assert(
            Number.isSafeInteger(student_index),
            "student index exists on student on drop",
            event.dataTransfer
        );

        const student_ref = student_refs[student_index];
        {
            const original_seat_ref = student_seat_get(student_ref);
            if (original_seat_ref == null) {
                action_stack_push({
                    kind: "student-seat-assign",
                    student_id: student_ref.id,
                    seat_id: seat_ref.id,
                });
            } else {
                action_stack_push({
                    kind: "student-seat-transfer",
                    student_id: student_ref.id,
                    from_seat_id: original_seat_ref.id,
                    to_seat_id: seat_ref.id,
                });
            }
        }
        seat_student_transfer(seat_ref, student_ref);

        event.stopPropagation();

        seat_student_drop_indication_disable(seat_ref);
    };

    element.onkeydown = function (event) {
        const seat_ref = event.currentTarget;
        if (!is_seat_ref(seat_ref)) {
            return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
            let student_id = null;
            const maybe_student_ref = seat_student_get(seat_ref);
            if (maybe_student_ref != null) {
                student_id = maybe_student_ref.id;
            }
            const [gridX, gridY] = seat_abs_loc_get(seat_ref);
            const seat_id = seat_ref.id;

            seat_delete(seat_ref, student_id);

            action_stack_push({
                kind: "seat-delete",
                seat_id,
                student_id,
                loc: { gridX, gridY },
            });
        }
    };

    return element;
}

/**
 * @param {HTMLElement} seat_ref
 *
 * removes seat from canvas and unseats any student in the seat
 * TODO: have return student_id because it is often needed for undo action creation
 */
function seat_delete(seat_ref) {
    assert(is_seat_ref(seat_ref), "seat_ref is seat", seat_ref);
    const maybe_student_ref = seat_student_get(seat_ref);
    if (maybe_student_ref != null) {
        student_make_unseated(maybe_student_ref);
    }

    const seat_ref_index = seat_refs.indexOf(seat_ref);
    if (seat_ref_index !== -1) {
        seat_refs.splice(seat_ref_index, 1);
    }

    seat_ref.remove();
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
}

/**
 * @param {HTMLElement} elem
 * @param {string} transition
 */
function elem_apply_onetime_transition(elem, transition) {
    let had_transition = false;
    if (elem.style.transition) {
        had_transition = true;
        elem.style.setProperty("--prev-transition", elem.style.transition);
    }
    elem.style.transition = transition;

    elem.addEventListener("transitionend", function cleanUp() {
        if (elem.style.transition !== transition) {
            elem.removeEventListener("transitionend", cleanUp);
            elem.style.removeProperty("--prev-transition");
            return;
        }
        const prev = elem.style.getPropertyValue("--prev-transition");
        if (prev) {
            assert(had_transition, "if prev then there shouldv'e been a transition");
            elem.style.transition = prev;
        } else {
            assert(
                !had_transition,
                "if no prev then there shouldn't have been transition"
            );
            delete elem.style.transition;
        }
        elem.style.removeProperty("--prev-transition");
        elem.removeEventListener("transitionend", cleanUp);
    });
}

/**
 * @param {HTMLElement} elem_ref
 * @param {() => void} move
 * @param {HTMLElement} swapping_with_ref
 */
function elem_animate_move_swap(elem_ref, move, swapping_with_ref) {
    // get swapping_with rect first so that the {top,left} values
    // are not effected by the element getting moved
    const final_elem_rect = swapping_with_ref.getBoundingClientRect();

    // Step 1: Get the initial position & create elevated container
    //         so animation appears above everything else
    const initialRect = elem_ref.getBoundingClientRect();

    // PERF: store elevated container in dom (hidden) instead
    // of recreating on each animated move
    const elevated_container_ref = document.createElement("div");
    elevated_container_ref.style.zIndex = 999;
    elevated_container_ref.style.position = "absolute";
    elevated_container_ref.className = "w-full h-full";
    elevated_container_ref.style.top = 0;
    elevated_container_ref.style.left = 0;
    const elevated_container_inner_ref = document.createElement("div");
    elevated_container_inner_ref.style.position = "relative";
    elevated_container_inner_ref.className = "w-full h-full";
    elevated_container_ref.appendChild(elevated_container_inner_ref);
    document.body.appendChild(elevated_container_ref);

    // Step 2: Move the element to the new container
    move();

    // Step 3: Calculate the difference

    // FIXME: adjust final_rect_{x,y} by difference between
    // element and swapping_with elements bounding boxes
    // to account for possible difference in size between the
    // two elements
    let final_rect_x = final_elem_rect.left;
    let final_rect_y = final_elem_rect.top;

    const deltaX = initialRect.left - final_rect_x;
    const deltaY = initialRect.top - final_rect_y;

    const final_parent_ref = elem_ref.parentElement;
    const final_next_sibling_ref = elem_ref.nextElementSibling;

    const element_prev_position = elem_ref.style.position;
    elem_ref.style.position = "absolute";
    elem_ref.style.top = initialRect.top - deltaY + "px";
    elem_ref.style.left = initialRect.left - deltaX + "px";
    elevated_container_inner_ref.appendChild(elem_ref);

    // Step 4: Apply the inverse transform
    assert(!elem_ref.style.transform, "overwriting transform");
    elem_ref.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    elem_ref.style.transition = "transform 0s";

    // Force a repaint
    elem_ref.offsetWidth;

    const distance = Math.sqrt(
        Math.pow(final_rect_x - initialRect.left, 2) +
        Math.pow(final_rect_y - initialRect.top, 2)
    );

    const duration = distance / 3000;

    // Step 5: Remove the transform with a transition
    elem_ref.style.transform = "";
    elem_ref.style.transitionProperty = "transform";
    elem_ref.style.transitionDuration = duration + "s";
    elem_ref.style.transitionTimingFunction = "linear";

    // Optional: Clean up styles after animation
    elem_ref.addEventListener("transitionend", function cleanUp() {
        elem_ref.style.transition = "";
        elem_ref.style.position = element_prev_position;
        delete elem_ref.style.top;
        delete elem_ref.style.left;
        elem_ref.removeEventListener("transitionend", cleanUp);

        if (final_next_sibling_ref) {
            final_next_sibling_ref.insertBefore(elem_ref);
        } else {
            final_parent_ref.appendChild(elem_ref);
        }
        document.body.removeChild(elevated_container_ref);
    });
}

/**
 * @param {HTMLElement} element
 * @param {() => void} move
 * @param {boolean | undefined} center
 */
function elem_animate_move(element, move, center = false) {
    // Step 1: Get the initial position
    const initialRect = element.getBoundingClientRect();

    const elevated_container = document.createElement("div");
    elevated_container.style.zIndex = 999;
    elevated_container.style.position = "absolute";
    elevated_container.className = "w-full h-full";
    elevated_container.style.top = 0;
    elevated_container.style.left = 0;
    const elevated_container_inner = document.createElement("div");
    elevated_container_inner.style.position = "relative";
    elevated_container_inner.className = "w-full h-full";
    elevated_container.appendChild(elevated_container_inner);
    document.body.appendChild(elevated_container);

    // Step 2: Move the element to the new container
    move();

    // Step 3: Calculate the difference

    const final_elem_rect = element.getBoundingClientRect();

    let final_rect_x;
    let final_rect_y;
    if (center) {
        const final_parent_rect = element.parentElement.getBoundingClientRect();
        const parent_mid_x = final_parent_rect.left + final_parent_rect.width / 2;
        const parent_mid_y = final_parent_rect.top + final_parent_rect.height / 2;
        final_rect_x = parent_mid_x - final_elem_rect.width / 2;
        final_rect_y = parent_mid_y - final_elem_rect.height / 2;
    } else {
        final_rect_x = final_elem_rect.left;
        final_rect_y = final_elem_rect.top;
    }
    const deltaX = initialRect.left - final_rect_x;
    const deltaY = initialRect.top - final_rect_y;

    const final_parent = element.parentElement;
    const final_next_sibling = element.nextElementSibling;

    const element_prev_position = element.style.position;
    element.style.position = "absolute";
    element.style.top = initialRect.top - deltaY + "px";
    element.style.left = initialRect.left - deltaX + "px";
    elevated_container_inner.appendChild(element);

    // Step 4: Apply the inverse transform
    assert(!element.style.transform, "overwriting transform");
    element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    element.style.transition = "transform 0s";

    // Force a repaint
    element.offsetWidth;

    const distance = calculate_distance(
        final_rect_x,
        final_rect_y,
        initialRect.left,
        initialRect.top
    );

    const duration = distance / 3000;

    // Step 5: Remove the transform with a transition
    element.style.transform = "";
    element.style.transitionProperty = "transform";
    element.style.transitionDuration = duration + "s";
    element.style.transitionTimingFunction = "linear";

    // Optional: Clean up styles after animation
    element.addEventListener("transitionend", function cleanUp() {
        element.style.transition = "";
        element.style.position = element_prev_position;
        delete element.style.top;
        delete element.style.left;
        element.removeEventListener("transitionend", cleanUp);

        if (final_next_sibling) {
            final_next_sibling.insertBefore(element);
        } else {
            final_parent.appendChild(element);
        }
        document.body.removeChild(elevated_container);
    });
}

function elem_drag_offset_set(elem, clientX, clientY) {
    assert(chartDomRect != null, "containerDomRect not null");
    assert(elem != null, "elem not null");
    assert(Number.isSafeInteger(clientX), "clientX is int", clientY);
    assert(Number.isSafeInteger(clientY), "clientY is int", clientY);

    const rect = elem.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    elem.dataset.offsetx = offsetX;
    elem.dataset.offsety = offsetY;
}

function elem_drag_offset_get(elem) {
    assert(elem != null, "elem not null");
    const offsetX = Number.parseInt(elem.dataset.offsetx);
    const offsetY = Number.parseInt(elem.dataset.offsety);
    assert(
        Number.isSafeInteger(offsetX),
        "offsetX is integer",
        offsetX,
        elem.dataset.offsetx
    );
    assert(
        Number.isSafeInteger(offsetY),
        "offsetY is integer",
        offsetY,
        elem.dataset.offsety
    );
    return [offsetX, offsetY];
}

function elem_drag_offset_clear(elem) {
    assert(elem != null, "elem not null");
    assert("dataset" in elem, "elem is element with dataset property");

    delete elem.dataset.offsetx;
    delete elem.dataset.offsety;
}

function chart_handle_drop_seat(event) {
    event.preventDefault();
    const seat_id = event.dataTransfer.getData("text/plain");
    console.log("ON DROP", seat_id);
    assert(chartDomRect != null, "chartDomRect not null");

    const seat_ref = seat_ref_get_by_id(seat_id);

    assert(seat_preview_ref != null, "preview not null");

    const [gridX, gridY] = elem_grid_pos_get(seat_preview_ref);

    const [orig_gridX, orig_gridY] = seat_abs_loc_get(seat_ref);

    seat_loc_set(seat_ref, gridX, gridY);

    seat_ref.style.zIndex = 0;

    chart_ref.appendChild(seat_ref);

    action_stack_push({
        kind: "seat-move",
        seat_id: seat_ref.id,
        from: { gridX: orig_gridX, gridY: orig_gridY },
        dest: { gridX, gridY },
    });

    seat_preview_ref.style.display = "none";
}

function chart_handle_drop_selection(event) {
    event.preventDefault();

    assert(chartDomRect != null, "chartDomRect not null");

    const [offsetX, offsetY] = elem_drag_offset_get(selection_ref);

    const gridCellPx = grid_cell_px_get();

    const [gridX, gridY] = px_point_to_grid_round(
        gridCellPx,
        event.clientX - chartDomRect.left - offsetX,
        event.clientY - chartDomRect.top - offsetY
    );

    const {
        start: { gridX: startX, gridY: startY },
        end: { gridX: endX, gridY: endY },
    } = selected_region;

    const width = endX - startX;
    const height = endY - startY;

    selected_region.start.gridX = gridX;
    selected_region.start.gridY = gridY;
    selected_region.end.gridX = gridX + width;
    selected_region.end.gridY = gridY + height;

    selection_update();

    console.log("ON DROP SELECTION");
}

function elem_make_invisible(elem) {
    elem.style.setProperty("visibility", "hidden");
}

function elem_make_visible(elem) {
    if (elem.style.getPropertyValue("visibility") != "hidden") return;
    elem.style.removeProperty("visibility");
}

function student_seat_get(student_ref) {
    const seat_id = student_ref.dataset[STUDENT_DATA_SEAT_ID];
    if (!seat_id) {
        return null;
    }
    return seat_ref_get_by_id(seat_id);
}

/** @returns {elem is HTMLDivElement} */
function is_student_ref(elem) {
    return (
        elem != null &&
        elem instanceof HTMLDivElement &&
        STUDENT_DATA_IDENTIFIER in elem.dataset
    );
}

/**
 * @param {string} student_id
 * @returns {HTMLDivElement}
 */
function student_ref_get_by_id(student_id) {
    const student_ref = document.getElementById(student_id);
    assert(student_ref != null, "student ref not null", student_id, student_ref);
    assert(
        is_student_ref(student_ref),
        "student ref is student",
        student_id,
        student_ref
    );
    return student_ref;
}

function student_make_unseated(student_ref) {
    student_ref.className = STUDENT_CLASSLIST_SIDEBAR;

    assert(
        STUDENT_DATA_SEAT_ID in student_ref.dataset,
        "student to be unseated must be in seat",
        student_ref
    );
    delete student_ref.dataset[STUDENT_DATA_SEAT_ID];

    sidebar_student_list_ref.appendChild(student_ref);
}

function student_create(name, id = null) {
    const student_ref = document.createElement("div");
    student_ref.className = STUDENT_CLASSLIST_SIDEBAR;
    student_ref.textContent = name;
    student_ref.dataset[STUDENT_DATA_IDENTIFIER] = "";

    student_ref.id = id ?? ID.generate_for("student");

    const student_index = student_refs.length;
    student_refs.push(student_ref);

    student_ref.draggable = true;

    student_ref.ondragstart = function (event) {
        event.stopPropagation();

        const student_ref = event.currentTarget;

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
            DRAG_DATA_TYPE_KIND,
            DRAG_DATA_TYPE_KIND_STUDENT
        );
        event.dataTransfer.setData("text/plain", student_index);
        event.dataTransfer.setData("deskribe/student", "");

        student_ref.style.zIndex = 50;
    };

    student_ref.ondrag = function (event) {
        elem_make_invisible(event.target);
        event.stopPropagation();
    };

    student_ref.ondragover = function (event) {
        event.preventDefault();
    };

    student_ref.ondragend = function (event) {
        const student_ref = event.currentTarget;
        elem_make_visible(student_ref);
        event.stopPropagation();
    };

    return student_ref;
}

/**
* @param x {number}
* @param y {number}
*/
function grid_offset_set(x, y) {
    assert(Number.isSafeFloat(x), 'grid offset x is safe integer');
    assert(Number.isSafeFloat(y), 'grid offset y is safe integer');
    chart_ref.style.setProperty(GRID_PROP_OFFSET_X, x);
    chart_ref.style.setProperty(GRID_PROP_OFFSET_Y, y);
}

/**
* @returns {[x: number, y: number]}
*/
function grid_offset_get() {
    const x = Number.parseFloat(chart_ref.style.getPropertyValue(GRID_PROP_OFFSET_X));
    const y = Number.parseFloat(chart_ref.style.getPropertyValue(GRID_PROP_OFFSET_Y));
    assert(Number.isSafeFloat(x), 'grid offset x is safe integer');
    assert(Number.isSafeFloat(y), 'grid offset y is safe integer');
    return [x, y];
}

function grid_offset_update(x, y) {
    const [old_x, old_y] = grid_offset_get();
    grid_offset_set(old_x + x, old_y + y);
}


/**
* @returns {[x: number, y: number]}
*/
function grid_center_estimate() {
    const chart_dom_rect = chart_ref.getBoundingClientRect();
    const grid_cell_px = grid_cell_px_get();

    const center_x = chart_dom_rect.width / 2;
    const center_y = chart_dom_rect.height / 2;

    return px_point_to_grid_round(grid_cell_px, center_x, center_y);
}


// {{{ Action Stack
/** @type {number} */
let action_stack_index = -1;

/** @type {Array<Action>} */
let action_stack = [];

/**
 * @typedef {Action_Seat_Move | Action_Seat_Create | Action_Seat_Delete | Action_Student_Seat_Assign | Action_Student_Seat_Transfer | Action_Grid_Resize | Action_Selection_Move | Action_Clear_Students | Action_Clear_Seats} Action
 */

/**
 * @typedef {Object} GridPoint
 * @property {number} gridX
 * @property {number} gridY
 */

/**
 * @typedef {Object} Action_Seat_Move
 * @property {'seat-move'} kind
 * @property {string} seat_id
 * @property {GridPoint} from
 * @property {GridPoint} dest
 */

/**
 * @typedef {Object} Action_Seat_Create
 * @property {'seat-create'} kind
 * @property {string} seat_id
 * @property {GridPoint} loc
 */

/**
 * @typedef {Object} Action_Seat_Delete
 * @property {'seat-delete'} kind
 * @property {string} seat_id
 * @property {string?} student_id
 * @property {GridPoint} loc
 */

/**
 * @typedef {Object} Action_Student_Seat_Assign
 * @property {'student-seat-assign'} kind
 * @property {string} student_id
 * @property {string} seat_id
 */

/**
 * @typedef {Object} Action_Student_Seat_Transfer
 * @property {'student-seat-transfer'} kind
 * @property {string} student_id
 * @property {string} from_seat_id
 * @property {string} to_seat_id
 */

/**
 * @typedef {Object} Action_Selection_Move
 * @property {'selection-move'} kind
 * @property {GridPoint} from_start
 * @property {GridPoint} from_end
 * @property {GridPoint} dest_start
 * @property {GridPoint} dest_end
 */

/**
 * @typedef {Object} Action_Clear_Students
 * @property {'clear-students'} kind
 * @property {Record<string, string>} student_id_to_seat_id
 */

/**
 * @typedef {Object} Action_Clear_Seats
 * @property {'clear-seats'} kind
 * @property {Array<{id: string, gridX: number, gridY: number, student_id: string | null}>} seats
 */

/**
 * @param {Action} action
 */
function action_stack_push(action) {
    if (action_stack_index < action_stack.length - 1) {
        // TODO: this removes all undone actions, consider inserting here and
        // then checking
        action_stack.splice(
            action_stack_index + 1,
            action_stack.length - action_stack_index - 1,
            action
        );
    } else {
        action_stack.push(action);
    }
    action_stack_index = action_stack.length - 1;
    /*
      console.log(
      "action_stack_push",
      action_stack_index,
      action_stack.slice(0, action_stack_index),
      action_stack[action_stack_index],
      action_stack.slice(action_stack_index + 1)
      );
      */
}

function action_stack_undo() {
    if (action_stack_index < 0) {
        return;
    }
    const action = action_stack[action_stack_index];
    switch (action.kind) {
        case "seat-move": {
            const seat_ref = seat_ref_get_by_id(action.seat_id);
            seat_loc_set(seat_ref, action.from.gridX, action.from.gridY);
            break;
        }
        case "seat-create": {
            const seat_ref = seat_ref_get_by_id(action.seat_id);
            seat_delete(seat_ref);
            break;
        }
        case "seat-delete": {
            const seat_ref = seat_create(
                action.loc.gridX,
                action.loc.gridY,
                action.seat_id
            );
            if (action.student_id != null) {
                seat_student_set(seat_ref, student_ref_get_by_id(action.student_id));
            }
            chart_ref.appendChild(seat_ref);
            break;
        }
        case "student-seat-assign": {
            const student_ref = student_ref_get_by_id(action.student_id);
            student_make_unseated(student_ref);
            break;
        }
        case "student-seat-transfer": {
            const student_ref = student_ref_get_by_id(action.student_id);
            const from_seat_ref = seat_ref_get_by_id(action.from_seat_id);
            seat_student_transfer(from_seat_ref, student_ref);
            break;
        }
        case "selection-move": {
            selection_create(
                action.dest_start.gridX,
                action.dest_start.gridY,
                action.dest_end.gridX,
                action.dest_end.gridY
            );
            assert(selected_region != null, "selection exists");
            selected_region.start = action.from_start;
            selected_region.end = action.from_end;
            selection_update();
            break;
        }
        case "clear-students": {
            for (const [student_id, seat_id] of Object.entries(
                action.student_id_to_seat_id
            )) {
                const student_ref = student_ref_get_by_id(student_id);
                if (!is_student_ref(student_ref)) {
                    continue;
                }
                const seat_ref = seat_ref_get_by_id(seat_id);
                if (!is_seat_ref(seat_ref)) {
                    continue;
                }
                seat_student_set(seat_ref, student_ref);
            }
            break;
        }
        case "clear-seats": {
            for (const seat of action.seats) {
                const seat_ref = seat_create(seat.gridX, seat.gridY, seat.id);
                if (seat.student_id != null) {
                    const student_ref = student_ref_get_by_id(seat.student_id);
                    if (is_student_ref(student_ref)) {
                        seat_student_set(seat_ref, student_ref);
                    }
                }
                chart_ref.appendChild(seat_ref);
            }
            break;
        }
        default:
            console.warn("tried to undo unknown action kind", action);
    }
    action_stack_index--;
    /*
      console.log(
      "action_stack_undo",
      action_stack_index,
      action_stack.slice(0, action_stack_index),
      action_stack[action_stack_index],
      action_stack.slice(action_stack_index + 1)
      );
      */
}

function action_stack_redo() {
    action_stack_index++;
    if (action_stack_index < 0 || action_stack_index == action_stack.length) {
        action_stack_index--;
        return;
    }
    const action = action_stack[action_stack_index];
    assert(action != null);

    console.log("redo", action.kind);
    switch (action.kind) {
        case "seat-move": {
            const seat_ref = seat_ref_get_by_id(action.seat_id);
            seat_loc_set(seat_ref, action.dest.gridX, action.dest.gridY);
            break;
        }
        case "seat-create": {
            const seat_ref = seat_create(
                action.loc.gridX,
                action.loc.gridY,
                action.seat_id
            );
            chart_ref.appendChild(seat_ref);
            break;
        }
        case "seat-delete": {
            const seat_ref = seat_ref_get_by_id(action.seat_id);
            seat_delete(seat_ref);
            break;
        }
        case "student-seat-assign": {
            const student_ref = student_ref_get_by_id(action.student_id);
            const seat_ref = seat_ref_get_by_id(action.seat_id);
            seat_student_set(seat_ref, student_ref);
            break;
        }
        case "student-seat-transfer": {
            const student_ref = student_ref_get_by_id(action.student_id);
            const to_seat_ref = seat_ref_get_by_id(action.to_seat_id);
            seat_student_transfer(to_seat_ref, student_ref);
            break;
        }
        case "selection-move": {
            // create selection at original location so it includes
            // seats that were selected and so we make sure it exists
            // (selection clear is not an action)
            selection_create(
                action.from_start.gridX,
                action.from_start.gridY,
                action.from_end.gridX,
                action.from_end.gridY
            );
            assert(selected_region != null, "selection exists");
            // then move it to where it came from
            selected_region.start = action.dest_start;
            selected_region.end = action.dest_end;
            selection_update();
            break;
        }
        case "clear-students": {
            void chart_clear_students();
            break;
        }
        case "clear-seats": {
            void chart_clear_seats();
            break;
        }
        default:
            console.warn("tried to undo unknown action kind", action);
    }
    /*
    console.log(
        "action_stack_redo",
        action_stack_index,
        action_stack.slice(0, action_stack_index),
        action_stack[action_stack_index],
        action_stack.slice(action_stack_index + 1)
    );
    */
}

//}}}

/**
 *
 * @returns {Action_Clear_Students["student_id_to_seat_id"]}
 */
function chart_clear_students() {
    const student_id_to_seat_id = {};
    for (let i = 0; i < seat_refs.length; i++) {
        const seat_ref = seat_refs[i];
        if (!is_seat_ref(seat_ref)) {
            continue;
        }
        const seat_id = seat_ref.id;
        const student_ref = seat_student_get(seat_ref);
        if (student_ref) {
            const student_id = student_ref.id;
            student_make_unseated(student_ref);
            student_id_to_seat_id[student_id] = seat_id;
        }
    }
    return student_id_to_seat_id;
}

/**
 *
 * @returns {Action_Clear_Seats["seats"]}
 */
function chart_clear_seats() {
    const seats = [];
    while (seat_refs.length > 0) {
        const seat_ref = seat_refs.pop();
        if (!is_seat_ref(seat_ref)) {
            continue;
        }
        const seat_id = seat_ref.id;
        const student_ref = seat_student_get(seat_ref);
        const student_id = student_ref ? student_ref.id : null;
        const [gridX, gridY] = seat_abs_loc_get(seat_ref);
        seats.push({ id: seat_id, gridX, gridY, student_id });
        seat_delete(seat_ref);
    }
    return seats;
}

async function chart_save() {
    console.time("save_chart");
    const id = chart_id;
    const seats = new Array();
    const students = new Array();

    for (const seat_ref of seat_refs) {
        if (seat_ref == null) {
            continue;
        }
        const seat_id = seat_ref.id;
        assert(seat_id, "seat has id", seat_ref);
        const [gridX, gridY] = seat_abs_loc_get(seat_ref);

        seats.push({ id: seat_id, gridX, gridY });

        const student_ref = seat_student_get(seat_ref);
        if (student_ref) {
            const name = student_ref.textContent;
            assert(name, "student has name", student_ref);
            const student_id = student_ref.id;
            assert(student_id, "student has id", student_ref);

            const seatID = seat_id;
            students.push({ id: student_id, name, seatID });
        }
    }

    const unseated_student_refs = unseated_students_get();
    for (const student_ref of unseated_student_refs) {
        const name = student_ref.textContent;
        assert(name, "student has name", student_ref);
        const student_id = student_ref.id;
        assert(student_id, "student has id", student_ref);

        students.push({ id: student_id, name, seatID: null });
    }

    const data = {
        id,
        seats,
        students,
        // FIXME: REMOVE
        cols: 0,
        rows: 0,
    };

    console.log("save_chart", data);

    console.time("save_chart_replicache");
    await Replicache.seating_chart_save(data);
    console.timeEnd("save_chart_replicache");
    console.timeEnd("save_chart");
}

async function init() {
    Replicache.ensure_init();

    // {{{ load
    const url_path = window.location.pathname.replace(/\/$/, ""); // pathname without trailing slash;
    chart_id = url_path.split("/").at(-1);
    assert(chart_id, "chart_id", chart_id);
    assert(
        chart_id.length == ID.LENGTH,
        "chart_id.length is",
        ID.length,
        "not",
        chart_id.length
    );

    let initial_chart_data = {
        id: chart_id,
        seats: [],
        students: [],
        rows: 30,
        cols: 60,
    };

    // FIXME: calculate
    const grid_w_initial = 60;
    const grid_h_initial = 30;

    const rep = Replicache.get_assert_init();
    const existing_chart_data = await Replicache.seating_chart_get(chart_id);
    if (existing_chart_data) {
        initial_chart_data = existing_chart_data;
    }

    console.log({ initial_chart_data });

    // }}}

    // {{{ chart
    {
        const gridCellPx_initial = Math.floor(
            // FIXME: use initial grid w
            (0.8 * window.innerWidth) / grid_w_initial
        );

        // TODO: init all "*_initial" grid properties here
        chart_ref.style.setProperty(
            "--grid-cell-px",
            gridCellPx_initial + "px"
        );
        chart_ref.style.setProperty(SEAT_PROP_GRID_W, SEAT_GRID_W);
        chart_ref.style.setProperty(SEAT_PROP_GRID_H, SEAT_GRID_H);

        chart_ref.style.setProperty(CHART_PROP_SCALE, "1.0");

        // TODO: use existing seat data to calculate w/h
        grid_offset_set(0, 0)

        chart_ref.ondragover = function (event) {
            event.preventDefault();
        };


        chart_ref.ondrop = function (event) {
            const kind = event.dataTransfer.getData(DRAG_DATA_TYPE_KIND);
            switch (kind) {
                case DRAG_DATA_TYPE_KIND_SEAT:
                    chart_handle_drop_seat(event);
                    break;
                case DRAG_DATA_TYPE_KIND_SELECTION:
                    chart_handle_drop_selection(event);
                    break;
                case "":
                default:
                    console.warn("unknown drop kind:", `'${kind}'`);
                    return;
            }
        };

        document.addEventListener('keydown', function (event) {
            // FIXME: Return if something other than the
            if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
                return;
            }
            if (event.key == 'a' || event.key == "ArrowLeft") {
                const [x, y] = grid_offset_get();
                grid_offset_set(x - 1, y);
                return;
            }
            if (event.key == "d" || event.key == "ArrowRight") {
                const [x, y] = grid_offset_get();
                grid_offset_set(x + 1, y);
                return;
            }
            if (event.key == "w" || event.key == "ArrowUp") {
                const [x, y] = grid_offset_get();
                grid_offset_set(x, y - 1);
                return;
            }
            if (event.key == "s" || event.key == "ArrowDown") {
                const [x, y] = grid_offset_get();
                grid_offset_set(x, y + 1);
                return;
            }

        })

        chart_ref.addEventListener("wheel", function (event) {
            if (event.ctrlKey) {
                return;
            }
            const grid_cell_px = grid_cell_px_get();
            const delta_x = event.deltaX / grid_cell_px
            const delta_y = event.deltaY / grid_cell_px;
            grid_offset_update(delta_x, delta_y);
        })

        chart_ref.addEventListener("mousedown", function (event) {
            if (event.button == 1) {
                chart_ref.dataset['moving'] = "";
            }
        })
        chart_ref.addEventListener("mousemove", function (event) {
            if (!('moving' in chart_ref.dataset)) {
                return;
            }
            const grid_cell_px = grid_cell_px_get();
            const delta_x = -event.movementX / grid_cell_px;
            const delta_y = -event.movementY / grid_cell_px;
            window.requestAnimationFrame(() => grid_offset_update(delta_x, delta_y));
        });
        chart_ref.addEventListener("mouseup", function (event) {
            if (!('moving' in chart_ref.dataset)) {
                return;
            }
            delete chart_ref.dataset['moving'];
            const grid_cell_px = grid_cell_px_get();
            const delta_x = -event.movementX / grid_cell_px;
            const delta_y = -event.movementY / grid_cell_px;
            window.requestAnimationFrame(() => grid_offset_update(delta_x, delta_y));
        });
        chart_ref.addEventListener("mouseleave", function () {
            delete chart_ref.dataset['moving'];
        })
    }
    // }}}

    // {{{ initial seats + students
    {
        const seats = initial_chart_data.seats;
        for (const seat of seats) {
            chart_ref.appendChild(seat_create(seat.gridX, seat.gridY, seat.id));
        }

        const students = initial_chart_data.students;
        for (const student of students) {
            const student_ref = student_create(student.name, student.id);
            if (student.seatID == null) {
                sidebar_student_list_ref.appendChild(student_ref);
                continue;
            }
            const seat_ref = document.getElementById(student.seatID);
            assert(
                seat_ref != null,
                "student seatID seat exists",
                student,
                initial_chart_data
            );
            seat_student_set(seat_ref, student_ref);
        }
    }
    // }}}

    // {{{ seat preview
    {
        seat_preview_ref.id = "seat-preview";
        seat_preview_ref.className =
            "absolute bg-blue-300 border-2 border-indigo-500";
        seat_preview_ref.style.display = "none";
        seat_preview_ref.style.width = grid_cell_px_dim(SEAT_PROP_GRID_W);
        seat_preview_ref.style.height = grid_cell_px_dim(SEAT_PROP_GRID_H);
        chart_ref.appendChild(seat_preview_ref);
    }
    // }}}

    // {{{ zoom
    {
        const ZOOM_ID__IN = "zoom-in";
        const ZOOM_ID_OUT = "zoom-out";

        const zoom_btn__in = document.getElementById(ZOOM_ID__IN);
        const zoom_btn_out = document.getElementById(ZOOM_ID_OUT);

        zoom_btn__in.addEventListener("click", function () {
            grid_cell_px_adjust(+ZOOM_BTN_SCALE_FACTOR);
        });
        zoom_btn_out.addEventListener("click", function () {
            grid_cell_px_adjust(-ZOOM_BTN_SCALE_FACTOR);
        });

        // add to parent so that zoom still works if event triggers outside canvas
        // bounds and zoom is not interupted if zoom causes canvas to no longer be
        // under mouse (i.e. canvas shrinks)
        chart_ref.parentElement.addEventListener("wheel", function (event) {
            if (!event.ctrlKey) {
                return;
            }

            grid_cell_px_adjust(-event.deltaY / 250);
            // TODO: center zoom on mouse position

            // TODO: consider this more deeply. Breaks site zoom when mouse over canvas
            event.preventDefault();
        });
    }
    // }}}

    // {{{ seat controls
    {
        document.getElementById("add-seat-button").addEventListener("click", () => {
            console.log("creating new seat");
            const [center_gridX, center_gridY] = grid_center_estimate();
            const seat_ref = seat_create(center_gridX - SEAT_GRID_W / 2, center_gridY - SEAT_GRID_H / 2);
            chart_ref.appendChild(seat_ref);
            action_stack_push({
                kind: "seat-create",
                seat_id: seat_ref.id,
                loc: { gridX: 0, gridY: 0 },
            });
        });

        chart_ref.addEventListener("click", function (event) {
            if (!event.ctrlKey || is_creating_selection) {
                return;
            }
            event.preventDefault();

            chartDomRect = chart_ref.getBoundingClientRect();

            const px_x =
                event.clientX - chartDomRect.left;
            const px_y =
                event.clientY - chartDomRect.top;
            const [center_gridX, center_gridY] = px_point_to_grid_round(
                grid_cell_px_get(),
                px_x,
                px_y
            );

            const gridX = Math.round(center_gridX - SEAT_GRID_W / 2);
            const gridY = Math.round(center_gridY - SEAT_GRID_H / 2);

            const seat_ref = seat_create(gridX, gridY);

            chart_ref.appendChild(seat_ref);

            action_stack_push({
                kind: "seat-create",
                seat_id: seat_ref.id,
                loc: { gridX, gridY },
            });
        });
    }
    // }}}

    // {{{ selection
    {
        selection_ref.id = "selection";
        selection_ref.className =
            "absolute bg-cyan-300/20 ring-2 ring-blue-500 z-5 data-[invalid]:bg-melon/20 data-[invalid]:ring-melon-dark";
        selection_ref.style.display = "none";
        selection_ref.draggable = true;
        chart_ref.appendChild(selection_ref);

        ////////////////////////
        // creating selection //
        ////////////////////////

        chart_ref.addEventListener("mousedown", function (event) {
            if (event.ctrlKey || event.button != 0) {
                return;
            }
            chartDomRect = chart_ref.getBoundingClientRect();
            {
                // ensure not clicking something besides container
                const path = event.composedPath();
                if (path.at(0)?.id !== chart_ref.id) {
                    return;
                }
            }

            if (selected_region != null) {
                selection_clear();
            }

            const gridCellPx = grid_cell_px_get();

            const x_px = event.clientX - chartDomRect.left
            const y_px = event.clientY - chartDomRect.top
            const [gridX, gridY] = px_point_to_grid_round(gridCellPx, x_px, y_px);
            selected_region = {
                start: { gridX, gridY },
                end: { gridX: gridX + 1, gridY: gridY + 1 },
                anchor: { gridX, gridY },
            };
            selection_update();
            selection_ref.draggable = "false";
            selection_ref.dataset['started'] = '';
            is_creating_selection = true;
            selection_force_appear_below_seats();
        });

        chart_ref.addEventListener("mousemove", function (event) {
            if ('moving' in chart_ref.dataset) {
                return;
            }
            if (!is_creating_selection || selected_region == null) {
                // selection_clear();
                return;
            }
            chartDomRect = chart_ref.getBoundingClientRect();

            const gridCellPx = grid_cell_px_get();

            const x_px = event.clientX - chartDomRect.left;
            const y_px = event.clientY - chartDomRect.top;
            const [gridX, gridY] = px_point_to_grid_round(gridCellPx, x_px, y_px);
            selected_region_end_set(gridX, gridY);

            selection_update();
        });

        chart_ref.addEventListener("mouseup", function (event) {
            if (!('started' in selection_ref.dataset)) {
                // don't remove selection on mouse up where mouse down didn't start a selection
                return;
            }
            delete selection_ref.dataset['started'];

            if (!is_creating_selection || selected_region == null) {
                selection_clear();
                return;
            }

            chartDomRect = chart_ref.getBoundingClientRect();
            console.log("mouse up");

            const gridCellPx = grid_cell_px_get();

            const x_px = event.clientX - chartDomRect.left;
            const y_px = event.clientY - chartDomRect.top;
            const [gridX, gridY] = px_point_to_grid_round(gridCellPx, x_px, y_px);
            selected_region_end_set(gridX, gridY);

            const selected_seats = selected_seats_compute();

            if (selected_seats == null) {
                console.log("empty selection");
                selection_clear();
                return;
            }

            selection_update();
            selected_seats_update(selected_seats);
            is_creating_selection = false;
            selection_ref.draggable = "true";
            selection_force_appear_above_seats();
        });
        ////////////////////////
        // dragging selection //
        ////////////////////////

        selection_ref.ondragstart = function (event) {
            if (is_creating_selection || selected_region == null) {
                console.log("selection not ondragstart");
                event.preventDefault();
                return;
            }
            event.dataTransfer.setData(
                DRAG_DATA_TYPE_KIND,
                DRAG_DATA_TYPE_KIND_SELECTION
            );
            event.dataTransfer.setDragImage(invisible_drag_preview_ref, 0, 0);

            const selection_ref = event.target;
            elem_drag_offset_set(selection_ref, event.clientX, event.clientY);

            selection_ref.dataset.startx = selected_region.start.gridX;
            selection_ref.dataset.starty = selected_region.start.gridY;
            selection_ref.dataset.endx = selected_region.end.gridX;
            selection_ref.dataset.endy = selected_region.end.gridY;
        };

        selection_ref.ondrag = function (event) {
            chartDomRect = chart_ref.getBoundingClientRect();
            assert(chartDomRect != null, "containerDomRect not null");
            assert(selected_region != null, "selected_region not null");

            const [offsetX, offsetY] = elem_drag_offset_get(event.target);

            const gridCellPx = grid_cell_px_get();

            const [gridX, gridY] = px_point_to_grid_round(
                gridCellPx,
                event.clientX - chartDomRect.left - offsetX,
                event.clientY - chartDomRect.top - offsetY
            );


            const {
                start: { gridX: startX, gridY: startY },
                end: { gridX: endX, gridY: endY },
            } = selected_region;

            const width = endX - startX;
            const height = endY - startY;

            selected_region.start.gridX = gridX;
            selected_region.start.gridY = gridY;
            selected_region.end.gridX = gridX + width;
            selected_region.end.gridY = gridY + height;

            selection_update();
        };

        selection_ref.ondragend = function (event) {
            if (selected_region == null) {
                console.warn("no selection on ondragend");
            }

            const drop_succeeded = event.dataTransfer.dropEffect !== "none";
            if (drop_succeeded) {
                const from_startX = Number.parseInt(selection_ref.dataset.startx);
                const from_startY = Number.parseInt(selection_ref.dataset.starty);
                const from_endX = Number.parseInt(selection_ref.dataset.endx);
                const from_endY = Number.parseInt(selection_ref.dataset.endy);

                const dest_startX = selected_region.start.gridX;
                const dest_startY = selected_region.start.gridY;
                const dest_endX = selected_region.end.gridX;
                const dest_endY = selected_region.end.gridY;

                action_stack_push({
                    kind: "selection-move",
                    from_start: { gridX: from_startX, gridY: from_startY },
                    from_end: { gridX: from_endX, gridY: from_endY },
                    dest_start: { gridX: dest_startX, gridY: dest_startY },
                    dest_end: { gridX: dest_endX, gridY: dest_endY },
                });

                delete selection_ref.dataset.startx;
                delete selection_ref.dataset.starty;
                delete selection_ref.dataset.endx;
                delete selection_ref.dataset.endy;

                return;
            }
        };
    }
    // }}}

    // {{{ copy and pasting selection
    {
        window.addEventListener("copy", function (event) {
            const window_selection = window.getSelection();
            if (window_selection && window_selection.toString().length > 0) {
                // don't copy selection if user is trying to copy
                // something else
                return;
            }
            if (!selected_region) {
                // don't copy if no selection
                console.warn("no selected region");
                return;
            }

            if (is_creating_selection) {
                console.warn("cannot copy selection while creating");
                return;
            }

            if (!event.clipboardData) {
                console.warn("no clipboardData!");
                return;
            }
            event.preventDefault();

            const selected_offsets = [];

            const selected_seats = selected_seat_refs_get();
            for (const seat_ref of selected_seats) {
                const [gridX, gridY] = elem_grid_pos_get(seat_ref);
                selected_offsets.push({ gridX, gridY });
            }

            const [width, height] = selection_dims_get();

            event.clipboardData.setData(
                SELECTION_CLIPBOARD_DATA_TYPE,
                JSON.stringify({
                    selected_offsets,
                    width,
                    height,
                })
            );
        });

        window.addEventListener("paste", function (event) {
            if (!event.clipboardData) {
                return;
            }

            const selection_data_str = event.clipboardData.getData(
                SELECTION_CLIPBOARD_DATA_TYPE
            );

            if (!selection_data_str) {
                return;
            }

            event.preventDefault();

            let selection_data;
            try {
                selection_data = JSON.parse(selection_data_str);
            } catch (e) {
                console.error("failed to parse selection data", e);
                return;
            }

            assert(
                "selected_offsets" in selection_data &&
                Array.isArray(selection_data.selected_offsets)
            );
            assert(
                "width" in selection_data && typeof selection_data.width == "number"
            );
            assert(
                "height" in selection_data && typeof selection_data.height == "number"
            );

            // FIXME: implement checking if mouse is over container and getting mouse position
            // instead
            const [startX, startY] = grid_center_estimate();

            const endX = startX + selection_data.width;
            const endY = startY + selection_data.height;

            selection_clear();

            selected_region = {
                start: { gridX: startX, gridY: startY },
                end: { gridX: endX, gridY: endY },
            };

            selection_update();
            selection_force_appear_above_seats();

            for (const { gridX, gridY } of selection_data.selected_offsets) {
                const new_seat_ref = seat_create(startX + gridX, startY + gridY);
                seat_make_selected(new_seat_ref, gridX, gridY);
            }

            console.log("paste:", selection_data, event);
        });
    }
    // }}}

    // {{{ student controls
    {
        const sidebar_student_add = sidebar_ref.querySelector(
            "#add-student-button"
        );
        const sidebar_student_input = sidebar_ref.querySelector(
            "#student-name-input"
        );

        sidebar_student_add.onclick = () => {
            // TODO: make sidebar_student_input a local here (i.e. do document.getElementById) as this is only place it is used
            const name = sidebar_student_input.value;
            if (!name) return;
            sidebar_student_input.value = "";
            sidebar_student_list_ref.appendChild(student_create(name));
            sidebar_student_input.focus();
        };

        topbar_ref.querySelector("#clear-button").addEventListener("click", () => {
            const seats = chart_clear_seats();
            action_stack_push({
                kind: "clear-seats",
                seats,
            });
        });

        topbar_ref
            .querySelector("#clear-students-button")
            .addEventListener("click", () => {
                const student_id_to_seat_id = chart_clear_students();
                action_stack_push({
                    kind: "clear-students",
                    student_id_to_seat_id,
                });
            });
    }
    // }}}

    // {{{ autosave

    {
        console.log("starting save interval", AUTOSAVE_INTERVAL_MS);
        const _save_interval_handle = setInterval(chart_save, AUTOSAVE_INTERVAL_MS);

        const save_button = document.getElementById("save-button");

        const do_save = () => chart_save();

        save_button.onclick = do_save;
        window.addEventListener("beforeunload", do_save);
        window.addEventListener("popstate", do_save);
        window.addEventListener("pagehide", do_save);

        document.addEventListener("visibilitychange", async () => {
            if (document.visibilityState == "hidden") {
                await chart_save();
            }
        });
    }

    // }}}

    // {{{ action stack (undo/redo)
    document.addEventListener("keydown", function (event) {
        if (event.key == "z" && event.ctrlKey) {
            action_stack_undo();
        } else if (event.key == "y" && event.ctrlKey) {
            action_stack_redo();
        }
    });
    topbar_ref.querySelector("#undo-button").addEventListener("click", action_stack_undo)
    topbar_ref.querySelector("#redo-button").addEventListener("click", action_stack_redo)
    // }}}
}

init();
