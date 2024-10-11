"use client";

import { useRef, useMemo, useCallback } from "react";
import type { RefObject } from "react";
import { enableMapSet } from "immer";
import type { Draft } from "immer";
import { Dnd, DragOverlay } from "./dnd";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

enableMapSet();

const NEW_ID = "new" as const;

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

const SEAT_GRID_W = 4;
const SEAT_GRID_H = 4;
const GRID_W = 120;
const GRID_H = 80;

type id = number;

type newId = id | typeof NEW_ID;

type Point = { x: number; y: number };

type GridPoint = { gridX: number; gridY: number };

type Active = GridPoint & { id: newId };

type SeatsData = {
    seats: id[];
    offsets: Map<id, GridPoint>;
    refs: Map<newId, HTMLElement | null>;
    centroids: Map<newId, Point>;
    nextId: id;
    gridCellPx: number;
    gridW: number;
    gridH: number;
} & (
    | {
          active: Active;
          preview: GridPoint;
      }
    | {
          active: null;
          preview: null;
      }
);

type SeatsFns = {
    addSeat(x: number, y: number): void;
    setSeatOffset(id: id, offset: GridPoint): void;
    addDelta(id: id, delta: Point): void;
    setSeatRef(id: newId): (elem: HTMLElement | null) => void;
    setActive(p: Active | null): void;
    setPreview(p: GridPoint | null): void;
    stopDrag(): void;
};

type SeatStore = SeatsData & SeatsFns;

