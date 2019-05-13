/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export type NumericInputHandler = (value: number, input: HTMLInputElement) => void;

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

export function createNumericInput(props: NumericInputProps, useFloat: boolean = false): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = props.value.toString();

  input.onchange = () => {
    try {
      const value = useFloat ? parseFloat(input.value) : parseInt(input.value, 10);
      props.handler(value, input);
    } catch (_ex) {
      //
    }
  };

  if (undefined !== props.id) input.id = props.id;
  if (undefined !== props.display) input.style.display = props.display;
  if (undefined !== props.min) input.min = props.min.toString();
  if (undefined !== props.max) input.max = props.max.toString();
  if (undefined !== props.step) input.step = props.step.toString();
  if (undefined !== props.tooltip) input.title = props.tooltip;
  if (undefined !== props.disabled) input.disabled = props.disabled;
  if (undefined !== props.parent) props.parent.appendChild(input);

  return input;
}
