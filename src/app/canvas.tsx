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

type Active = Point & { id: newId };

type SeatsData = {
    seats: id[];
    offsets: Map<id, Point>;
    refs: Map<newId, HTMLElement>;
    centroids: Map<newId, Point>;
    nextId: id;
} & (
    | {
          active: Active;
          preview: Point;
      }
    | {
          active: null;
          preview: null;
      }
);

type SeatsFns = {
    addSeat(x: number, y: number): void;
    setSeatOffset(id: id, x: number, y: number): void;
    addDelta(id: id, x: number, y: number): void;
    setSeatRef(id: newId): (elem: HTMLElement | null) => void;
    setActive(p: Active | null): void;
    setPreview(p: Point | null): void;
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
                state.centroids.set(id, calculateCentroid(active, ref));
            });
        },
        setPreview(preview) {
            set(state => {
                if (preview === null) {
                    state.preview = state.active;
                    return;
                }
                state.preview = preview;
            })
        }
    })),
);

function updateCentroid(state: Draft<SeatStore>, id: newId) {
    const ref = state.refs.get(id);
    const offset = id !== "new" ? state.offsets.get(id) : undefined;
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
    return setSeatRef;
}

function calculateCentroid<Elem extends HTMLElement>(
    offset: Point,
    ref: Draft<Elem>,
) {
    const bcr = ref.getBoundingClientRect();
    const centroid = {
        x: offset.x + Math.floor(bcr.width / 2),
        y: offset.y + Math.floor(bcr.height / 2),
    };
    // console.log({
    //     x: bcr.left,
    //     y: bcr.top,
    //     w: bcr.width,
    //     h: bcr.height,
    //     centroid,
    // });
    return centroid;
}

function useCentroids() {
    const centroids = seatStore((s) => Array.from(s.centroids.entries()));
    return centroids;
}

function useSeats() {
    return seatStore((s) => s.seats);
}

function useActive() {
    return seatStore((s) => s.active);
}

function useSetActive() {
    return seatStore((s) => s.setActive);
}

function getActiveCentroid() {
    const state = seatStore.getState();
    const active = state.active;
    if (active === null) {
        return null;
    }
    const id = active.id;
    const centroid = state.centroids.get(id);
    if (!centroid) {
        return null;
    }
    return centroid;
}

function getOffset(id: id) {
    return seatStore.getState().offsets.get(id) ?? null;
}

function getActiveDims() {
    const state = seatStore.getState();
    const active = state.active;
    if (active === null) {
        return null;
    }
    const id = active.id;
    const ref = state.refs.get(id);
    if (!ref) {
        return null;
    }
    const bcr = ref.getBoundingClientRect();
    return bcr;
}

function getClosestCentroid(id: newId) {
    const state = seatStore.getState();
    const cur = state.centroids.get(id);
    if (!cur) {
        return null;
    }
    const centroids = Array.from(state.centroids.entries()).filter(
        (c): c is [id, Point] => c[0] !== id && c[0] !== "new",
    );
    return closestCentroid(cur, centroids);
}

function closestCentroid(cur: Point, centroids: [id, Point][]) {
    let closest: [id, Point] | null = null;
    let closestDistance = Infinity;
    for (let i = 0; i < centroids.length; i++) {
        let centroid = centroids[i]!;
        const dist = distance(cur, centroid[1]);
        if (dist < closestDistance) {
            closest = centroid;
            closestDistance = dist;
        }
    }
    if (closest === null) {
        return null;
    }
    return {
        id: closest[0],
        distance: closestDistance,
        centroid: closest[1],
    };
}

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const addSeat = seatStore((s) => s.addSeat);
    const addDelta = seatStore((s) => s.addDelta);
    const offsets = seatStore((s) => s.offsets);

    const setActive = useSetActive();
    const setPreview = seatStore((s) => s.setPreview);

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
                    <DropPreview />
                    <Seats />
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
        const [x, y] = getNonSnapPreviewCoords(dropRef, e);

        setActive({ id, x, y });
        setPreview(getDropPreviewCoords(dropRef, e));
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

function parseId(id: number | string): newId {
    if (typeof id === "number" || id === "new") {
        return id;
    }
    const idInt = parseInt(id);
    if (isNaN(idInt)) {
        console.error(`invalid id ${id}`);
        return "new";
    }
    return idInt;
}

function getDropPreviewCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const snapCoords = getSnapCoords(dzRef, dragEvent);
    if (snapCoords === null) {
        const [x, y] = getNonSnapPreviewCoords(dzRef, dragEvent);
        return {x, y}
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
    return [snapCoords.x, snapCoords.y] as const;
}

const SNAP_THRESHOLD = 150;

function getSnapCoords(
    dzRef: RefObject<HTMLDivElement>,
    dragEvent: Dnd.DragEvent,
) {
    const active = getActiveCentroid();
    if (active === null) {
        console.log("no active");
        return null;
    }
    const activeDims = getActiveDims();
    if (activeDims === null) {
        console.log("no active dims");
        return null;
    }
    const closest = getClosestCentroid(parseId(dragEvent.active.id));
    if (closest === null) {
        console.log("no closest");
        return null;
    }
    if (closest.distance > SNAP_THRESHOLD) {
        console.log("closest too far", closest.distance);
        return null;
    }
    const closestLoc = getOffset(closest.id);
    if (!closestLoc) {
        console.log("no closest loc");
        return null;
    }
    const side = getSide(active, closest.centroid);
    const dzDims = dzRef.current?.getBoundingClientRect();
    if (!dzDims) {
        console.log("no dz dims");
        return null;
    }
    const coords = calcSnapCoords(side, activeDims, closestLoc);
    console.log("side", side, coords);
    return coords;
}

type Side = "above" | "below" | "left" | "right";

function getSide(a: Point, b: Point): Side {
    const right = a.x > b.x;
    const below = a.y > b.y;
    const xCloser = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
    if (xCloser) {
        return below ? "below" : "above";
    }
    return right ? "right" : "left";
}

const SNAP_PAD = 5;

function calcSnapCoords(side: Side, activeDims: DOMRect, closest: Point) {
    let snapX = activeDims.left;
    let snapY = activeDims.top;
    switch (side) {
        case "above":
            snapX = closest.x;
            snapY = closest.y - activeDims.height - SNAP_PAD;
            break;
        case "below":
            snapX = closest.x;
            snapY = closest.y + activeDims.height + SNAP_PAD;
            break;
        case "left":
            snapX = closest.x - activeDims.width - SNAP_PAD;
            snapY = closest.y;
            break;
        case "right":
            snapX = closest.x + activeDims.width + SNAP_PAD;
            snapY = closest.y;
            break;
    }
    return {x: snapX, y: snapY};
}

function distance(a: Point, b: Point) {
    return Math.floor(
        Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)),
    );
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

function DropPreview() {
    const active = seatStore(s => s.preview);
    return (
        active && (
            <div
                className="absolute h-24 w-24 bg-blue-200"
                style={{ left: active.x, top: active.y }}
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

function Seat(props: { id: newId; offset?: { x: number; y: number } }) {
    const style = useSeatPos(props.offset);
    const setSeatRef = useSetSeatRef(props.id);
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
