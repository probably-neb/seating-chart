// Outlines of groups of boxes on the grid. Boxes that touch are drawn as
// one shape, whether or not they line up. Shared by the seats and the seat
// drag preview (seat_shapes_render), the selection (boxes_outline_path) and
// the chart previews on the index page.

/**
 * [left, top, right, bottom] in whole grid cells
 * @typedef {[number, number, number, number]} Box
 */

/**
 * @typedef {{ box: Box, kind: "seated" | "empty" | "preview" }} SeatShape
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 */
export function svg_elem_create(tag, attrs = {}) {
    const elem = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
        elem.setAttribute(name, String(value));
    }
    return elem;
}

/**
 * Outline of the union of boxes as svg path data, in grid units. Boxes that
 * touch share one outline, boxes apart get their own. The union is traced
 * on the grid first so touching boxes merge without gaps, then outer
 * corners are rounded by up to outer_radius and inner corners by up to
 * inner_radius
 *
 * @param {Array<Box>} boxes
 * @param {number} outer_radius
 * @param {number} inner_radius
 * @returns {string}
 */
export function boxes_outline_path(boxes, outer_radius, inner_radius) {
    if (boxes.length == 0) {
        return "";
    }

    const min_x = Math.min(...boxes.map((box) => box[0]));
    const min_y = Math.min(...boxes.map((box) => box[1]));
    const width = Math.max(...boxes.map((box) => box[2])) - min_x;
    const height = Math.max(...boxes.map((box) => box[3])) - min_y;

    const filled = new Uint8Array(width * height);
    for (const [left, top, right, bottom] of boxes) {
        for (let y = top - min_y; y < bottom - min_y; y++) {
            filled.fill(1, y * width + left - min_x, y * width + right - min_x);
        }
    }
    const is_filled = (x, y) =>
        x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x] == 1;

    // boundary edges between filled and empty cells, directed so the filled
    // cell is on the right, keyed by start vertex
    /** @type {Map<string, Array<[number, number]>>} */
    const edges = new Map();
    const edge_add = (x1, y1, x2, y2) => {
        const key = x1 + "," + y1;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push([x2, y2]);
    };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!is_filled(x, y)) continue;
            if (!is_filled(x, y - 1)) edge_add(x, y, x + 1, y);
            if (!is_filled(x + 1, y)) edge_add(x + 1, y, x + 1, y + 1);
            if (!is_filled(x, y + 1)) edge_add(x + 1, y + 1, x, y + 1);
            if (!is_filled(x - 1, y)) edge_add(x, y + 1, x, y);
        }
    }
    const cross = (ax, ay, bx, by) => ax * by - ay * bx;

    let d = "";
    while (edges.size > 0) {
        // start where the outline doesn't touch another one so the first step
        // is unambiguous
        let start_key = edges.keys().next().value;
        for (const [key, outs] of edges) {
            if (outs.length == 1) {
                start_key = key;
                break;
            }
        }

        /** @type {Array<[number, number]>} */
        const corners = [];
        const [start_x, start_y] = start_key.split(",").map(Number);
        let [x, y] = [start_x, start_y];
        let [dir_x, dir_y] = [0, 0];
        do {
            const key = x + "," + y;
            const outs = edges.get(key);
            let next_index = 0;
            // diagonally touching cells make two outlines meet at a vertex, take
            // the right turn so they stay separate
            for (let i = 1; i < outs.length; i++) {
                const [nx, ny] = outs[i];
                if (cross(dir_x, dir_y, nx - x, ny - y) > 0) next_index = i;
            }
            const [nx, ny] = outs.splice(next_index, 1)[0];
            if (outs.length == 0) edges.delete(key);

            const [next_dir_x, next_dir_y] = [nx - x, ny - y];
            if (next_dir_x != dir_x || next_dir_y != dir_y) {
                corners.push([x, y]);
            }
            [dir_x, dir_y] = [next_dir_x, next_dir_y];
            [x, y] = [nx, ny];
        } while (x != start_x || y != start_y);

        // the start vertex is only a corner if the outline turns there
        const [first_x, first_y] = corners[0];
        const [second_x, second_y] = corners[1];
        const [last_x, last_y] = corners[corners.length - 1];
        if (
            cross(first_x - last_x, first_y - last_y, second_x - first_x, second_y - first_y) == 0
        ) {
            corners.shift();
        }

        for (let i = 0; i < corners.length; i++) {
            const [px, py] = corners[(i + corners.length - 1) % corners.length];
            const [cx, cy] = corners[i];
            const [nx, ny] = corners[(i + 1) % corners.length];
            const in_len = Math.abs(cx - px) + Math.abs(cy - py);
            const out_len = Math.abs(nx - cx) + Math.abs(ny - cy);
            const [in_x, in_y] = [(cx - px) / in_len, (cy - py) / in_len];
            const [out_x, out_y] = [(nx - cx) / out_len, (ny - cy) / out_len];
            // right turns are outer corners, left turns inner ones
            const is_outer = cross(in_x, in_y, out_x, out_y) > 0;
            const radius = Math.min(is_outer ? outer_radius : inner_radius, in_len / 2, out_len / 2);
            const arc_start_x = cx - in_x * radius + min_x;
            const arc_start_y = cy - in_y * radius + min_y;
            const arc_end_x = cx + out_x * radius + min_x;
            const arc_end_y = cy + out_y * radius + min_y;
            d += `${i == 0 ? "M" : "L"}${arc_start_x} ${arc_start_y}`;
            if (radius > 0) {
                d += `A${radius} ${radius} 0 0 ${is_outer ? 1 : 0} ${arc_end_x} ${arc_end_y}`;
            }
        }
        d += "Z";
    }
    return d;
}

