/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export function appendContent(container: HTMLDivElement, content: HTMLElement | string): void {
  if (typeof content === "string") {
    const span = document.createElement("span");
    span.innerHTML = content;
    container.appendChild(span);
  } else {
    container.appendChild(content);
  }
}
