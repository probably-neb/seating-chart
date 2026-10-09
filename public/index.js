import * as Store from "/store.js";
import ID from "/id.js";

const SEAT_GRID_W = 4;
const SEAT_GRID_H = 4;

const content_ref = document.getElementById("content");
if (content_ref == null) {
    throw new Error("content_ref is null");
}

const new_chart_id = ID.generate_for("chart");
const new_chart_href = "/canvas/" + new_chart_id;
document.getElementById("create-chart").setAttribute("href", new_chart_href);

class ChartPreview extends HTMLElement {
    async connectedCallback() {
        const chart_id = this.dataset["chart_id"];
        if (!chart_id) {
            return;
        }
        const seating_chart = await Store.chart_get(chart_id);
        if (!seating_chart) return;

        // seats can be anywhere on the infinite canvas, fit the view to them
        let min_x = 0, min_y = 0, max_x = 1, max_y = 1;
        if (seating_chart.seats.length > 0) {
            min_x = Math.min(...seating_chart.seats.map((seat) => seat.gridX));
            min_y = Math.min(...seating_chart.seats.map((seat) => seat.gridY));
            max_x = Math.max(...seating_chart.seats.map((seat) => seat.gridX + SEAT_GRID_W));
            max_y = Math.max(...seating_chart.seats.map((seat) => seat.gridY + SEAT_GRID_H));
        }

        let svgContent = `<svg width="100%" height="100%" viewBox="${min_x} ${min_y} ${max_x - min_x} ${max_y - min_y}">
            <defs>
                <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                    <path d="M 1 0 L 0 0 0 1" fill="none" stroke="darkgray" stroke-width="0.05"/>
                </pattern>
            </defs>
            <rect x="${min_x}" y="${min_y}" width="100%" height="100%" fill="url(#grid)" />`;

        console.log("seats", seating_chart.seats, chart_id);
        for (const seat of seating_chart.seats) {
            svgContent += `<rect x="${seat.gridX}" y="${seat.gridY}" width="${SEAT_GRID_W}" height="${SEAT_GRID_H}" fill="lightgray" stroke="darkgray" stroke-width="0.1" />`;
        }

        svgContent += "</svg>";
        this.innerHTML = svgContent;
    }
}
customElements.define("desk-chart-preview", ChartPreview);

{
    const ids = await Store.chart_ids_list();
    content_ref.innerHTML = ""; // Clear existing content
    if (ids.length == 0) {
        content_ref.innerHTML = "No seating charts";
    }
    for (const id of ids) {
        const card = document.createElement("div");
        card.className = "shadow-lg rounded-md px-4 py-8 bg-white text-black"; // Add appropriate classes
        card.innerHTML = `
            <div class="card-header pb-4">
                <div class="flex justify-between items-start">
                    <h3 class="card-title text-xl">${id}</h3>
                    <a href="/canvas/${id}" class="px-3 py-2 rounded-lg bg-light-sea-green border-b-4 border-b-lime-800">Edit</a>
                </div>
            </div>
            <div class="card-content pb-2">
                <div class="aspect-video relative mb-4 ring-3 ring-gray-500">
                    <desk-chart-preview data-chart_id="${id}"></desk-chart-preview>
                </div>
            </div>
            <div class="card-footer flex justify-between text-sm text-muted-foreground">
                <p>Created: ${new Date().toLocaleDateString()}</p>
                <p>0 seats</p>
            </div>
        `;
        content_ref.appendChild(card);
    }
}
