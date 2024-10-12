"use client";

import { useRef, useMemo, useCallback } from "react";
import type { RefObject } from "react";
import { enableMapSet } from "immer";
import type { Draft } from "immer";
import { Dnd, DragOverlay } from "./dnd";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import React from "react";
import { useMap } from "@uidotdev/usehooks";

enableMapSet();

const NEW_ID = "new" as const;

const SEATING_CHART_DROPPABLE_ID = "seating-chart";

const SELECTION_DRAGGABLE_ID = "selection";

const SEAT_GRID_W = 4;
const SEAT_GRID_H = 4;
const DEFAULT_GRID_W = 60;
const DEFAULT_GRID_H = 40;
const DEFAULT_GRID_CELL_PX = 32;

type id = number;

type newId = id | typeof NEW_ID;

type Point = { x: number; y: number };

type GridPoint = { gridX: number; gridY: number };

type Active = GridPoint & { id: newId };

type SeatsData = {
    seats: id[];
    offsets: Map<id, GridPoint>;
    refs: Map<newId, HTMLElement | null>;
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
        nextId: 0,
        active: null,
        preview: null,
        gridCellPx: DEFAULT_GRID_CELL_PX,
        gridW: DEFAULT_GRID_W,
        gridH: DEFAULT_GRID_H,
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
            });
        },
    })),
);

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    const selectedSeats = useMap() as Map<id, GridPoint>;

    const [selectionDragOffset, setSelectionDragOffset] =
        React.useState<Point | null>(null);

    const [isDraggingSelection, setIsDraggingSelection] = React.useState(false);
    const [selectionStart, setSelectionStart] = React.useState<Point | null>(
        null,
    );
    const [selectionEnd, setSelectionEnd] = React.useState<Point | null>(null);
    const [persistentSelection, setPersistentSelection] = React.useState<{
        start: Point;
        end: Point;
    } | null>(null);

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
        <div className="w-xs lg:w-md md:w-sm xl:w-lg 2xl:w-xl">
            <Dnd.Context
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
            >
                <Dnd.Droppable
                    id={SEATING_CHART_DROPPABLE_ID}
                    className="relative z-auto overflow-auto border-2 border-red-800 bg-white"
                    style={droppableStyle}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    <div ref={dropRef} className="z-0">
                        {active ? null : !isDraggingSelection &&
                          persistentSelection ? (
                            <DraggableSelection
                                persistentSelection={persistentSelection}
                                gridCellPx={gridCellPx}
                            >
                                {Array.from(selectedSeats.entries()).map(
                                    ([id, offset]) => (
                                        <SelectedSeat
                                            seatId={id}
                                            key={id}
                                            offset={offset}
                                        />
                                    ),
                                )}
                            </DraggableSelection>
                        ) : selectionStart && selectionEnd ? (
                            <SelectionPreview
                                selectionStart={selectionStart}
                                selectionEnd={selectionEnd}
                                gridCellPx={gridCellPx}
                            >
                                {Array.from(selectedSeats.keys()).map(
                                    (id) => (
                                        <NonDraggableSeat
                                            seatId={id}
                                            key={id}
                                        />
                                    ),
                                )}
                            </SelectionPreview>
                        ) : null}
                    </div>
                    <DropPreview />
                    {seats.map((id) =>
                        id == active?.id || selectedSeats.has(id) ? null : (
                            <DraggableSeat seatId={id} key={id} />
                        ),
                    )}
                    <DragOverlay
                        dropAnimation={{
                            duration: 250,
                            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                        }}
                    >
                        {persistentSelection ? (
                            <div
                                className="relative h-full w-full"
                                style={{
                                    transform: selectionDragOffset
                                        ? `translate(${selectionDragOffset.x}px, ${selectionDragOffset.y}px)`
                                        : undefined,
                                }}
                            >
                                <Selection>
                                    {Array.from(selectedSeats.entries()).map(
                                        ([id, offset]) => (
                                            <SelectedSeat seatId={id} key={id} offset={offset} />
                                        ),
                                    )}
                                </Selection>
                            </div>
                        ) : active ? (
                            <Seat id={active.id} />
                        ) : null}
                    </DragOverlay>
                </Dnd.Droppable>
                <div
                    className="border-l-2 border-l-black bg-white p-4"
                    style={{
                        minHeight: gridCellPx * (SEAT_GRID_H + 2),
                    }}
                >
                    <DraggableSeat />
                </div>
            </Dnd.Context>
        </div>
    );

    function clearPersistentSelection() {
        setPersistentSelection(null);
        selectedSeats.clear();
    }

    function handleMouseDown(e: React.MouseEvent) {
        if (isDraggingSelection) {
            return; // Don't create new selections while dragging an existing one
        }
        if (persistentSelection) {
            const rect = dropRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const isClickInSelection =
                    x >= persistentSelection.start.x &&
                    x <= persistentSelection.end.x &&
                    y >= persistentSelection.start.y &&
                    y <= persistentSelection.end.y;
                if (isClickInSelection) {
                    return; // Click is within the persistent selection, don't start a new selection
                }
            }
        }
        const rect = dropRef.current?.getBoundingClientRect();
        if (rect) {
            const x =
                Math.floor((e.clientX - rect.left) / gridCellPx) * gridCellPx;
            const y =
                Math.floor((e.clientY - rect.top) / gridCellPx) * gridCellPx;
            setSelectionStart({ x, y });
            clearPersistentSelection();
        }
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (selectionStart) {
            const rect = dropRef.current?.getBoundingClientRect();
            if (rect) {
                const x =
                    Math.floor((e.clientX - rect.left) / gridCellPx) *
                    gridCellPx;
                const y =
                    Math.floor((e.clientY - rect.top) / gridCellPx) *
                    gridCellPx;
                setSelectionEnd({ x, y });
            }
        }
    }

    function handleMouseUp() {
        if (isDraggingSelection) {
            if (selectionStart) {
                console.warn("selection start", selectionStart);
                setSelectionStart(null);
            }
            if (selectionEnd) {
                console.warn("selection end", selectionEnd);
                setSelectionEnd(null);
            }

            return;
        }
        if (
            selectionStart &&
            selectionEnd &&
            active == null &&
            !isDraggingSelection
        ) {
            const startX =
                Math.min(selectionStart.x, selectionEnd.x) / gridCellPx;
            const startY =
                Math.min(selectionStart.y, selectionEnd.y) / gridCellPx;
            const endX =
                Math.max(selectionStart.x, selectionEnd.x) / gridCellPx;
            const endY =
                Math.max(selectionStart.y, selectionEnd.y) / gridCellPx;

            const state = seatStore.getState()

            for (let i = 0; i < state.seats.length; i++) {
                const seatId = state.seats[i]!;
                const offset = state.offsets.get(seatId);
                if (offset == null) {
                    continue;
                }
                const isInSelection =
                    offset.gridX >= startX &&
                    offset.gridX <= endX &&
                    offset.gridY >= startY &&
                    offset.gridY <= endY;
                if (isInSelection) {
                    const seatSelectionOffset = {gridX: offset.gridX - startX, gridY: offset.gridY - startY};
                    selectedSeats.set(seatId, seatSelectionOffset);
                }
            }

            setPersistentSelection({
                start: selectionStart,
                end: selectionEnd,
            });
        }
        setSelectionStart(null);
        setSelectionEnd(null);
    }

    function handleDragStart(e: Dnd.DragStartEvent) {
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            setIsDraggingSelection(true);
            return;
        }
        const offset = offsets.get(e.active.id as id);
        if (!offset) {
            return;
        }
        console.log("drag start", offset);
        const active = Object.assign(offset, { id: e.active.id as newId });
        setActive(active);
        clearPersistentSelection();
    }
    function handleDragMove(e: Dnd.DragMoveEvent) {
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            const rect = dropRef.current?.getBoundingClientRect();
            if (rect) {
                const snapCoords = getSnapCoords(dropRef, e);
                const currentRect = e.active.rect.current.translated;
                if (snapCoords && currentRect) {
                    setSelectionDragOffset(
                        dbg(
                            {
                                x:
                                    snapCoords.gridX * gridCellPx -
                                    (currentRect!.left - rect.left),
                                y:
                                    snapCoords.gridY * gridCellPx -
                                    (currentRect!.top - rect.top),
                            },
                            "dragOffset",
                        ),
                    );
                }
            }
            return;
        }
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
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            setIsDraggingSelection(false);
            setSelectionDragOffset(null);
            // Update the persistent selection position
            if (persistentSelection && selectionDragOffset) {
                const delta = e.delta;
                const newStartX =
                    selectionDragOffset.x +
                    persistentSelection.start.x +
                    delta.x;
                const newStartY =
                    selectionDragOffset.y +
                    persistentSelection.start.y +
                    delta.y;
                setPersistentSelection({
                    start: {
                        x: newStartX,
                        y: newStartY,
                    },
                    end: {
                        x:
                            newStartX +
                            (persistentSelection.end.x -
                                persistentSelection.start.x),
                        y:
                            newStartY +
                            (persistentSelection.end.y -
                                persistentSelection.start.y),
                    },
                });

                const newStartGridX = Math.floor(newStartX / gridCellPx);
                const newStartGridY = Math.floor(newStartY / gridCellPx);

                for (const [id, offset] of selectedSeats.entries()) {
                    setSeatOffset(id, {
                        gridX: newStartGridX + offset.gridX,
                        gridY: newStartGridY + offset.gridY,
                    })
                }
            }
            return;
        }
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
        } else if (snapCoords) {
            setSeatOffset(id, snapCoords);
            stopDrag();
        } else {
            addDelta(id, e.delta);
            stopDrag();
        }
        // Clear persistent selection after drag
        clearPersistentSelection();
    }
}

