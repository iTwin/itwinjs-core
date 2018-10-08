/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// show status in the output HTML
export function showStatus(string1: string, string2?: string) {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);
  const showstatus = document.getElementById("showstatus");
  if (showstatus)
    showstatus.innerHTML = outString;
}
export function showError(string1: string, string2?: string) {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);

  const showerror = document.getElementById("showerror");
  if (showerror)
    showerror.innerHTML = outString;
}
