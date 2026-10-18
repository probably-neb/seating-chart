// Picks the visual theme. Loaded as a classic script in <head> so the theme
// is set before first paint. Any [data-theme-picker] element becomes a
// switcher, and a "themechange" event is sent to document on every change.

(function () {
    const THEMES = [
        { id: "studio", name: "Studio" },
        { id: "pop", name: "Pop" },
        { id: "outline", name: "Outline" },
        { id: "sticker", name: "Sticker" },
    ];
    const STORAGE_KEY = "deskribe-theme";

    function theme_index_get() {
        const stored = localStorage.getItem(STORAGE_KEY);
        const index = THEMES.findIndex((theme) => theme.id == stored);
        return index == -1 ? 0 : index;
    }

    /** @param {number} index */
    function theme_set(index) {
        index = (index + THEMES.length) % THEMES.length;
        localStorage.setItem(STORAGE_KEY, THEMES[index].id);
        document.documentElement.dataset.theme = THEMES[index].id;
        for (const output of document.querySelectorAll("[data-theme-picker] output")) {
            output.innerHTML = `${THEMES[index].name}<small>${index + 1}/${THEMES.length}</small>`;
        }
        document.dispatchEvent(new CustomEvent("themechange", { detail: THEMES[index].id }));
    }

    document.documentElement.dataset.theme = THEMES[theme_index_get()].id;

    const CHEVRON = (d) =>
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

    document.addEventListener("DOMContentLoaded", () => {
        for (const picker of document.querySelectorAll("[data-theme-picker]")) {
            picker.classList.add("theme-picker");
            picker.innerHTML = `
                <button type="button" aria-label="Previous style" data-step="-1">${CHEVRON("m15 18-6-6 6-6")}</button>
                <output aria-live="polite"></output>
                <button type="button" aria-label="Next style" data-step="1">${CHEVRON("m9 18 6-6-6-6")}</button>`;
            picker.addEventListener("click", (event) => {
                const button = event.target instanceof Element && event.target.closest("[data-step]");
                if (!button) return;
                theme_set(theme_index_get() + Number(button.getAttribute("data-step")));
            });
        }
        theme_set(theme_index_get());
    });
})();
