/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface Slider {
  label: HTMLLabelElement;
  slider: HTMLInputElement;
  div: HTMLDivElement;
}

/** @alpha */
export type SliderHandler = (slider: HTMLInputElement) => void;

/** @alpha */
export interface SliderProps {
  name: string;
  handler: SliderHandler;
  id: string;
  parent?: HTMLElement;
  min: string;
  max: string;
  step: string;
  value: string;
  verticalAlign?: "middle" | false;
  textAlign?: "right" | false;
}

/** @alpha */
export function createSlider(props: SliderProps): Slider {
  const div = document.createElement("div");
  div.style.display = "block";
  if (props.verticalAlign)
    div.style.verticalAlign = props.verticalAlign;

  if (props.textAlign)
    div.style.textAlign = props.textAlign;

  const label = document.createElement("label");
  label.htmlFor = props.id;
  label.innerText = props.name;
  div.appendChild(label);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "slider";
  slider.id = props.id;
  slider.min = props.min;
  slider.max = props.max;
  slider.step = props.step;
  slider.value = props.value;
  slider.addEventListener("input", () => props.handler(slider));
  div.appendChild(slider);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { label, slider, div };
}