const seatStore = create<SeatStore>()(
    immer((set) => ({
        seats: [],
        offsets: new Map(),
        refs: new Map(),
        centroids: new Map(),
        nextId: 0,
        active: null,
        preview: null,
        gridCellPx: 24,
        gridW: 120,
        gridH: 80,
        addSeat(gridX, gridY) {
            set((state) => {
                const id = state.nextId;
                state.seats.push(id);
                state.offsets.set(id, { gridX, gridY });
                state.nextId += 1;
            });
        },
        setSeatOffset(id, offset: GridPoint) {
            set((state) => {
                state.offsets.set(id, offset);
            });
        },
        addDelta(id, delta: Point) {
            set((state) => {
                const offset = state.offsets.get(id);
                if (!offset) {
                    console.error(
                        `tried to add delta to seat ${id} but it is not in offsets map`,
                    );
                    return;
                }
                state.offsets.set(id, {
                    gridX:
                        offset.gridX + Math.round(delta.x / state.gridCellPx),
                    gridY:
                        offset.gridY + Math.round(delta.y / state.gridCellPx),
                });
            });
        },
        setSeatRef(id) {
            return (elem) => {
                set((state) => {
                    // FIXME: why is ref a WriteAbleDraft?
                    state.refs.set(id, elem as Draft<HTMLElement> | null);
                    // console.log("set ref");
                });
            };
        },
        setActive(active) {
            set((state) => {
                if (
                    active !== null &&
                    active.id !== "new" &&
                    typeof active.id === "string"
                ) {
                    active.id = parseInt(active.id);
                }
                state.active = active;
                if (active === null) {
                    state.centroids.delete("new");
                    state.preview = null;
                    return;
                }
                const id = active.id;
                const ref = state.refs.get(id);
                if (!ref) {
                    console.log(
                        `no ref for ${id}`,
                        Array.from(state.refs.keys()),
                    );
                    return;
                }
            });
        },
        setPreview(preview) {
            set((state) => {
                if (preview === null) {
                    state.preview = state.active;
                    return;
                }
                state.preview = preview;
            });
        },
        stopDrag() {
            set((state) => {
                state.active = null;
                state.preview = null;
                state.centroids.delete("new");
            });
        },
    })),
);

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const addSeat = seatStore((s) => s.addSeat);
    const addDelta = seatStore((s) => s.addDelta);
    const offsets = seatStore((s) => s.offsets);
    const setSeatOffset = seatStore((s) => s.setSeatOffset);

    const setActive = seatStore((s) => s.setActive);
    const setPreview = seatStore((s) => s.setPreview);

    const stopDrag = seatStore((s) => s.stopDrag);

    const seats = seatStore((s) => s.seats);

    const gridH = seatStore((s) => s.gridH);
    const gridW = seatStore((s) => s.gridW);
    const gridCellPx = seatStore((s) => s.gridCellPx);

    const active = seatStore((s) => s.active);

    const droppableStyle = useMemo(
        () => ({
            height: gridH * gridCellPx,
            width: gridW * gridCellPx,
            backgroundImage: `
                        linear-gradient(to right, #e5e5e5 1px, transparent 1px),
                        linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)
                    `,
            backgroundSize: `${gridCellPx}px ${gridCellPx}px`,
            zIndex: 0,
        }),
        [gridCellPx, gridH, gridW],
    );

    return (
        <div className="lg:w-md md:w-sm xl:w-lg 2xl:w-xl">
            <Dnd.Context
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
            >
                <div className="min-w-28 border-l-2 border-l-black bg-white p-4">
                    <DraggableSeat />
                </div>
                <Dnd.Droppable
                    id={SEATING_CHART_DROPPABLE_ID}
                    className="relative z-auto overflow-auto bg-white"
                    style={droppableStyle}
                >
                    <div ref={dropRef} className="z-0">
                        <DropPreview />
                        {seats.map((id) =>
                            id == active?.id ? null : (
                                <DraggableSeat seatId={id} key={id} />
                            ),
                        )}
                    </div>
                    <DragOverlay className="relative">
                        {active ? <Seat id={active.id} /> : null}
                    </DragOverlay>
                </Dnd.Droppable>
            </Dnd.Context>
        </div>
    );

    function handleDragStart(e: Dnd.DragStartEvent) {
        const offset = offsets.get(e.active.id as id);
        if (!offset) {
            return;
        }
        console.log("drag start", offset);
        const active = Object.assign(offset, { id: e.active.id as newId });
        setActive(active);
    }

    function handleDragMove(e: Dnd.DragMoveEvent) {
        // console.log("drag over", e)
        const id = e.active.id as newId;

        if (e.over === null && id === "new") {
            setActive(null);
            return;
        }
        const snapCoords = getSnapCoords(dropRef, e);
        if (snapCoords === null) {
            return;
        }
        setActive(Object.assign(snapCoords, { id }));
        setPreview(snapCoords);
    }

    function handleDragEnd(e: Dnd.DragEndEvent) {
        console.log("drag end", e);
        const id = parseId(e.active.id);
        const snapCoords = getSnapCoords(dropRef, e);
        if (snapCoords == null) {
            console.error("no snap coords");
            return;
        }
        if (id == "new") {
            const coords = snapCoords;
            addSeat(coords.gridX, coords.gridY);
            stopDrag();
            return;
        }
        if (snapCoords) {
            setSeatOffset(id, snapCoords);
            stopDrag();
            return;
        }
        addDelta(id, e.delta);
        stopDrag();
    }
}

function parseId(id: number | string): newId {
    if (typeof id === "number" || id === "new") {
        return id;
    }
    const idInt = Number.parseInt(id);
    if (!Number.isSafeInteger(idInt)) {
        console.error(`invalid id ${id}`);
        return "new";
    }
    return idInt;
}

function getSnapCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
): GridPoint {
    const dzDims = dzRef.current?.getBoundingClientRect();

    const state = seatStore.getState();
    const gridCellPx = state.gridCellPx;
    const gridW = state.gridW;
    const gridH = state.gridH;

    if (!dzDims) {
        console.log("no dz dims");
        return { gridX: 0, gridY: 0 };
    }

    const { clientX, clientY } = dragEvent.activatorEvent as MouseEvent;
    const x = clientX - dzDims.left + dragEvent.delta.x;
    const y = clientY - dzDims.top + dragEvent.delta.y;

    const gridX = Math.floor(x / gridCellPx);
    const gridY = Math.floor(y / gridCellPx);

    const seats = seatStore.getState().seats;
    const offsets = seatStore.getState().offsets;
    const activeSeatId = dragEvent.active.id;

    function isOverlapping(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ): boolean {
        return (
            Math.abs(x1 - x2) < SEAT_GRID_W && Math.abs(y1 - y2) < SEAT_GRID_H
        );
    }

    function isValidPosition(x: number, y: number): boolean {
        for (const seatId of seats) {
            if (seatId.toString() === activeSeatId) continue; // Skip the actively dragging seat
            const seatOffset = offsets.get(seatId);
            if (
                seatOffset &&
                isOverlapping(x, y, seatOffset.gridX, seatOffset.gridY)
            ) {
                return false;
            }
        }
        return true;
    }

    if (!isValidPosition(gridX, gridY)) {
        const directions: Array<[dx: number, dy: number]> = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
        ];

        let distance = 1;
        while (distance < Math.max(GRID_W, GRID_H)) {
            for (const [dx, dy] of directions) {
                const newX = gridX + dx * distance;
                const newY = gridY + dy * distance;
                if (
                    newX >= 0 &&
                    newX < gridW &&
                    newY >= 0 &&
                    newY < gridH &&
                    isValidPosition(newX, newY)
                ) {
                    return { gridX: newX, gridY: newY };
                }
            }
            distance++;
        }
    }

    return { gridX, gridY };
}

function DropPreview() {
    const active = seatStore((s) => s.preview);
    const gridCellPx = seatStore((s) => s.gridCellPx);
    return (
        active && (
            <div
                className="absolute h-24 w-24 bg-blue-200"
                style={{
                    left: active.gridX * gridCellPx,
                    top: active.gridY * gridCellPx,
                    height: SEAT_GRID_H * gridCellPx,
                    width: SEAT_GRID_W * gridCellPx,
                }}
            ></div>
        )
    );
}

function DraggableSeat(props: { seatId?: id }) {
    const id: newId = props.seatId ?? "new";
    const offset = useSeatOffset(id);
    const active = seatStore((s) => dbg(s.active, "active"));

    const gridCellPx = seatStore((s) => s.gridCellPx);
    const activeID = seatStore((s) => s.active?.id);

    const style = useMemo(() => {
        if (!offset) {
            return { position: "unset" as const };
        }
        return {
            position: "absolute" as const,
            top: offset.gridY * gridCellPx,
            left: offset.gridX * gridCellPx,
        };
    }, [offset, id, activeID, gridCellPx]);
    return (
        <Dnd.Draggable id={id + ""} data={{ id }} style={style}>
            <Seat id={id} offset={id == active?.id ? active : offset} />
        </Dnd.Draggable>
    );
}

function dbg<T>(v: T, msg: string): T {
    console.log(msg, v);
    return v;
}

function Seat(props: { id: newId; offset?: GridPoint }) {
    const gridCellPx = seatStore((s) => s.gridCellPx);
    const setSeatRef = useSetSeatRef(props.id);

    const style = {
        height: SEAT_GRID_H * gridCellPx,
        width: SEAT_GRID_W * gridCellPx,
    };
    return (
        <div
            ref={setSeatRef}
            id={props.id + ""}
            className="align-center border-2 border-black bg-white text-center text-black"
            style={style}
        >
            {props.id}
        </div>
    );
}

function useSeatOffset(id: newId) {
    const offset = seatStore((s) => {
        if (id === NEW_ID) {
            return;
        }
        return s.offsets.get(id);
    });
    return offset;
}

function useSetSeatRef(id: newId) {
    const setSeatRefFn = seatStore((s) => s.setSeatRef);
    const setSeatRef = useCallback<(elem: HTMLElement | null) => void>(
        setSeatRefFn(id),
        [id, setSeatRefFn],
    );
    return setSeatRef;
}