function DraggableSelection({
    persistentSelection,
    gridCellPx,
    children,
}: React.PropsWithChildren<{
    persistentSelection: { start: Point; end: Point };
    gridCellPx: number;
}>) {
    const startX = persistentSelection.start.x;
    const startY = persistentSelection.start.y;

    const endX = persistentSelection.end.x;
    const endY = persistentSelection.end.y;
    return (
        <Dnd.Draggable
            id={SELECTION_DRAGGABLE_ID}
            className="absolute z-0 border-2 "
            style={{
                left: Math.min(startX, endX),
                top: Math.min(startY, endY),
                width: Math.abs(endX - startX) + gridCellPx,
                height: Math.abs(endY - startY) + gridCellPx,
            }}
        >
            <div className="relative h-full w-full">
                <Selection>{children}</Selection>
            </div>
        </Dnd.Draggable>
    );
}

function SelectionPreview({
    selectionStart,
    selectionEnd,
    gridCellPx,
    children,
}: React.PropsWithChildren<{
    selectionStart: Point;
    selectionEnd: Point;
    gridCellPx: number;
}>) {
    const startX = selectionStart.x;
    const startY = selectionStart.y;

    const endX = selectionEnd.x;
    const endY = selectionEnd.y;

    return (
        <div
            className="absolute z-0 border-2 "
            style={{
                left: Math.min(startX, endX),
                top: Math.min(startY, endY),
                width: Math.abs(endX - startX) + gridCellPx,
                height: Math.abs(endY - startY) + gridCellPx,
            }}
        >
            <Selection>{children}</Selection>
        </div>
    );
}

