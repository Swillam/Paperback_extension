import { ButtonRow, FormItemElement, LabelRow } from "@paperback/types";

// Application.Selector needs literal method names, so a handler for each list
// position is attached to the form as `moveUp_${i}` / `moveDown_${i}`. Call this
// again after a move so the handlers match the current list length.
export function bindMoveHandlers(
    form: object,
    count: number,
    onMove: (from: number, to: number) => Promise<void> | void,
): void {
    const handlers = form as Record<string, unknown>;
    for (let i = 0; i < count; i++) {
        handlers[`moveUp_${i}`] = async (): Promise<void> => {
            await onMove(i, i - 1);
        };
        handlers[`moveDown_${i}`] = async (): Promise<void> => {
            await onMove(i, i + 1);
        };
    }
}

// A label and up/down buttons per item; the first item has no up button and
// the last one no down button.
export function buildReorderableRows(
    form: object,
    items: readonly string[],
    labelFor: (item: string, index: number) => string,
): FormItemElement<unknown>[] {
    const rows: FormItemElement<unknown>[] = [];
    items.forEach((item, i) => {
        rows.push(LabelRow(`order_${i}`, { title: labelFor(item, i) }));
        if (i > 0) {
            rows.push(
                ButtonRow(`move_up_${i}`, {
                    title: `↑ ${labelFor(item, i)}`,
                    onSelect: Application.Selector(
                        form as never,
                        `moveUp_${i}` as never,
                    ),
                }),
            );
        }
        if (i < items.length - 1) {
            rows.push(
                ButtonRow(`move_down_${i}`, {
                    title: `↓ ${labelFor(item, i)}`,
                    onSelect: Application.Selector(
                        form as never,
                        `moveDown_${i}` as never,
                    ),
                }),
            );
        }
    });
    return rows;
}
