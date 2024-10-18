import { useRef, useMemo, useCallback } from "react";
import type { RefObject } from "react";
import { enableMapSet } from "immer";
import type { Draft } from "immer";
import { Dnd, DragOverlay } from "@/dnd";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import React from "react";
import { assert } from "@/lib/assert";
import { EditIcon } from "lucide-react";
import For from "@/components/util/for";
import { useShallow } from "zustand/react/shallow";
import onMount from "./lib/hooks/on-mount";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "./components/ui/sheet";

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

const useSeatStore = create<SeatStore>()(
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

type StudentData = {
    studentNames: Map<number, string>;
    nextStudentId: number;
    seats: Map<number, id>;
};

type StudentFns = {
    addStudent(name: string): void;
    removeStudent(id: number): void;
    updateStudentName(id: number, name: string): void;
    updateStudentNameInSeat(seatID: number, name: string): void;
    swapSeats(from: id, to: id): void;
    setSeat(studentID: number, seatID: number): void;
    getStudentInSeat(seat: id): string | null;
};

type StudentStore = StudentData & StudentFns;

const useStudentStore = create<StudentStore>()(
    immer((set, get) => ({
        studentNames: new Map(),
        nextStudentId: 0,
        seats: new Map(),
        addStudent(name) {
            set((state) => {
                const id = state.nextStudentId;
                state.studentNames.set(id, name);
                state.nextStudentId += 1;
            });
        },
        removeStudent(id) {
            set((state) => {
                state.studentNames.delete(id);
            });
        },
        updateStudentName(id, name) {
            set((state) => {
                state.studentNames.set(id, name);
            });
        },
        updateStudentNameInSeat(seatID, name) {
            set((state) => {
                const studentID = state.seats.get(seatID);
                if (!studentID) {
                    console.error(`no student in seat ${seatID}`);
                    return;
                }
                state.updateStudentName(studentID, name);
            });
        },
        getStudentInSeat(seatID) {
            const studentID = get().seats.get(seatID);
            if (!studentID) {
                return null;
            }
            const studentName = get().studentNames.get(studentID);
            return studentName ?? null;
        },
        setSeat(studentID, seatID) {
            assert(
                get().studentNames.has(studentID),
                "student not in studentNames",
                studentID,
                get().studentNames,
            );
            assert(
                !get().seats.has(studentID),
                "cannot set seat for student already in seat",
            );

            set((s) => {
                s.seats.set(studentID, seatID);
            });
        },
        swapSeats(from, to) {
            assert(from !== to, "from and to cannot be the same");
            assert(get().seats.has(from), "from not in seats");
            set((state) => {
                if (state.seats.has(to)) {
                    const tmp = state.seats.get(to)!;
                    state.seats.set(to, state.seats.get(from)!);
                    state.seats.set(from, tmp);
                } else {
                    state.seats.set(to, state.seats.get(from)!);
                    state.seats.delete(from);
                }
            });
        },
    })),
);

type SelectedSeats = Map<id, GridPoint>;
type SelectionDataNone = {
    mode: "none";
};
type SelectionDataCreating = {
    mode: "creating";
    start: Point;
    end: Point | null;
    seats: SelectedSeats;
};
type SelectionDataPersistent = {
    mode: "persistent";
    start: Point;
    end: Point;
    seats: SelectedSeats;
};
type SelectionDataDragging = {
    mode: "dragging";
    start: Point;
    end: Point;
    seats: SelectedSeats;
    dragOffset: Point;
};
type SelectionData =
    | SelectionDataNone
    | SelectionDataCreating
    | SelectionDataPersistent
    | SelectionDataDragging;

type SelectionFns = {
    startCreation(start: Point): void;
    updateEnd(end: Point, seats: SelectedSeats): void;
    stopCreation(seats: SelectedSeats): void;
    startDrag(dragOffset: Point): void;
    updateDrag(dragOffset: Point): void;
    stopDrag(start: Point, end: Point): void;
    clear(): void;
};

type SelectionStore = SelectionFns & SelectionData;

const useSelection = create<SelectionStore>()(
    devtools(
        (set) => ({
            mode: "none",
            clear() {
                set(() => ({ mode: "none" }), false);
            },
            startCreation(start) {
                set((s) => {
                    assert(
                        s.mode !== "dragging",
                        "expected mode not to be dragging when starting creaation",
                    );
                    return {
                        mode: "creating",
                        start: start,
                        end: null,
                        seats: new Map(),
                    };
                }, false);
            },
            updateEnd(end, seats) {
                set((state) => {
                    assert(
                        state.mode === "creating",
                        "Expected mode to be 'creating'",
                    );
                    return { end, seats: seats };
                }, false);
            },
            stopCreation(seats) {
                set((state) => {
                    assert(
                        state.mode === "creating",
                        "Expected mode to be 'creating' on stopCreation",
                    );
                    assert(
                        state.end != null,
                        "Expected end to be non-null on stopCreation",
                    );
                    return {
                        mode: "persistent",
                        start: state.start,
                        end: state.end,
                        seats,
                    };
                }, false);
            },
            startDrag(dragOffset) {
                set((state) => {
                    assert(
                        state.mode === "persistent",
                        "Expected mode to be 'persistent'",
                    );
                    return {
                        mode: "dragging",
                        dragOffset,
                    };
                }, false);
            },
            updateDrag(dragOffset) {
                set((state) => {
                    assert(
                        state.mode === "dragging",
                        "Expected mode to be 'dragging', found " + state.mode,
                    );
                    return { dragOffset };
                }, false);
            },
            stopDrag(start, end) {
                set((state) => {
                    assert(
                        state.mode === "dragging",
                        "Expected mode to be 'dragging', found " + state.mode,
                    );
                    return {
                        mode: "persistent",
                        start,
                        end,
                        seats: state.seats,
                    };
                }, false);
            },
        }),
        {
            name: "selection",
            enabled: true,
        },
    ),
);

export function Canvas() {
    const dropRef = useRef<HTMLDivElement | null>(null);

    onMount(() => {
        function adjustGridScale() {
            const windowWidth = window.innerWidth;
            const state = useSeatStore.getState();
            const gridW = state.gridW;
            const gridCellPx = Math.floor(windowWidth / gridW);
            console.log({ gridCellPx });
            useSeatStore.setState({ gridCellPx });
        }
        adjustGridScale();
        window.addEventListener("resize", adjustGridScale);
        return () => window.removeEventListener("resize", adjustGridScale);
    });

    const addSeat = useSeatStore((s) => s.addSeat);
    const addDelta = useSeatStore((s) => s.addDelta);
    const offsets = useSeatStore((s) => s.offsets);
    const setSeatOffset = useSeatStore((s) => s.setSeatOffset);

    const setActive = useSeatStore((s) => s.setActive);
    const setPreview = useSeatStore((s) => s.setPreview);

    const stopDrag = useSeatStore((s) => s.stopDrag);

    const seats = useSeatStore((s) => s.seats);

    const gridH = useSeatStore((s) => s.gridH);
    const gridW = useSeatStore((s) => s.gridW);
    const gridCellPx = useSeatStore((s) => s.gridCellPx);

    const active = useSeatStore((s) => s.active);

    const updateSelectionEnd = useSelection((s) => s.updateEnd);

    const [draggingStudentName, setDraggingStudentName] = React.useState<
        string | null
    >(null);

    const isDraggingSelection = useSelection((s) => s.mode === "dragging");
    const startSelectionCreation = useSelection((s) => s.startCreation);
    const stopSelectionCreation = useSelection((s) => s.stopCreation);
    const clearSelection = useSelection((s) => s.clear);

    const startDragSelection = useSelection((s) => s.startDrag);
    const stopDragSelection = useSelection((s) => s.stopDrag);
    const updateDragSelection = useSelection((s) => s.updateDrag);

    const selectedSeats = useSelection(
        (s): SelectedSeats | null =>
            // @ts-expect-error
            s.seats ?? null,
    );

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

    const selection = React.useMemo(() => {
        if (active != null) {
            return null;
        }
        const state = useSelection.getState();
        if (state.mode === "persistent") {
            const seats = Array.from(state.seats.entries());
            return (
                <DraggableSelection
                    persistentSelection={state}
                    gridCellPx={gridCellPx}
                >
                    {seats.map(([id, offset]) => (
                        <SelectedSeat seatId={id} key={id} offset={offset} />
                    ))}
                </DraggableSelection>
            );
        } else if (state.mode === "creating" && state.end != null) {
            const seats = Array.from(state.seats.entries());
            return (
                <SelectionPreview
                    selectionStart={state.start}
                    selectionEnd={state.end}
                    gridCellPx={gridCellPx}
                >
                    {seats.map(([id, offset]) => (
                        <SelectedSeat seatId={id} offset={offset} key={id} />
                    ))}
                </SelectionPreview>
            );
        }
        return null;
    }, [useSelection(), gridCellPx, active]);

    const studentIDs = useStudentStore(
        useShallow((s) => Array.from(s.studentNames.keys())),
    );
    const addStudent = useStudentStore((s) => s.addStudent);

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const wasSettingsOpenBeforeDrag = React.useRef(false);
    let sheetContentRef = React.useRef<HTMLDivElement>(null);
    return (
        <Dnd.Context
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
        >
            <div className="flex flex-row w-full justify-center">
                <div className="overflow-auto">
                    <Dnd.Droppable
                        id={SEATING_CHART_DROPPABLE_ID}
                        className="relative overflow-auto border-2 border-red-800 bg-white"
                        style={droppableStyle}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        <div ref={dropRef} className="z-0">
                            {selection}
                        </div>
                        <DropPreview />
                        {seats.map((id) =>
                            id == active?.id ||
                            selectedSeats?.has(id) ? null : (
                                <DraggableSeat seatId={id} key={id} />
                            ),
                        )}
                        <Sheet
                            open={isSettingsOpen}
                            onOpenChange={setIsSettingsOpen}
                        >
                            <SheetTrigger className="absolute top-4 right-4 bg-white text-foreground ring-2 ring-foreground rounded-lg px-3 py-2 text-xl">
                                Controls
                            </SheetTrigger>
                            <SheetContent
                                ref={sheetContentRef}
                                className="h-full border-l-2 border-l-black bg-white p-4"
                            >
                                <SheetHeader>
                                    <SheetTitle>Controls</SheetTitle>
                                    <SheetDescription>
                                        Drag a student or the new seat on to the
                                        canvas to add them
                                    </SheetDescription>
                                </SheetHeader>
                                <span className="text-lg font-bold leading-tight text-gray-700">
                                    Add a seat
                                </span>
                                <div
                                    style={{
                                        minHeight: SEAT_GRID_H * gridCellPx + 4,
                                    }}
                                >
                                    <DraggableSeat />
                                </div>
                                <div className="divide-y divide-gray-300 *:mt-2 flex flex-col gap-y-2">
                                    <button
                                        className="w-full bg-blue-500 rounded-md"
                                        onClick={() => {
                                            addStudent("");
                                        }}
                                    >
                                        Add Student
                                    </button>
                                    <For each={studentIDs}>
                                        {(id) => (
                                            <StudentEntry id={id} key={id} />
                                        )}
                                    </For>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </Dnd.Droppable>
                    <CanvasDragOverlay
                        active={active}
                        draggingStudentName={draggingStudentName}
                    />
                </div>
            </div>
        </Dnd.Context>
    );

    function handleMouseDown(e: React.MouseEvent) {
        const selectionState = useSelection.getState();
        if (selectionState && selectionState.mode === "dragging") {
            return; // Don't create new selections while dragging an existing one
        }

        const rect = dropRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if the click is within any existing seat
        const state = useSeatStore.getState();
        for (const seatId of state.seats) {
            const offset = state.offsets.get(seatId);
            if (offset) {
                const seatLeft = offset.gridX * gridCellPx;
                const seatTop = offset.gridY * gridCellPx;
                const seatRight = seatLeft + SEAT_GRID_W * gridCellPx;
                const seatBottom = seatTop + SEAT_GRID_H * gridCellPx;

                if (
                    x >= seatLeft &&
                    x <= seatRight &&
                    y >= seatTop &&
                    y <= seatBottom
                ) {
                    return; // Click is within an existing seat, return early
                }
            }
        }
        if (selectionState && selectionState.mode === "persistent") {
            const isClickInSelection =
                x >= selectionState.start.x &&
                x <= selectionState.end.x &&
                y >= selectionState.start.y &&
                y <= selectionState.end.y;
            if (isClickInSelection) {
                return; // Click is within the persistent selection, don't start a new selection
            }
        }

        const snapX = Math.floor(x / gridCellPx) * gridCellPx;
        const snapY = Math.floor(y / gridCellPx) * gridCellPx;
        console.log({ x: snapX, y: snapY });
        console.log("starting", selectionState, isDraggingSelection);
        startSelectionCreation({ x: snapX, y: snapY });
    }

    function handleMouseMove(e: React.MouseEvent) {
        const state = useSelection.getState();
        const mode = state.mode;

        if (mode !== "creating") {
            return;
        }
        const rect = dropRef.current?.getBoundingClientRect();
        if (rect) {
            const x =
                Math.floor((e.clientX - rect.left) / gridCellPx) * gridCellPx;
            const y =
                Math.floor((e.clientY - rect.top) / gridCellPx) * gridCellPx;
            // TODO: calculate selected seats  as drag occurs

            const start = state.start;
            const end = { x, y };

            const selectedSeats = getSelectedSeats(start, end, gridCellPx);

            updateSelectionEnd(end, selectedSeats);
        }
    }

    function handleMouseUp() {
        if (isDraggingSelection) {
            assert(useSelection.getState().mode === "dragging");
            return;
        }
        const selectionState = useSelection.getState();
        if (active != null) {
            assert(useSelection.getState().mode === "none");
            return;
        }
        if (selectionState.mode !== "creating") {
            return;
        }
        if (selectionState.end == null) {
            clearSelection();
            return;
        }
        const selectionStart = selectionState.start;
        const selectionEnd = selectionState.end;
        const newSelectedSeats = getSelectedSeats(
            selectionStart,
            selectionEnd,
            gridCellPx,
        );

        if (newSelectedSeats.size === 0) {
            console.log("empty selection");
            clearSelection();
            return;
        }

        stopSelectionCreation(newSelectedSeats);
    }

    function handleDragStart(e: Dnd.DragStartEvent) {
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            startDragSelection({ x: 0, y: 0 });
            return;
        }
        if (e.active.id.toString().startsWith("student-")) {
        const isDraggingStudent = e.active.id.toString().startsWith("student-");
        const isDraggingNewSeat = e.active.id === "new";

        if (isDraggingStudent || isDraggingNewSeat) {
            wasSettingsOpenBeforeDrag.current = isSettingsOpen;
            setIsSettingsOpen(false);
        }

        if (isDraggingStudent) {
            // dragging student
            console.log("dragging student", e.active.id);
            setDraggingStudentName(e.active.data.current!.name);
            return;
        }
        // dragging seat
        const offset = offsets.get(e.active.id as id);
        if (!offset) {
            return;
        }
        console.log("drag start", offset);
        const active = Object.assign(offset, { id: e.active.id as newId });
        setActive(active);
        clearSelection();
    }

    function handleDragMove(e: Dnd.DragMoveEvent) {
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            const rect = dropRef.current?.getBoundingClientRect();
            const currentRect = e.active.rect.current.translated;
            if (rect && currentRect) {
                const rectAdjustedLeft = currentRect.left - rect.left;
                const rectAdjustedTop = currentRect.top - rect.top;

                const snapX =
                    Math.floor(rectAdjustedLeft / gridCellPx) * gridCellPx;
                const snapY =
                    Math.floor(rectAdjustedTop / gridCellPx) * gridCellPx;

                const offset = {
                    x: snapX - rectAdjustedLeft,
                    y: snapY - rectAdjustedTop,
                };

                updateDragSelection(offset);
            }
            return;
        }

        if (e.active.id.toString().startsWith("student-")) {
            setDraggingStudentName(e.active.data.current!.name);
            if (e.over) {
                console.log("over:", e.over.id);
            }
            return;
        }

        // dragging seat
        const id = e.active.id as newId;

        if (e.over === null && id === "new") {
            setActive(null);
            return;
        }
        const snapCoords = getSeatSnapCoords(dropRef, e);
        if (snapCoords === null) {
            return;
        }
        setActive(Object.assign(snapCoords, { id }));
        setPreview(snapCoords);
    }

    function handleDragEnd(e: Dnd.DragEndEvent) {
        if (e.active.id === SELECTION_DRAGGABLE_ID) {
            // Update the persistent selection position

            const selectionState = useSelection.getState();
            if (selectionState.mode === "dragging") {
                const selectionDragOffset = selectionState.dragOffset;
                const persistentSelection = selectionState;
                const delta = e.delta;
                const newStartX =
                    selectionDragOffset.x +
                    persistentSelection.start.x +
                    delta.x;
                const newStartY =
                    selectionDragOffset.y +
                    persistentSelection.start.y +
                    delta.y;
                React.startTransition(() => {
                    stopDragSelection(
                        {
                            x: newStartX,
                            y: newStartY,
                        },
                        {
                            x:
                                newStartX +
                                (persistentSelection.end.x -
                                    persistentSelection.start.x),
                            y:
                                newStartY +
                                (persistentSelection.end.y -
                                    persistentSelection.start.y),
                        },
                    );

                    const newStartGridX = Math.floor(newStartX / gridCellPx);
                    const newStartGridY = Math.floor(newStartY / gridCellPx);

                    for (const [id, offset] of selectionState.seats.entries()) {
                        setSeatOffset(id, {
                            gridX: newStartGridX + offset.gridX,
                            gridY: newStartGridY + offset.gridY,
                        });
                    }
                });
            }
            return;
        }

        const isDraggingStudent = e.active.id.toString().startsWith("student-");
        const isDraggingNewSeat = e.active.id === "new";

        if (isDraggingStudent || isDraggingNewSeat) {
            setIsSettingsOpen(wasSettingsOpenBeforeDrag.current);
        }
        if (e.delta.x == 0 && e.delta.y == 0) {
            setDraggingStudentName(null);
            return;
        }

        if (isDraggingStudent) {
            if (e.over != null && e.over.id.toString().startsWith("seat-")) {
                const studentsState = useStudentStore.getState();
                const originalSeatID = e.active.data.current!.seatID as
                    | number
                    | null;
                assert(
                    originalSeatID == null ||
                        Number.isSafeInteger(originalSeatID),
                    "original seat id is null or integer",
                    originalSeatID,
                );

                const overSeatID = Number.parseInt(
                    e.over!.id.toString().slice("seat-".length),
                );

                assert(Number.isSafeInteger(overSeatID));

                if (originalSeatID == null) {
                    const studentID = e.active.data.current!
                        .studentID as number;
                    assert(
                        Number.isSafeInteger(studentID),
                        "student id is integer",
                        studentID,
                    );
                    studentsState.setSeat(studentID, overSeatID);
                } else {
                    if (originalSeatID === overSeatID) {
                        setDraggingStudentName(null);
                        return;
                    }

                    studentsState.swapSeats(originalSeatID, overSeatID);
                }
            }
            setDraggingStudentName(null);
            return;
        }

        const id = parseId(e.active.id);
        const snapCoords = getSeatSnapCoords(dropRef, e);
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
    }
}

