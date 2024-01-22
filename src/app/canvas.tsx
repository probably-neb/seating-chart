"use client";

import {
    useState,
    useRef,
    useMemo,
    useEffect,
    RefObject,
    useCallback,
} from "react";
import { produce, enableMapSet, Draft } from "immer";
import { Dnd } from "./dnd";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

enableMapSet();

const NEW_ID = "new" as const;

type id = number;

type newId = id | typeof NEW_ID;

type Point = { x: number; y: number };

type SeatsData = {
    seats: id[];
    offsets: Map<id, Point>;
    refs: Map<newId, HTMLElement>;
    centroids: Map<newId, Point>;
    nextId: id;
};

type SeatsFns = {
    addSeat(x: number, y: number): void;
    setSeatOffset(id: id, x: number, y: number): void;
    addDelta(id: id, x: number, y: number): void;
    setSeatRef(id: newId): (elem: HTMLElement | null) => void;
};

type SeatStore = SeatsData & SeatsFns;

const seatStore = create<SeatStore>()(
    immer((set) => ({
        seats: [],
        offsets: new Map(),
        refs: new Map(),
        centroids: new Map(),
        nextId: 0,
        addSeat(x, y) {
            set((state) => {
                const id = state.nextId;
                state.seats.push(id);
                state.offsets.set(id, { x, y });
                state.nextId += 1;
                updateCentroid(state, id);
            });
        },
        setSeatOffset(id, x, y) {
            set((state) => {
                state.offsets.set(id, { x, y });
                updateCentroid(state, id);
            });
        },
        addDelta(id, x, y) {
            set((state) => {
                const offset = state.offsets.get(id);
                if (!offset) {
                    console.error(
                        `tried to add delta to seat ${id} but it is not in offsets map`,
                    );
                    return;
                }
                state.offsets.set(id, { x: offset.x + x, y: offset.y + y });
                updateCentroid(state, id);
            });
        },
        setSeatRef(id) {
            return (elem) => {
                set((state) => {
                    // FIXME: why is ref a WriteAbleDraft?
                    state.refs.set(id, elem as any);
                    console.log("set ref");
                    updateCentroid(state, id);
                });
            };
        },
    })),
);

function updateCentroid(state: Draft<SeatStore>, id: newId) {
    const ref = state.refs.get(id);
    const offset = id !== "new" ? state.offsets.get(id) : undefined
    if (!ref || !offset) {
        // console.error(`no ref for ${id} while attempting to update centroid`)
        return;
    }
    const centroid = calculateCentroid(offset, ref);
    state.centroids.set(id, centroid);
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
    return setSeatRef
}

function calculateCentroid<Elem extends HTMLElement>(offset: Point, ref: Draft<Elem>) {
    const bcr = ref.getBoundingClientRect();
    const centroid = {
        x: offset.x + Math.floor(bcr.width / 2),
        y: offset.y + Math.floor(bcr.height / 2),
    };
    console.log({
        x: bcr.left,
        y: bcr.top,
        w: bcr.width,
        h: bcr.height,
        centroid,
    });
    return centroid;
}

function useCentroids() {
    const centroids = seatStore((s) => Array.from(s.centroids.entries()));
    return centroids;
}

function useSeats() {
    return seatStore(s => s.seats)
}

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const seats = useSeats()
    const addSeat = seatStore((s) => s.addSeat);
    const addDelta = seatStore((s) => s.addDelta);
    const offsets = seatStore((s) => s.offsets);

    const [active, setActive] = useState<{ x: number; y: number } | null>(null);

    return (
        <Dnd.Context
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
        >
            <Dnd.Droppable
                id={SEATING_CHART_DROPPABLE_ID}
                className="relative min-h-[600px] min-w-[80%] bg-white"
            >
                <div ref={dropRef}>
                    {active && (
                        <div
                            className="absolute h-24 w-24 bg-blue-200"
                            style={{ left: active.x, top: active.y }}
                        ></div>
                    )}
                    {seats.map((s) => (
                        <DraggableSeat key={s} seatId={s} />
                    ))}
                </div>
                <Centroids />
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
        setActive(() => offset);
    }

    function handleDragMove(e: Dnd.DragMoveEvent) {
        // console.log("drag over", e)
        if (e.over === null && e.active.id === "new") {
            if (active !== null) {
                setActive(() => null);
            }
            return;
        }
        const [x, y] = getDropPreviewCoords(dropRef, e);

        setActive(() => ({ x, y }));
    }

    function handleDragEnd(e: Dnd.DragEndEvent) {
        setActive(null);
        console.log("drag end", e);
        const id = e.active.id as "new" | `${number}`;
        if (id == "new") {
            const [x, y] = getDropCoords(dropRef, e);
            addSeat(x, y);
            return;
        }
        const { x, y } = e.delta;
        addDelta(parseInt(id), x, y);
    }
}

function getDropPreviewCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const snapCoords = getSnapCoords(dzRef, dragEvent);
    if (snapCoords === null) {
        return getNonSnapPreviewCoords(dzRef, dragEvent);
    }
    return snapCoords;
}

function getDropCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const snapCoords = getSnapCoords(dzRef, dragEvent);
    if (snapCoords === null) {
        return getNonSnapCoords(dzRef, dragEvent);
    }
    return snapCoords;
}

function getSnapCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    return null;
}

// NOTE: this is the offset controlled by browser or @dnd-kit (idk which) giving the
// dragged element a lifted effect
const DRAG_EXISTING_Y_OFFSET = 19;

function getNonSnapPreviewCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const [x, y] = getNonSnapCoords(dzRef, dragEvent);
    const yOffset = dragEvent.active.id === "new" ? 0 : DRAG_EXISTING_Y_OFFSET;
    return [x, y - yOffset] as const;
}

function getNonSnapCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const cbb = dzRef.current?.getBoundingClientRect();
    const coords = calcCoordsDelta(dragEvent, cbb);
    return coords;
}

function calcCoordsDelta(
    e: Dnd.DragEvent,
    dzOfs?: { left: number; top: number },
) {
    // FIXME: need to test whether all properties exist on touch event as well
    const activator = e.activatorEvent as MouseEvent;
    const origX = activator.clientX;
    const origY = activator.clientY;
    const delta = e.delta;
    const dzOfsX = dzOfs?.left ?? 0;
    const dzOfsY = dzOfs?.top ?? 0;
    // NOTE: I believe accessing offsetX sets it in place
    // (important when accessed in handleDragMove)
    const mouseOfsX = activator.offsetX;
    const mouseOfsY = activator.offsetY;
    const x = origX + delta.x - dzOfsX - mouseOfsX;
    const y = origY + delta.y - dzOfsY - mouseOfsY;
    return [x, y] as const;
}

function calcCoords(
    e: Dnd.DragEndEvent,
    dzOfs?: { left: number; top: number },
) {
    const activator = e.activatorEvent as MouseEvent;
    const origX = activator.clientX;
    const origY = activator.clientY;
    const ofsX = activator.offsetX;
    const ofsY = activator.offsetY;
    const dzOfsX = dzOfs?.left ?? 0;
    const dzOfsY = dzOfs?.top ?? 0;
    const x = origX - ofsX - dzOfsX;
    const y = origY - ofsY - dzOfsY;
    return [x, y] as const;
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

function Seat(props: { id: newId; offset?: { x: number; y: number } }) {
    const style = useSeatPos(props.offset);
    const setSeatRef = useSetSeatRef(props.id)
    return (
        <div
            ref={setSeatRef}
            id={props.id + ""}
            className="align-center h-24 w-24 border-2 border-black bg-white text-center text-black"
            style={style}
        >
            {props.id}
        </div>
    );
}

function Centroids() {
    const centroids = useCentroids();
    return centroids.map(([id, c]) => (
        <div
            key={id}
            className="absolute z-10 h-4 w-4 rounded-full bg-red-500"
            style={{
                left: c.x,
                top: c.y,
                transform: "translate(-50%, -50%)",
            }}
        ></div>
    ));
}

function useSeatPos(seat?: { x: number; y: number }) {
    const style = useMemo(() => {
        if (!seat) {
            return {
                position: "unset" as const,
            };
        }
        return {
            position: "absolute" as const,
            top: seat.y,
            left: seat.x,
        };
    }, [seat]);

    return style;
}
