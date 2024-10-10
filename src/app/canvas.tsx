"use client";

import { useRef, useMemo, RefObject, useCallback } from "react";
import { enableMapSet, Draft } from "immer";
import { Dnd } from "./dnd";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { assert } from "@/lib/assert";

enableMapSet();

const NEW_ID = "new" as const;

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

const SEAT_GRID_W = 4
const SEAT_GRID_H = 4

const GRID_W = 120
const GRID_H = 80

const GRID_CELL_PX = 24

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
                    gridX: offset.gridX + Math.round(delta.x / GRID_CELL_PX),
                    gridY: offset.gridY + Math.round(delta.y / GRID_CELL_PX),
                });
            });
        },
        setSeatRef(id) {
            return (elem) => {
                set((state) => {
                    // FIXME: why is ref a WriteAbleDraft?
                    state.refs.set(id, elem as Draft<HTMLElement> | null);
                    console.log("set ref");
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

    const setActive = useSetActive();
    const setPreview = seatStore((s) => s.setPreview);

    const stopDrag = seatStore((s) => s.stopDrag);

    return (
        <Dnd.Context
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
        >
            <Dnd.Droppable
                id={SEATING_CHART_DROPPABLE_ID}
                className="relative bg-white"
                style={{
                    height: GRID_H * GRID_CELL_PX,
                    width: GRID_W * GRID_CELL_PX,
                    backgroundImage: `
                        linear-gradient(to right, #e5e5e5 1px, transparent 1px),
                        linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)
                    `,
                    backgroundSize: `${GRID_CELL_PX}px ${GRID_CELL_PX}px`,
                }}
            >
                <div ref={dropRef}>
                    <DropPreview />
                    <Seats />
                </div>
            </Dnd.Droppable>
            <div className="h-[600px] min-w-28 border-l-2 border-l-black bg-white pl-4">
                <DraggableSeat />
            </div>
        </Dnd.Context>
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
            return
        }
        setActive(Object.assign(snapCoords, { id }));
        setPreview(snapCoords);
    }

    function handleDragEnd(e: Dnd.DragEndEvent) {
        console.log("drag end", e);
        const id = parseId(e.active.id);
        const snapCoords = getSnapCoords(dropRef, e);
        if (snapCoords == null) {
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
    dragEvent: Dnd.DragEvent
): GridPoint | null {
    const dzDims = dzRef.current?.getBoundingClientRect();
    if (!dzDims) {
        console.log("no dz dims");
        return null;
    }

    const { clientX, clientY } = dragEvent.activatorEvent as MouseEvent;
    const x = clientX - dzDims.left + dragEvent.delta.x;
    const y = clientY - dzDims.top + dragEvent.delta.y;

    const gridX = Math.floor(x / GRID_CELL_PX);
    const gridY = Math.floor(y / GRID_CELL_PX);

    return { gridX, gridY };
}

function DropPreview() {
    const active = seatStore((s) => s.preview);
    return (
        active && (
            <div
                className="absolute h-24 w-24 bg-blue-200"
                style={{ 
                    left: active.gridX * GRID_CELL_PX, 
                    top: active.gridY * GRID_CELL_PX, 
                    height: SEAT_GRID_H * GRID_CELL_PX, 
                    width: SEAT_GRID_W * GRID_CELL_PX 
                }}
            ></div>
        )
    );
}

function DraggableSeat(props: { seatId?: id }) {
    const id: newId = props.seatId ?? "new";
    const offset = useSeatOffset(id);
    return (
        <Dnd.Draggable id={id + ""} data={{ id }}>
            <Seat id={id} offset={offset} />
        </Dnd.Draggable>
    );
}

function Seats() {
    const seats = useSeats();
    return seats.map((s) => <DraggableSeat key={s} seatId={s} />);
}

function Seat(props: { id: newId; offset?: GridPoint }) {
    const style = useMemo(() => {
        const base =  {
            height: SEAT_GRID_H * GRID_CELL_PX,
            width: SEAT_GRID_W * GRID_CELL_PX,
        }
        if (!props.offset) {
            return Object.assign(base, { position: "unset" as const });
        }
        return Object.assign(base, {
            position: "absolute" as const,
            top: props.offset.gridY * GRID_CELL_PX,
            left: props.offset.gridX * GRID_CELL_PX,
        });
    }, [props.offset]);

    const setSeatRef = useSetSeatRef(props.id);

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
    const setSeatRef = useCallback(setSeatRefFn(id), [id]);
    return setSeatRef;
}

function useSeats() {
    return seatStore((s) => s.seats);
}

function useSetActive() {
    return seatStore((s) => s.setActive);
}
