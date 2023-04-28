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
  name?: string;
  id: string;
  entries: ComboBoxEntry[];
  parent?: HTMLElement;
  handler?: ComboBoxHandler;
  value?: number | string;
  tooltip?: string;
}

/** @alpha */
export interface ComboBox {
  label?: HTMLLabelElement;
  select: HTMLSelectElement;
  div: HTMLDivElement;
}

function _appendComboBoxEntry(select: HTMLSelectElement, entry: ComboBoxEntry) {
  const option = document.createElement("option");
  option.innerText = entry.name;
  if (undefined !== entry.value) option.value = entry.value.toString();
  select.appendChild(option);
}

/** @alpha */
export function createComboBox(props: ComboBoxProps): ComboBox {
  const div = document.createElement("div");

  let label: HTMLLabelElement | undefined;
  if (undefined !== props.name) {
    label = document.createElement("label");
    label.htmlFor = props.id;
    label.innerText = props.name;
    div.appendChild(label);
  }

  const select = document.createElement("select");
  select.id = props.id;

  for (const entry of props.entries) {
    _appendComboBoxEntry(select, entry);
  }

  if (undefined !== props.value) select.value = props.value.toString();

  const handler = props.handler;
  if (undefined !== handler) select.onchange = () => handler(select);

  if (undefined !== props.tooltip) div.title = props.tooltip;

  div.appendChild(select);
  if (undefined !== props.parent) props.parent.appendChild(div);

  return { div, label, select };
}
