/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** Wraps an HTML button
 * @alpha
 */
export interface Button {
  button: HTMLInputElement;
  div: HTMLElement;
}

/** Callback invoked by Button when clicked.
 * @alpha
 */
export type ButtonHandler = (button: HTMLInputElement) => void;

/** Describes how to create a Button.
 * @alpha
 */
export interface ButtonProps {
  handler: ButtonHandler;
  id?: string;
  parent?: HTMLElement;
  value: string;
  inline?: boolean;
  tooltip?: string;
}

/** Creates a Button as specified by the ButtonProps.
 * @alpha
 */
export function createButton(props: ButtonProps): Button {
  const div = document.createElement(props.inline ? "span" : "div");

  const button = document.createElement("input");
  button.type = "button";
  button.value = props.value;
  button.addEventListener("click", () => props.handler(button));
  div.appendChild(button);

  if (undefined !== props.id)
    button.id = props.id;
  if (undefined !== props.tooltip)
    div.title = props.tooltip;
  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { button, div };
}
