/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export interface Button {
  button: HTMLInputElement;
  div: HTMLDivElement;
}

export type ButtonHandler = (button: HTMLInputElement) => void;

export interface ButtonProps {
  handler: ButtonHandler;
  id: string;
  parent?: HTMLElement;
  value: string;
}

export function createButton(props: ButtonProps): Button {
  const div = document.createElement("div");

  const button = document.createElement("input") as HTMLInputElement;
  button.type = "button";
  button.id = props.id;
  button.value = props.value;
  button.addEventListener("click", () => props.handler(button));
  div.appendChild(button);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { button, div };
}
