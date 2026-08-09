// list.ts — keyed list binding. The RatatUI model: a row is rendered ONCE;
// after that, only the wires inside it fire.
import { bind } from "./bind.js";
import { knob } from "./knob.js";
import { scope as makeScope } from "./scope.js";
let autoId = 0;
export function list(container, source, render, options = {}) {
    const { key = (item, i) => (item && item.id !== undefined ? item.id : i), label = `list#${++autoId}`, } = options;
    let rows = new Map();
    const reconcile = (items) => {
        const nextRows = new Map();
        items.forEach((item, i) => {
            const k = key(item, i);
            if (nextRows.has(k)) {
                console.warn(`[RatatUI] duplicate key "${k}" in ${label} — skipping later item.`);
                return;
            }
            let row = rows.get(k);
            if (row) {
                row.itemKnob.set(item);
            }
            else {
                const rowScope = makeScope(`${label}:row:${k}`);
                const itemKnob = rowScope.own(knob(item, `${label}:item:${k}`));
                const el = render(itemKnob, rowScope);
                row = { el, itemKnob, rowScope };
            }
            nextRows.set(k, row);
        });
        for (const [k, row] of rows) {
            if (!nextRows.has(k)) {
                row.rowScope.dispose();
                row.el.remove();
            }
        }
        let ref = container.firstChild;
        for (const [, row] of nextRows) {
            if (row.el === ref) {
                ref = ref.nextSibling;
            }
            else {
                container.insertBefore(row.el, ref);
            }
        }
        rows = nextRows;
    };
    const disposeBind = bind([source], (v) => v, reconcile, label);
    return () => {
        disposeBind();
        rows.forEach((row) => { row.rowScope.dispose(); row.el.remove(); });
        rows.clear();
    };
}
