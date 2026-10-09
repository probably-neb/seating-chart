// <deskribe-tooltip> shows its [role="tooltip"] child below itself on hover.
//
// <deskribe-tooltip class="relative inline-block">
//     <button>...</button>
//     <div role="tooltip" inert class="pointer-events-none fixed z-50 ..." style="display: none; opacity: 0;">...</div>
// </deskribe-tooltip>

class ToolTip extends HTMLElement {
    connectedCallback() {
        const tooltip_ref = this.querySelector("[role='tooltip']");
        if (tooltip_ref == null || !(tooltip_ref instanceof HTMLElement)) {
            throw new Error("tooltip_ref not found");
        }

        this.addEventListener("mouseenter", () => {
            // Position tooltip relative to the trigger element
            const triggerRect = this.getBoundingClientRect();
            tooltip_ref.style.left = `${triggerRect.left + triggerRect.width / 2}px`;
            tooltip_ref.style.top = `${triggerRect.bottom + 4}px`; // 4px gap
            tooltip_ref.style.transform = "translate(-50%)";

            tooltip_ref.style.display = "block";
            tooltip_ref.style.opacity = "1";
        });

        this.addEventListener("mouseleave", () => {
            tooltip_ref.style.display = "none";
            tooltip_ref.style.opacity = "0";
        });
    }
}
customElements.define("deskribe-tooltip", ToolTip);
