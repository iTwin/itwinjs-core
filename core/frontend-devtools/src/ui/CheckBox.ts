/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface CheckBox {
  label: HTMLLabelElement;
  checkbox: HTMLInputElement;
  div: HTMLDivElement;
}

/** @alpha */
export type CheckBoxHandler = (checkbox: HTMLInputElement) => void;

/** @alpha */
export interface CheckBoxProps {
  name: string;
  handler: CheckBoxHandler;
  id: string;
  parent?: HTMLElement;
  isChecked?: boolean;
  typeOverride?: string;
  tooltip?: string;
}

/** @alpha */
export function createCheckBox(props: CheckBoxProps): CheckBox {
  const div = document.createElement("div");

  const checkbox = document.createElement("input");
  checkbox.type = props.typeOverride ? props.typeOverride : "checkbox";
  checkbox.id = props.id;
  checkbox.checked = !!props.isChecked;
  checkbox.addEventListener("click", () => props.handler(checkbox));
  div.appendChild(checkbox);

  const label = document.createElement("label");
  label.htmlFor = props.id;
  label.innerText = props.name;
  div.appendChild(label);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  return { label, checkbox, div };
}
