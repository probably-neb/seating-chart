// Serves the chart API. Everything else is a static file from public/.

const CHART_ID_PATTERN = /^chrt_[0-9a-zA-Z]{27}$/;
// keeps a single chart well under the 25 MiB KV value limit
const CHART_MAX_BYTES = 1024 * 1024;

export default {
    /**
     * @param {Request} req
     * @param {{ CHARTS: KVNamespace, ASSETS: Fetcher }} env
     */
    async fetch(req, env) {
        const url = new URL(req.url);

        // /canvas/<chart_id> is one page, the chart id is read client side
        if (url.pathname.startsWith("/canvas/")) {
            return env.ASSETS.fetch(new URL("/canvas", url));
        }

        if (url.pathname == "/api/charts") {
            if (req.method != "GET") return method_not_allowed();
            const ids = [];
            let cursor;
            do {
                const page = await env.CHARTS.list({ cursor });
                for (const key of page.keys) ids.push(key.name);
                cursor = page.list_complete ? undefined : page.cursor;
            } while (cursor);
            return Response.json(ids);
        }

        const prefix = "/api/charts/";
        if (!url.pathname.startsWith(prefix)) {
            return new Response("not found", { status: 404 });
        }
        const id = decodeURIComponent(url.pathname.slice(prefix.length));
        if (!CHART_ID_PATTERN.test(id)) {
            return new Response("invalid chart id", { status: 400 });
        }

        switch (req.method) {
            case "GET": {
                const chart = await env.CHARTS.get(id);
                if (chart == null) {
                    return new Response("not found", { status: 404 });
                }
                return new Response(chart, {
                    headers: { "content-type": "application/json" },
                });
            }
            case "PUT": {
                const body = await req.text();
                if (body.length > CHART_MAX_BYTES) {
                    return new Response("chart too large", { status: 413 });
                }
                let chart;
                try {
                    chart = JSON.parse(body);
                } catch {
                    return new Response("invalid json", { status: 400 });
                }
                if (chart?.id != id) {
                    return new Response("chart id does not match url", { status: 400 });
                }
                await env.CHARTS.put(id, body);
                return new Response(null, { status: 204 });
            }
            default:
                return method_not_allowed();
        }
    },
};

function method_not_allowed() {
    return new Response("method not allowed", { status: 405 });
}
