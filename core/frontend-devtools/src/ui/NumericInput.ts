/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export type NumericInputHandler = (value: number, input: HTMLInputElement) => void;

/** @alpha */
export interface NumericInputProps {
  handler: NumericInputHandler;
  id?: string;
  parent?: HTMLElement;
  value: number;
  display?: "inline" | "none" | "block";
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
  parseAsFloat?: true;
}

/** @alpha */
export function createNumericInput(props: NumericInputProps, useFloat: boolean = false): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = props.value.toString();

  input.onchange = () => {
    try {
      const value = useFloat ? parseFloat(input.value) : parseInt(input.value, 10);
      if (!Number.isNaN(value))
        props.handler(value, input);
    } catch {
      //
    }
  };

  if (undefined !== props.id)
    input.id = props.id;
  if (undefined !== props.display)
    input.style.display = props.display;
  if (undefined !== props.min)
    input.min = props.min.toString();
  if (undefined !== props.max)
    input.max = props.max.toString();
  if (undefined !== props.step)
    input.step = props.step.toString();
  if (undefined !== props.tooltip)
    input.title = props.tooltip;
  if (undefined !== props.disabled)
    input.disabled = props.disabled;
  if (undefined !== props.parent)
    props.parent.appendChild(input);

  return input;
}

/** @alpha */
export interface LabeledNumericInputProps extends NumericInputProps {
  name: string;
  id: string;
  divDisplay?: "block" | "none" | "inline";
}

/** @alpha */
export interface LabeledNumericInput {
  input: HTMLInputElement;
  div: HTMLDivElement;
  label: HTMLLabelElement;
}

/** @alpha */
export function createLabeledNumericInput(props: LabeledNumericInputProps): LabeledNumericInput {
  const div = document.createElement("div");
  if (props.divDisplay)
    div.style.display = props.divDisplay;

  const label = document.createElement("label");
  label.htmlFor = props.id;
  label.innerText = props.name;
  div.appendChild(label);

  const inputProps = { ...props };
  inputProps.parent = div;
  inputProps.display = "inline";
  const input = createNumericInput(inputProps, true === props.parseAsFloat);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  return { label, div, input };
}
