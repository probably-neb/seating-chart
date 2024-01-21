"use client";

import { useState, DragEventHandler, useRef, useMemo, DragEvent } from "react";
import { produce } from "immer";

type Seat = {
    id: number;
    x: number;
    y: number;
};

export function Canvas() {
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
                let i = seats.findIndex((s) => s.id === id);
                if (i === -1) {
                    return seats;
                }
                seats[i]!.x = x;
                seats[i]!.y = y;
            }),
        );
    }

    const dropRef = useRef<HTMLDivElement | null>(null);

    const onDrop: DragEventHandler<HTMLDivElement> = (e) => {
        const id = parseInt(e.dataTransfer.getData("id"));
        const offset = getDragOffset(e)
        // TODO: handle err (ofsx | ofsy = NaN)

        const drop = dropRef.current;
        if (!drop) return;
        const [x, y] = calculateOffset(drop, e, offset);

        console.log("dropped", id, {
            abs: {
                x,
                y,
            },
            offset,
        });
        if (isNaN(id)) {
            addSeat(x, y);
            return
        }
        setSeatOffset(id, x, y)
    };
    return (
        <>
            <div
                className="relative min-h-[600px] min-w-[80%] bg-white"
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
            >
                {seats.map((s) => (
                    <Seat key={s.id} seat={s} />
                ))}
            </div>
            <div className="h-[600px] min-w-28 border-l-2 border-l-black bg-white pl-4">
                <Seat />
            </div>
        </>
    );
}

function Seat(props: { seat?: Seat}) {
    const id = props.seat && props.seat.id + "";
    const seatRef = useRef<HTMLDivElement | null>(null);

    const onDragStart: DragEventHandler<HTMLDivElement> = (e) => {
        const seat = seatRef.current;
        if (!seat) return;
        setDragOffset(seat, e)
        if (id) {
            e.dataTransfer.setData("id", id);
        }
    };
    const style = useMemo(() => {
        if (!props.seat) {
            return;
        }
        return {
            top: props.seat.y,
            left: props.seat.x,
        };
    }, [props.seat]);
    return (
        <div
            id={id}
            ref={seatRef}
            draggable
            onDragStart={onDragStart}
            className="align-center absolute h-24 w-24 border-2 border-black text-center text-black"
            style={style}
        >
            {props.seat?.id}
        </div>
    );
}

function calculateOffset(
    dropzone: HTMLElement,
    dropped: { clientX: number; clientY: number },
    offset_?: { x: number; y: number },
) {
    const offset = Object.assign({ x: 0, y: 0 }, offset_);

    const rect = dropzone.getBoundingClientRect();
    const { left: dzX, top: dzY } = rect;

    const { clientX: dX, clientY: dY } = dropped;

    const x = dX - dzX - offset.x;
    const y = dY - dzY - offset.y;

    return [x, y] as const;
}

const OFFSET_X = "x"
const OFFSET_Y = "y"

function setDragOffset<Elem extends HTMLElement>(elem: Elem, e: DragEvent<Elem>) {
    const [x, y] = calculateOffset(elem, e);
    e.dataTransfer.setData(OFFSET_X, x + "");
    e.dataTransfer.setData(OFFSET_Y, y + "");
}

function getDragOffset<Elem extends HTMLElement>(e: DragEvent<Elem>) {
    const x = parseInt(e.dataTransfer.getData(OFFSET_X))
    const y = parseInt(e.dataTransfer.getData(OFFSET_Y))
    // TODO: handle x, y = NaN
    return {x, y}
}

