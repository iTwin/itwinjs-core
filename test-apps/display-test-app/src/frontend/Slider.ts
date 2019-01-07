/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export interface Slider {
  label: HTMLLabelElement;
  slider: HTMLInputElement;
  div: HTMLDivElement;
}

export type SliderHandler = (slider: HTMLInputElement) => void;

export interface SliderProps {
  name: string;
  handler: SliderHandler;
  id: string;
  parent?: HTMLElement;
  min: string;
  max: string;
  step: string;
  value: string;
}

export function createSlider(props: SliderProps): Slider {
  const div = document.createElement("div");

  const label = document.createElement("label") as HTMLLabelElement;
  label.htmlFor = props.id;
  label.innerText = props.name;
  div.appendChild(label);

  const slider = document.createElement("input") as HTMLInputElement;
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
