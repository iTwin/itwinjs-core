/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface ComboBoxEntry {
  name: string;
  value: number | string | undefined;
}

/** @alpha */
export type ComboBoxHandler = (select: HTMLSelectElement) => void;

/** @alpha */
export interface ComboBoxProps {
  id: string;
  entries: ComboBoxEntry[];
  parent?: HTMLElement;
  handler?: ComboBoxHandler;
  value?: number | string;
  tooltip?: string;
  className?: string;
}

function appendComboBoxEntry(select: HTMLSelectElement, entry: ComboBoxEntry) {
  const option = document.createElement("option");
  option.innerText = entry.name;
  if (undefined !== entry.value)
    option.value = entry.value.toString();
  select.appendChild(option);
}

/** @alpha */
export function createComboBox(props: ComboBoxProps): HTMLSelectElement {
  const doc = props.parent?.ownerDocument ?? document;

  const select = doc.createElement("select");
  select.id = props.id;
  if (undefined !== props.className)
    select.className = props.className;

  for (const entry of props.entries) {
    appendComboBoxEntry(select, entry);
  }

  if (undefined !== props.value)
    select.value = props.value.toString();

  const handler = props.handler;
  if (undefined !== handler)
    select.onchange = () => handler(select);

  if (undefined !== props.tooltip)
    select.title = props.tooltip;

  return select;
}
