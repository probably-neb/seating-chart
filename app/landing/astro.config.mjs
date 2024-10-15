// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";
import aws from "astro-sst"

// https://astro.build/config
export default defineConfig({
    output: "server",
    adapter: aws(),
    integrations: [
        tailwind({
            // applyBaseStyles: false,
        }),
        react(),
    ],
    vite: {
        resolve: {
            alias: {
                "@": "/src",
            },
        },
    },
});
