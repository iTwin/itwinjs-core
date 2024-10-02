/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface RadioBoxEntry {
  value: number | string | undefined;
  label: string;
}

/** @alpha */
export type RadioBoxHandler = (value: string, form: HTMLFormElement) => void;

/** @alpha */
export interface RadioBoxProps {
  id: string;
  entries: RadioBoxEntry[];
  handler: RadioBoxHandler;
  name?: string;
  parent?: HTMLElement;
  defaultValue?: number | string;
  vertical?: boolean;
}

/** @alpha */
export interface RadioBox {
  label?: HTMLLabelElement;
  setValue: (newValue: number | string) => boolean;
  div: HTMLDivElement;
  form: HTMLFormElement;
}

/** @alpha */
export function createRadioBox(props: RadioBoxProps): RadioBox {
  const div = document.createElement("div");

  let label: HTMLLabelElement | undefined;
  if (undefined !== props.name) {
    label = document.createElement("label");
    label.htmlFor = props.id;
    label.innerText = props.name;
    div.appendChild(label);
  }

  const form = document.createElement("form");
  form.id = props.id;

  const radioBoxes: HTMLInputElement[] = [];

  for (const entry of props.entries) {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = props.name ? props.name : props.id;

    input.value = (undefined !== entry.value) ? entry.value.toString() : "";

    const inputLabel: HTMLLabelElement = document.createElement("label");
    inputLabel.innerText = entry.label;

    inputLabel.onclick = () => {
      try {
        input.checked = true;
        const value = input.value;
        props.handler(value, form);
      } catch {
        //
      }
    };

    input.onchange = () => {
      try {
        const value = input.value;
        props.handler(value, form);
      } catch {
        //
      }
    };
    if (props.defaultValue === entry.value) {
      input.checked = true;
    }

    radioBoxes.push(input);

    if (props.vertical) {
      const container = document.createElement("div");
      container.appendChild(input);
      container.appendChild(inputLabel);
      form.appendChild(container);
    } else {
      form.appendChild(input);
      form.appendChild(inputLabel);
    }
  }

  div.appendChild(form);
  if (undefined !== props.parent)
    props.parent.appendChild(div);

  const setValue = (value: number | string): boolean => {
    const stringValue = value.toString();
    const validValue: boolean = radioBoxes.map((input) => input.value).includes(stringValue);
    if (validValue) {
      radioBoxes.forEach((input) => input.checked = input.value === stringValue);
      props.handler(stringValue, form);
    }
    return validValue;
  };

  return { div, label, setValue, form };
}
