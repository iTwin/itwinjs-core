/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export interface Button {
  button: HTMLInputElement;
  div: HTMLElement;
}

export type ButtonHandler = (button: HTMLInputElement) => void;

export interface ButtonProps {
  handler: ButtonHandler;
  id?: string;
  parent?: HTMLElement;
  value: string;
  inline?: boolean;
  tooltip?: string;
}

export function createButton(props: ButtonProps): Button {
  const div = document.createElement(props.inline ? "span" : "div");

  const button = document.createElement("input") as HTMLInputElement;
  button.type = "button";
  button.value = props.value;
  button.addEventListener("click", () => props.handler(button));
  div.appendChild(button);

  if (undefined !== props.id) button.id = props.id;
  if (undefined !== props.tooltip) div.title = props.tooltip;
  if (undefined !== props.parent) props.parent.appendChild(div);

  return { button, div };
}