function Selection(props: React.PropsWithChildren) {
    return (
        <div className="h-full w-full border-2 border-blue-400 bg-blue-200/20">
            {props.children}
        </div>
    );
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
    // FIXME: adjust snap coords so they are offset by the mouse position, so things don't snap to the top/left
    // of the items bounding box
    const dzDims = dzRef.current?.getBoundingClientRect();

    if (!dzDims) {
        console.log("no dz dims");
        return { gridX: 0, gridY: 0 };
    }

    const state = seatStore.getState();
    const gridCellPx = state.gridCellPx;
    const gridW = state.gridW;
    const gridH = state.gridH;

    const { clientX, clientY } = dragEvent.activatorEvent as MouseEvent;
    const x = clientX - dzDims.left + dragEvent.delta.x;
    const y = clientY - dzDims.top + dragEvent.delta.y;

    const gridX = Math.floor(x / gridCellPx);
    const gridY = Math.floor(y / gridCellPx);

    const seats = state.seats;
    const offsets = state.offsets;
    const activeSeatId = dragEvent.active.id;

    function isOverlapping(
        gridX1: number,
        gridY1: number,
        gridX2: number,
        gridY2: number,
    ): boolean {
        return (
            Math.abs(gridX1 - gridX2) < SEAT_GRID_W &&
            Math.abs(gridY1 - gridY2) < SEAT_GRID_H
        );
    }

    function isValidPosition(gridX: number, gridY: number): boolean {
        for (const seatId of seats) {
            if (seatId.toString() === activeSeatId) continue; // Skip the actively dragging seat
            const seatOffset = offsets.get(seatId);
            if (
                seatOffset &&
                isOverlapping(gridX, gridY, seatOffset.gridX, seatOffset.gridY)
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
        while (distance < Math.max(DEFAULT_GRID_W, DEFAULT_GRID_H)) {
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
    const active = seatStore((s) => s.active);

    const gridCellPx = seatStore((s) => s.gridCellPx);

    const style = useMemo(() => {
        if (!offset) {
            return { position: "unset" as const };
        }
        return {
            position: "absolute" as const,
            top: offset.gridY * gridCellPx,
            left: offset.gridX * gridCellPx,
        };
    }, [offset, gridCellPx]);
    return (
        <Dnd.Draggable id={id + ""} data={{ id }} style={style}>
            <Seat id={id} offset={id == active?.id ? active : offset} />
        </Dnd.Draggable>
    );
}

function NonDraggableSeat(props: { seatId: id, selected?: boolean}) {
    const id: newId = props.seatId ?? "new";
    const offset = useSeatOffset(id);
    const active = seatStore((s) => s.active);

    const gridCellPx = seatStore((s) => s.gridCellPx);

    const style = useMemo(() => {
        if (!offset) {
            return { position: "unset" as const };
        }
        return {
            position: "absolute" as const,
            top: offset.gridY * gridCellPx,
            left: offset.gridX * gridCellPx,
        };
    }, [offset,  gridCellPx]);
    return (
        <div style={style}>
            <Seat id={id} offset={id == active?.id ? active : offset} />
        </div>
    );
}

function SelectedSeat(props: { seatId: id; offset: GridPoint }) {
    const id: newId = props.seatId;

    const gridCellPx = seatStore((s) => s.gridCellPx);

    const style = useMemo(() => {
        const relativeX = props.offset.gridX * gridCellPx;
        const relativeY = props.offset.gridY * gridCellPx;
        return {
            position: "absolute" as const,
            top: relativeY,
            left: relativeX,
        };
    }, [
        gridCellPx,
        props.offset.gridX,
        props.offset.gridY,
    ]);

    return (
        <div style={style}>
            <Seat id={id} selected />
        </div>
    );
}

function dbg<T>(v: T, msg: string): T {
    console.log(msg, v);
    return v;
}

function Seat(props: { id: newId; offset?: GridPoint, selected?: boolean }) {
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
            data-selected={props.selected === true ? "" : null}
            className="align-center border-2 border-black bg-white text-center text-black data-[selected]:border-blue-400"
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
