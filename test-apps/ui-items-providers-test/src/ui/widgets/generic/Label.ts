/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface LabelProps {
  label: string;
  forId?: string;
  parent?: HTMLElement;
  tooltip?: string;
  className?: string;
}

/** @alpha */
export function createLabel(props: LabelProps): HTMLLabelElement {
  const doc = props.parent?.ownerDocument ?? document;

  const label = doc.createElement("label");
  if (props.forId)
    label.htmlFor = props.forId;

  if (undefined !== props.className)
    label.className = props.className;

  label.innerText = props.label;

  if (undefined !== props.tooltip)
    label.title = props.tooltip;

  return label;
}


