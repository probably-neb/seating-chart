"use client"

import React, { PropsWithChildren } from "react";
import {
    DndContext,
    DndContextProps,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { splitProps } from "@/lib/split-props";

export * as Dnd from "./dnd";

// NOTE: DragEndEvent is just an alias for the non-exported DragEvent, so for generality it is aliased here
export type {DragEndEvent as DragEvent, DragStartEvent, DragEndEvent, DragMoveEvent, DragOverEvent, UniqueIdentifier} from "@dnd-kit/core"

export {DragOverlay} from "@dnd-kit/core"

export function Context(props: PropsWithChildren<DndContextProps>) {
    const mouseSensor = useSensor(MouseSensor);
    const touchSensor = useSensor(TouchSensor);
    const keyboardSensor = useSensor(KeyboardSensor);

    const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

    return <DndContext {...props} sensors={sensors}>{props.children}</DndContext>;
}

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>

export function Droppable(props: PropsWithChildren<{ id: string } & DivProps>) {
    const [dropProps, divProps] = splitProps(props, ["id", "style", "children"])

    const { isOver, setNodeRef } = useDroppable({
        id: dropProps.id,
    });

    const style = Object.assign({
        color: isOver ? "green" : undefined,
    }, dropProps.style);

    return (
        <div ref={setNodeRef} {...divProps} style={style}>
            {dropProps.children}
        </div>
    );
}

export function Draggable(props: PropsWithChildren<{ id: string, data?: any}>) {
    const { attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
        id: props.id,
        data: props.data
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : 0
    };

    return (
        <button ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {props.children}
        </button>
    );
}
