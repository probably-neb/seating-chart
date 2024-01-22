"use client";

import { useState, useRef, useMemo, useEffect, RefObject } from "react";
import { produce } from "immer";
import { Dnd } from "./dnd";

type Seat = {
    id: number;
    x: number;
    y: number;
};

function useSeats() {
    const [seats, setSeats] = useState<Seat[]>([]);
    const [id, setId] = useState(0);

    function addSeat(x: number, y: number) {
        const seat = {
            id,
            x,
            y,
        } satisfies Seat;
        setSeats((seats) => [...seats, seat]);
        setId((id) => id + 1);
    }

    function setSeatOffset(id: number, x: number, y: number) {
        setSeats(
            produce((seats) => {
                const i = seats.findIndex((s) => s.id === id);
                if (i === -1) {
                    return seats;
                }
                seats[i]!.x = x;
                seats[i]!.y = y;
            }),
        );
    }

    function addDelta(id: number, x: number, y: number) {
        setSeats(
            produce((seats) => {
                const i = seats.findIndex((s) => s.id === id);
                if (i === -1) {
                    return seats;
                }
                seats[i]!.x += x;
                seats[i]!.y += y;
            }),
        );
    }

    return {
        seats,
        addSeat,
        setSeatOffset,
        addDelta,
        nextId: id,
    };
}

type Point = { x: number; y: number };

function useCentroids() {
    type Centroid = Point & { id: number };
    const [centroids, setCentroids] = useState<Centroid[]>([]);

    function update(centroid: Centroid) {
        const i = centroids.findIndex((c) => c.id === centroid.id);
        if (i === -1) {
            setCentroids((cs) => [...cs, centroid]);
            return;
        }
        setCentroids(
            produce((cs) => {
                cs[i]!.x = centroid.x;
                cs[i]!.y = centroid.y;
            }),
        );
    }
    useEffect(() => {
        console.log("centroids", centroids);
    }, [centroids]);

    return {
        data: centroids,
        update,
    };
}

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const { seats, addSeat, addDelta } = useSeats();
    const centroids = useCentroids();

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
                        <DraggableSeat key={s.id} seat={s} />
                    ))}
                    {centroids.data.map((c) => (
                        <div
                            key={c.id}
                            className="absolute z-10 h-4 w-4 rounded-full bg-red-500"
                            style={{
                                left: c.x,
                                top: c.y,
                                transform: "translate(-50%, -50%)",
                            }}
                        ></div>
                    ))}
                </div>
            </Dnd.Droppable>
            <div className="h-[600px] min-w-28 border-l-2 border-l-black bg-white pl-4">
                <DraggableSeat />
            </div>
        </Dnd.Context>
    );

    function handleDragStart(e: Dnd.DragStartEvent) {
        const seat = seats.find((s) => "" + s.id === e.active.id);
        console.log("drag start", seat);
        if (seat) {
            setActive(() => ({ x: seat.x, y: seat.y }));
        }
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

function getDropPreviewCoords( dzRef: RefObject<HTMLDivElement>, dragEvent: Dnd.DragEvent) {
    const snapCoords = getSnapCoords(dzRef, dragEvent)
    if (snapCoords === null) {
        return getNonSnapPreviewCoords(dzRef, dragEvent)
    }
    return snapCoords

}

function getDropCoords( dzRef: RefObject<HTMLDivElement>, dragEvent: Dnd.DragEvent) {
    const snapCoords = getSnapCoords(dzRef, dragEvent)
    if (snapCoords === null) {
        return getNonSnapCoords(dzRef, dragEvent)
    }
    return snapCoords
}

function getSnapCoords( dzRef: RefObject<HTMLDivElement>, dragEvent: Dnd.DragEvent,) {
    return null
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

function DraggableSeat(props: { seat?: Seat }) {
    const seat = props.seat ?? { id: "new" };
    return (
        <Dnd.Draggable id={seat.id + ""} data={seat}>
            <Seat id={seat.id} offset={props.seat} />
        </Dnd.Draggable>
    );
}

function Seat(props: {
    id: number | string;
    offset?: { x: number; y: number };
}) {
    const style = useSeatPos(props.offset);

    return (
        <div
            id={props.id + ""}
            className="align-center h-24 w-24 border-2 border-black bg-white text-center text-black"
            style={style}
        >
            {props.id}
        </div>
    );
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
