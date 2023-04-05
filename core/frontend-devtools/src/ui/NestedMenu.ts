/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

import { createButton } from "./Button";

/** @alpha */
export type NestMenuHandler = (expanded: boolean) => void;

/** @alpha */
export interface NestedMenuProps {
  id?: string;
  label?: string;
  parent?: HTMLElement;
  expand?: boolean;
  handler?: NestMenuHandler;
  body?: HTMLElement;
}

/** @alpha */
export interface NestedMenu {
  div: HTMLDivElement;
  label: HTMLLabelElement;
  body: HTMLElement;
}

/** @alpha */
export function createNestedMenu(props: NestedMenuProps): NestedMenu {
  const div = document.createElement("div");
  const body = undefined !== props.body ? props.body : document.createElement("div");
  const header = document.createElement("div");

  div.appendChild(header);
  div.appendChild(body);
  header.style.width = "100%";

  const label = document.createElement("label");
  label.innerText = undefined !== props.label ? props.label : "";
  header.appendChild(label);

  let isExpanded = undefined !== props.expand ? props.expand : false;
  body.style.display = isExpanded ? "block" : "none";

  const toggleMenuButton = createButton({
    parent: header,
    inline: true,
    value: isExpanded ? "-" : "+",
    handler: () => undefined,
  });

  header.onclick = () => {
    isExpanded = !isExpanded;
    body.style.display = isExpanded ? "block" : "none";
    toggleMenuButton.button.value = isExpanded ? "-" : "+";
    if (undefined !== props.handler)
      props.handler(isExpanded);
  };

  toggleMenuButton.div.style.cssFloat = "right";

  header.appendChild(document.createElement("hr"));

  if (undefined !== props.parent)
    props.parent.appendChild(div);
  if (undefined !== props.id)
    div.id = props.id;

  return { body, label, div };
}
