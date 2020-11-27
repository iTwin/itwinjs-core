/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// cspell:ignore showstatus showerror

// show status in the output HTML
export function showStatus(string1: string, string2?: string): void {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);
  const showstatus = document.getElementById("showstatus");
  if (showstatus)
    showstatus.innerHTML = outString;
}

export function showError(string1: HTMLElement | string, string2?: string): void {
  const span = document.createElement("span");

  if (typeof string1 === "string") {
    const textNode = document.createTextNode(string1);
    span.appendChild(textNode);
  } else {
    span.appendChild(string1);
  }

  if (string2) {
    const textNode = document.createTextNode(` ${string2}`);
    span.appendChild(textNode);
  }

  const showerror = document.getElementById("showerror");
  if (showerror) {
    while (showerror.firstChild) {
      showerror.removeChild(showerror.firstChild);
    }
    showerror.appendChild(span);
  }
}