function CanvasDragOverlay(props: {
    active: Active | null;
    draggingStudentName: string | null;
}) {
    const inner = React.useMemo(() => {
        const state = useSelection.getState();
        if (state.mode === "dragging") {
            const selectionDragOffset = state.dragOffset;
            const style = {
                transform: `translate(${selectionDragOffset.x}px, ${selectionDragOffset.y}px)`,
            };
            return (
                <div className="relative h-full w-full" style={style}>
                    <Selection>
                        {Array.from(state.seats.entries()).map(
                            ([id, offset]) => (
                                <SelectedSeat
                                    seatId={id}
                                    key={id}
                                    offset={offset}
                                />
                            ),
                        )}
                    </Selection>
                </div>
            );
        } else if (props.active != null) {
            return <Seat id={props.active.id} />;
        } else if (props.draggingStudentName) {
            return (
                <div className="rounded border px-3 py-2 leading-tight text-gray-700 shadow text-center bg-white">
                    <span className="font-semibold">
                        {props.draggingStudentName}
                    </span>
                </div>
            );
        }
        return null;
    }, [useSelection(), props.active, props.draggingStudentName]);
    return (
        <DragOverlay
            dropAnimation={{
                duration: 250,
                easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
        >
            {inner}
        </DragOverlay>
    );
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
            className="absolute z-0"
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
            className="absolute z-0"
            style={{
                left: Math.min(startX, endX),
                top: Math.min(startY, endY),
                width: Math.abs(endX - startX) + gridCellPx,
                height: Math.abs(endY - startY) + gridCellPx,
            }}
        >
            <div className="relative w-full h-full">
                <Selection>{children}</Selection>
            </div>
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

function getSeatSnapCoords(
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

    const state = useSeatStore.getState();
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
    const active = useSeatStore((s) => s.preview);
    const gridCellPx = useSeatStore((s) => s.gridCellPx);
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
    const active = useSeatStore((s) => s.active);

    const gridCellPx = useSeatStore((s) => s.gridCellPx);

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

function NonDraggableSeat(props: { seatId: id; selected?: boolean }) {
    const id: newId = props.seatId ?? "new";
    const offset = useSeatOffset(id);
    const active = useSeatStore((s) => s.active);

    const gridCellPx = useSeatStore((s) => s.gridCellPx);

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
        <div style={style}>
            <Seat id={id} offset={id == active?.id ? active : offset} />
        </div>
    );
}

function SelectedSeat(props: { seatId: id; offset: GridPoint }) {
    const id: newId = props.seatId;

    const gridCellPx = useSeatStore((s) => s.gridCellPx);

    const style = useMemo(() => {
        const relativeX = props.offset.gridX * gridCellPx;
        const relativeY = props.offset.gridY * gridCellPx;
        return {
            position: "absolute" as const,
            top: relativeY,
            left: relativeX,
        };
    }, [gridCellPx, props.offset.gridX, props.offset.gridY]);

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

function Seat(props: { id: newId; offset?: GridPoint; selected?: boolean }) {
    const gridCellPx = useSeatStore((s) => s.gridCellPx);
    const setSeatRef = useSetSeatRef(props.id);

    const studentID = useStudentStore((s) => {
        if (props.id === "new") return null;
        return s.seats.get(props.id) ?? null;
    });

    const studentName = useStudentStore((s) => {
        if (props.id === "new") return null;
        if (studentID == null) return null;
        return s.studentNames.get(studentID) ?? null;
    });

    const style = {
        height: SEAT_GRID_H * gridCellPx,
        width: SEAT_GRID_W * gridCellPx,
    };

    return (
        <div
            ref={setSeatRef}
            id={props.id + ""}
            data-selected={props.selected === true ? "" : null}
            className="flex flex-col items-center justify-center rounded-md border-2 border-black bg-white text-center text-black data-[selected]:border-blue-400"
            style={style}
        >
            {props.id === "new" ? (
                "new"
            ) : (
                <Dnd.Droppable
                    id={"seat-" + props.id}
                    className="h-full w-full flex flex-col items-center justify-center"
                >
                    {studentName ? (
                        <Dnd.DraggableDIV
                            id={"student-" + studentID}
                            className="z-50 bg-white flex flex-col items-center justify-center"
                            data={{
                                studentID,
                                seatID: props.id,
                                name: studentName,
                            }}
                        >
                            <div className="rounded border px-3 py-2 leading-tight text-gray-700 shadow">
                                <span className=" font-semibold">
                                    {studentName}
                                </span>
                            </div>
                        </Dnd.DraggableDIV>
                    ) : (
                        props.id
                    )}
                </Dnd.Droppable>
            )}
        </div>
    );
}

function useSeatOffset(id: newId) {
    const offset = useSeatStore((s) => {
        if (id === NEW_ID) {
            return;
        }
        return s.offsets.get(id);
    });
    return offset;
}

function useSetSeatRef(id: newId) {
    const setSeatRefFn = useSeatStore((s) => s.setSeatRef);
    const setSeatRef = useCallback<(elem: HTMLElement | null) => void>(
        setSeatRefFn(id),
        [id, setSeatRefFn],
    );
    return setSeatRef;
}

function StudentEntry(props: { id: number }) {
    const [isEditing, setIsEditing] = React.useState(false);

    const inputRef = React.useRef<HTMLInputElement>(null);

    const studentName = useStudentStore((s) => s.studentNames.get(props.id));

    const updateStudentName = React.useCallback(
        useStudentStore((s) => s.updateStudentName).bind(null, props.id),
        [props.id],
    );

    const handleEditClick = () => {
        setIsEditing(true);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    };

    const seatID = useStudentStore((s) => s.seats.get(props.id) ?? null);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                className="focus:shadow-outline w-[90%] appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
                value={studentName}
                onChange={(e) => updateStudentName(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onMouseDown={(e) => e.stopPropagation()}
            />
        );
    }
    if (studentName) {
        const inner = (
            <div className="flex flex-row items-center justify-between rounded border px-3 py-2 leading-tight text-gray-700 shadow">
                <span className="font-semibold">{studentName}</span>
                <div
                    role="button"
                    className="rounded bg-blue-500 px-2 py-1 text-white"
                    onClick={handleEditClick}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <EditIcon size={16} className="w-min" />
                </div>
            </div>
        );
        if (seatID == null) {
            return (
                <div className="w-full h-full">
                    <Dnd.DraggableDIV
                        id={"student-" + props.id}
                        className="z-50 bg-white"
                        data={{
                            studentID: props.id,
                            seatID: null,
                            name: studentName,
                        }}
                    >
                        {inner}
                    </Dnd.DraggableDIV>
                </div>
            );
        }
        return <div className="hover:cursor-not-allowed">{inner}</div>;
    }

    return (
        <button
            className="rounded bg-blue-500 px-2 py-1 text-white flex items-center justify-center"
            onClick={handleEditClick}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <EditIcon />
        </button>
    );
}

function getSelectedSeats(
    selectionStart: Point,
    selectionEnd: Point,
    gridCellPx: number,
): SelectedSeats {
    const startX = Math.min(selectionStart.x, selectionEnd.x) / gridCellPx;
    const startY = Math.min(selectionStart.y, selectionEnd.y) / gridCellPx;
    const endX = Math.max(selectionStart.x, selectionEnd.x) / gridCellPx;
    const endY = Math.max(selectionStart.y, selectionEnd.y) / gridCellPx;

    const selectedSeats: SelectedSeats = new Map();

    const state = useSeatStore.getState();

    for (let i = 0; i < state.seats.length; i++) {
        const seatId = state.seats[i]!;
        const offset = state.offsets.get(seatId);
        if (offset == null) {
            continue;
        }
        const seatLeft = offset.gridX;
        const seatTop = offset.gridY;
        const seatRight = offset.gridX + SEAT_GRID_W - 1;
        const seatBottom = offset.gridY + SEAT_GRID_H - 1;
        const corners: Array<[number, number]> = [
            [seatLeft, seatTop],
            [seatRight, seatTop],
            [seatLeft, seatBottom],
            [seatRight, seatBottom],
        ];
        let isInSelection = false;
        for (let i = 0; i < corners.length && !isInSelection; i++) {
            const [seatX, seatY] = corners[i]!;
            isInSelection ||=
                startX <= seatX &&
                startY <= seatY &&
                endX >= seatX &&
                endY >= seatY;
        }
        if (isInSelection) {
            const seatSelectionOffset = {
                gridX: offset.gridX - startX,
                gridY: offset.gridY - startY,
            };
            selectedSeats.set(seatId, seatSelectionOffset);
        }
    }

    return selectedSeats;
}
