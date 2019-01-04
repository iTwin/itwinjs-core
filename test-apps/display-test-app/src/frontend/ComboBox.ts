/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export interface ComboBoxEntry<T> {
  name: string;
  value: T;
}

export type ComboBoxHandler = (select: HTMLSelectElement) => void;

export interface ComboBoxProps<T> {
  name: string;
  id: string;
  entries: Array<ComboBoxEntry<T>>;
  parent?: HTMLElement;
  handler?: ComboBoxHandler;
  value?: T;
}

export interface ComboBox {
  label: HTMLLabelElement;
  select: HTMLSelectElement;
  div: HTMLDivElement;
}

export function createComboBox<T>(props: ComboBoxProps<T>): ComboBox {
  const div = document.createElement("div");

  const label = document.createElement("label") as HTMLLabelElement;
  label.htmlFor = props.id;
  label.innerText = props.name;
  div.appendChild(label);

  const select = document.createElement("select") as HTMLSelectElement;
  select.id = props.id;

  for (const entry of props.entries) {
    const option = document.createElement("option") as HTMLOptionElement;
    option.innerText = entry.name;
    option.value = entry.value.toString();
    select.appendChild(option);
  }

  if (undefined !== props.value)
    select.value = props.value.toString();

  const handler = props.handler;
  if (undefined !== handler)
    select.onchange = () => handler(select);

  div.appendChild(select);
  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { div, label, select };
}
