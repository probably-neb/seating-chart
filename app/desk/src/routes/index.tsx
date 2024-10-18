import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "../canvas";

export const Route = createFileRoute("/")({
    component: CanvasComponent,
});

function CanvasComponent() {
    return (
        <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white w-full">
            <Canvas />
        </main>
    );
}
