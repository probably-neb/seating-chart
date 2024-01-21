"use client";

import {
    useState,
    useRef,
    useMemo,
    useEffect,
} from "react";
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

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const { seats, addSeat, addDelta } = useSeats();
    const centroids = useCentroids();

    return (
        <Dnd.Context onDragEnd={handleDragEnd}>
            <Dnd.Droppable
                id={CANVAS_DROPPABLE_ID}
                className="relative min-h-[600px] min-w-[80%] bg-white"
            >
                <div ref={dropRef}>
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

    function handleDragEnd(e: Dnd.DragEndEvent) {
        console.log("drag end", e);
        const id = e.active.id as "new" | `${number}`;
        if (id == "new") {
            const cbb = dropRef.current?.getBoundingClientRect()
            const [x,y] = calcCoords(e, cbb)
            console.log({ id, x, y });
            addSeat(x, y);
            return;
        }
        const { x, y } = e.delta;
        addDelta(parseInt(id), x, y);
    }
}

function calcCoords(e: Dnd.DragEndEvent, dzOfs?: {left: number, top: number}) {
    const activator = e.activatorEvent as MouseEvent;
    const origX = activator.clientX;
    const origY = activator.clientY;
    const ofsX = activator.offsetX;
    const ofsY = activator.offsetY;
    const dzOfsX = dzOfs?.left ?? 0
    const dzOfsY = dzOfs?.top ?? 0
    const x = origX - ofsX - dzOfsX;
    const y = origY - ofsY - dzOfsY;
    return [x,y] as const

}

const CANVAS_DROPPABLE_ID = "seating-chart";

function DraggableSeat(props: { seat?: Seat }) {
    const seat = props.seat ?? { id: "new" };
    return (
        <Dnd.Draggable id={seat.id + ""} data={seat}>
            <Seat seat={props.seat} />
        </Dnd.Draggable>
    );
}

function Seat(props: { seat?: Seat }) {
    const id = props.seat?.id ?? -1;

    const style = useSeatPos(props.seat);

    return (
        <div
            id={id ? id + "" : undefined}
            className="align-center absolute h-24 w-24 border-2 border-black bg-white text-center text-black"
            style={style}
        >
            {props.seat?.id}
        </div>
    );
}

function useSeatPos(seat?: Seat) {
    const style = useMemo(() => {
        if (!seat) {
            return;
        }
        return {
            top: seat.y,
            left: seat.x,
        };
    }, [seat]);

    return style;
}
