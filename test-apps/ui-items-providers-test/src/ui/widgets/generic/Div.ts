/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface DivProps {
  parent?: HTMLElement;
  className?: string;
}

/** @alpha */
export function createDiv(props: DivProps): HTMLDivElement {
  const doc = props.parent?.ownerDocument ?? document;
  const div = doc.createElement("div");

  if (undefined !== props.className)
    div.className = props.className;

  return div;
}
