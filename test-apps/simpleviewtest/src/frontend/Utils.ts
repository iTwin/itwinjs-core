/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// show status in the output HTML
export function showStatus(string1: string, string2?: string) {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);
  document.getElementById("showstatus")!.innerHTML = outString;
}