/**
 * Every stretch of edge two boxes share, and for each box whether another
 * box touches its left or right side
 *
 * @param {Array<Box>} boxes
 * @returns {{ edges: Array<[number, number, number, number]>, is_joined_sideways: Array<boolean> }}
 */
export function boxes_shared_edges(boxes) {
    /** @type {Array<[number, number, number, number]>} */
    const edges = [];
    const is_joined_sideways = boxes.map(() => false);
    for (let a = 0; a < boxes.length; a++) {
        for (let b = 0; b < boxes.length; b++) {
            const [a_left, a_top, a_right, a_bottom] = boxes[a];
            const [b_left, b_top, b_right, b_bottom] = boxes[b];
            if (a_right == b_left) {
                const top = Math.max(a_top, b_top);
                const bottom = Math.min(a_bottom, b_bottom);
                if (top < bottom) {
                    edges.push([a_right, top, a_right, bottom]);
                    is_joined_sideways[a] = true;
                    is_joined_sideways[b] = true;
                }
            }
            if (a_bottom == b_top) {
                const left = Math.max(a_left, b_left);
                const right = Math.min(a_right, b_right);
                if (left < right) {
                    edges.push([left, a_bottom, right, a_bottom]);
                }
            }
        }
    }
    return { edges, is_joined_sideways };
}

/**
 * Draws seats into an svg element as merged shapes: each seat's fill,
 * clipped to the outline of the whole group, a divider wherever two seats
 * touch, and one outline around each group. Styled by .seat-shapes in
 * src/styles.css. Coordinates are grid units, the caller sets the viewBox
 *
 * @param {SVGElement} svg
 * @param {Array<SeatShape>} seats
 * @param {number} radius outer corner radius in grid units
 * @param {string} id unique in the document, for the clip path
 * @returns {Array<boolean>} for each seat, whether another touches its left or right side
 */
export function seat_shapes_render(svg, seats, radius, id) {
    svg.replaceChildren();
    const boxes = seats.map((seat) => seat.box);
    const outline = boxes_outline_path(boxes, radius, 0);
    const { edges, is_joined_sideways } = boxes_shared_edges(boxes);

    const clip_id = id + "-clip";
    const clip = svg_elem_create("clipPath", { id: clip_id });
    clip.appendChild(svg_elem_create("path", { d: outline }));
    const defs = svg_elem_create("defs");
    defs.appendChild(clip);

    const fills = svg_elem_create("g", { "clip-path": `url(#${clip_id})` });
    for (const seat of seats) {
        const [left, top, right, bottom] = seat.box;
        fills.appendChild(
            svg_elem_create("rect", {
                class: "seat-shape-fill",
                "data-kind": seat.kind,
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            })
        );
    }

    let dividers = "";
    for (const [x1, y1, x2, y2] of edges) {
        dividers += `M${x1} ${y1}L${x2} ${y2}`;
    }

    svg.append(
        defs,
        fills,
        svg_elem_create("path", { class: "seat-shape-divider", d: dividers }),
        svg_elem_create("path", { class: "seat-shape-outline", d: outline })
    );
    return is_joined_sideways;
}
