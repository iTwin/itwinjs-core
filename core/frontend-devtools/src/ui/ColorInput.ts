/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Controls
 */

import { RgbColor } from "@itwin/core-common";

/** @alpha */
export type ColorInputHandler = (value: string) => void;

/** @alpha */
export interface ColorInputProps {
  handler: ColorInputHandler;
  value: string;
  id?: string;
  label?: string;
  parent?: HTMLElement;
  display?: "inline" | "none" | "block";
  disabled?: boolean;
  tooltip?: string;
}

/** @alpha */
export interface ColorInput {
  div: HTMLDivElement;
  input: HTMLInputElement;
  label?: HTMLLabelElement;
}

/** @alpha */
export function convertHexToRgb(hex: string): RgbColor | undefined {
  // Parse a hex color string formatted as "#FFFFFF"
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? new RgbColor(
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ) : undefined;
}

/** @alpha */
export function createColorInput(props: ColorInputProps): ColorInput {

  const inputDiv = document.createElement("div");

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = props.value;

  colorInput.onchange = () => {
    try {
      const value = colorInput.value;
      props.handler(value);
    } catch (_ex) {
      //
    }
  };
  let colorLabel: HTMLLabelElement;

  if (undefined !== props.label) {
    colorLabel = document.createElement("label");
    colorLabel.innerText = `${props.label} `;
    inputDiv.appendChild(colorLabel);
  }
  inputDiv.appendChild(colorInput);

  if (undefined !== props.display) inputDiv.style.display = props.display;
  if (undefined !== props.id) colorInput.id = props.id;
  if (undefined !== props.tooltip) colorInput.title = props.tooltip;
  if (undefined !== props.disabled) colorInput.disabled = props.disabled;
  if (undefined !== props.parent) props.parent.appendChild(inputDiv);

  return undefined !== colorLabel! ? { div: inputDiv, input: colorInput, label: colorLabel! } : { div: inputDiv, input: colorInput };
}
