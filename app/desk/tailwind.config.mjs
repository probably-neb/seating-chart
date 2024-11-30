/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
            colors: {
                ["cerulean"]: {
                    ["DEFAULT"]: "hsla(var(--cerulean) / <alpha-value>)",
                    ["light"]: "hsla(var(--cerulean-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--cerulean-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--cerulean-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--cerulean-dark-extra) / <alpha-value>)",
                },
                ["moonstone"]: {
                    ["DEFAULT"]: "hsla(var(--moonstone) / <alpha-value>)",
                    ["light"]: "hsla(var(--moonstone-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--moonstone-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--moonstone-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--moonstone-dark-extra) / <alpha-value>)",
                },
                ["light-sea-green"]: {
                    ["DEFAULT"]: "hsla(var(--light-sea-green) / <alpha-value>)",
                    ["light"]: "hsla(var(--light-sea-green-light-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--light-sea-green-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--light-sea-green-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--light-sea-green-dark-extra) / <alpha-value>)",
                },
                ["sunset"]: {
                    ["DEFAULT"]: "hsla(var(--sunset) / <alpha-value>)",
                    ["light"]: "hsla(var(--sunset-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--sunset-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--sunset-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--sunset-dark-extra) / <alpha-value>)",
                },
                ["peach"]: {
                    ["DEFAULT"]: "hsla(var(--peach) / <alpha-value>)",
                    ["light"]: "hsla(var(--peach-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--peach-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--peach-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--peach-dark-extra) / <alpha-value>)",
                },
                ["floral-white"]: {
                    ["DEFAULT"]: "hsla(var(--floral-white) / <alpha-value>)",
                    ["light"]: "hsla(var(--floral-white-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--floral-white-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--floral-white-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--floral-white-dark-extra) / <alpha-value>)",
                },
                ["melon"]: {
                    ["DEFAULT"]: "hsla(var(--melon) / <alpha-value>)",
                    ["light"]: "hsla(var(--melon-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--melon-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--melon-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--melon-dark-extra) / <alpha-value>)",
                },
                ["light-red"]: {
                    ["DEFAULT"]: "hsla(var(--light-red) / <alpha-value>)",
                    ["light"]: "hsla(var(--light-red-light) / <alpha-value>)",
                    ["light-extra"]: "hsla(var(--light-red-light-extra) / <alpha-value>)",
                    ["dark"]: "hsla(var(--light-red-dark) / <alpha-value>)",
                    ["dark-extra"]: "hsla(var(--light-red-dark-extra) / <alpha-value>)",
                },
            },
        },
    },
    plugins: [],
};
