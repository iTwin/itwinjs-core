/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** Wraps an HTML text input field.
 * @beta
 */
export interface TextBox {
  /** The label, if the text box has one. */
  label?: HTMLLabelElement;
  /** The text input element. */
  textbox: HTMLInputElement;
  /** The div containing the text box. */
  div: HTMLDivElement;
}

/** @alpha */
export type TextBoxHandler = (textbox: HTMLInputElement) => void;

/** @alpha */
export type TextBoxKeyPressHandler = (textbox: HTMLInputElement, ev: KeyboardEvent) => void;

/** @alpha */
export interface TextBoxProps {
  label?: string;
  id?: string;
  parent?: HTMLElement;
  handler?: TextBoxHandler;
  keypresshandler?: TextBoxKeyPressHandler;
  focushandler?: TextBoxHandler;
  tooltip?: string;
  inline?: boolean;
  list?: string; // if defined, contains the id of a datalist to bind to this textbox for autocompletion
}

/** @alpha */
export function createTextBox(props: TextBoxProps): TextBox {
  const div = document.createElement("div");
  if (true === props.inline)
    div.style.display = "inline";

  let label;
  if (undefined !== props.label) {
    label = document.createElement("label");
    label.innerText = props.label;
    if (undefined !== props.id)
      label.htmlFor = props.id;

    div.appendChild(label);
  }

  const textbox = document.createElement("input");
  textbox.type = "text";
  if (undefined !== props.id)
    textbox.id = props.id;

  div.appendChild(textbox);

  if (undefined !== props.parent)
    props.parent.appendChild(div);

  const handler = props.handler;
  if (undefined !== handler) {
    textbox.onchange = () => handler(textbox);
  }

  // Don't want the document's listeners intepreting keypresses as keyboard shortcuts...
  const stopPropagation = (ev: KeyboardEvent) => ev.stopPropagation();
  textbox.onkeydown = textbox.onkeyup = stopPropagation;
  const keypresshandler = props.keypresshandler;
  if (undefined !== keypresshandler) {
    textbox.onkeypress = (ev: KeyboardEvent) => { // eslint-disable-line deprecation/deprecation
      keypresshandler(textbox, ev);
      ev.stopPropagation();
    };
  } else {
    textbox.onkeypress = stopPropagation; // eslint-disable-line deprecation/deprecation
  }

  const focushandler = props.focushandler;
  if (undefined !== focushandler) {
    textbox.onfocus = () => focushandler(textbox);
  }

  if (undefined !== props.list) {
    textbox.setAttribute("list", props.list);
  }

  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  return { label, textbox, div };
}
