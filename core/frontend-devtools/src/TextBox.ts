/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @alpha */
export interface TextBox {
  label?: HTMLLabelElement;
  textbox: HTMLInputElement;
  div: HTMLDivElement;
}

/** @alpha */
export type TextBoxHandler = (textbox: HTMLInputElement) => void;

/** @alpha */
export interface TextBoxProps {
  label?: string;
  id: string;
  parent?: HTMLElement;
  handler?: TextBoxHandler;
  tooltip?: string;
}

/** @alpha */
export function createTextBox(props: TextBoxProps): TextBox {
  const div = document.createElement("div");

  let label;
  if (undefined !== props.label) {
    label = document.createElement("label") as HTMLLabelElement;
    label.htmlFor = props.id;
    label.innerText = props.label;
    div.appendChild(label);
  }

  const textbox = document.createElement("input") as HTMLInputElement;
  textbox.type = "text";
  textbox.id = props.id;
  div.appendChild(textbox);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  const handler = props.handler;
  if (undefined !== handler)
    textbox.onchange = () => handler(textbox);

  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  return { label, textbox, div };
}
