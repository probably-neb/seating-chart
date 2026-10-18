// Design exploration: picks how students look in the list and in seats.
// Loaded as a classic script in <head> so the choice applies before first
// paint. Fills any [data-student-style-picker] with a switcher.

(function () {
    const STYLES = [
        { id: "tag", name: "Name tag" },
        { id: "badge", name: "Badge" },
        { id: "desk", name: "Desk colour" },
        { id: "pill", name: "Pill" },
    ];
    const STORAGE_KEY = "deskribe-student-style";

    function style_index_get() {
        const stored = localStorage.getItem(STORAGE_KEY);
        const index = STYLES.findIndex((style) => style.id == stored);
        return index == -1 ? 0 : index;
    }

    /** @param {number} index */
    function style_set(index) {
        index = (index + STYLES.length) % STYLES.length;
        localStorage.setItem(STORAGE_KEY, STYLES[index].id);
        document.documentElement.dataset.students = STYLES[index].id;
        for (const output of document.querySelectorAll("[data-student-style-picker] output")) {
            output.innerHTML = `${STYLES[index].name}<small>${index + 1}/${STYLES.length}</small>`;
        }
    }

    document.documentElement.dataset.students = STYLES[style_index_get()].id;

    const CHEVRON = (d) =>
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

    document.addEventListener("DOMContentLoaded", () => {
        for (const picker of document.querySelectorAll("[data-student-style-picker]")) {
            picker.classList.add("style-picker");
            picker.innerHTML = `
                <span>Students</span>
                <button type="button" aria-label="Previous student style" data-step="-1">${CHEVRON("m15 18-6-6 6-6")}</button>
                <output aria-live="polite"></output>
                <button type="button" aria-label="Next student style" data-step="1">${CHEVRON("m9 18 6-6-6-6")}</button>`;
            picker.addEventListener("click", (event) => {
                const button = event.target instanceof Element && event.target.closest("[data-step]");
                if (!button) return;
                style_set(style_index_get() + Number(button.getAttribute("data-step")));
            });
        }
        style_set(style_index_get());
    });
})();
