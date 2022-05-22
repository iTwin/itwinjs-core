/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/ban-types */

export function prettyPrint(jsonObject: object): string {
  if (jsonObject === undefined)
    return "";
  let tabCounter = 0;
  let charCounter = 0;
  let justEnteredArray = false;
  const original = JSON.stringify(jsonObject);
  let prettyString: string = "";
  const strLen = original.length;
  for (let i = 0; i < strLen; i++) {
    // If '}', return and tab before placing next character
    if (original[i] === "}") {
      prettyString += "\r\n";
      tabCounter--;
      for (let j = 0; j < tabCounter; j++) {
        prettyString += " ";
      }
      prettyString += original[i];
      continue;
    }
    // If '{', return and tab after placing next character
    if (original[i] === "{") {
      prettyString += "\r\n";
      for (let j = 0; j < tabCounter; j++) {
        prettyString += " ";
      }
      tabCounter++;
      prettyString += "{";
      continue;
    }

    // If entering an array of numbers, loop through the array character at a time, where commas mark the end of a number. . .
    // keep track of how many characters have passed, and format with returns and tabs appropriately
    if (original[i] === "[") {
      if ((original[i + 1] >= "0" && original[i + 1] <= "9") || original[i + 1] === "-") {
        prettyString += "[";
        i++;
        justEnteredArray = true;
        let tempString = "";
        // Loop through the array
        while (original[i] !== "]") {
          tempString += original[i];
          charCounter++;
          if (original[i] === ",") {
            // Hit end of number
            if (charCounter >= 120) {
              charCounter = 0;
              if (justEnteredArray) {
                justEnteredArray = false;
                prettyString += "\r\n";
                for (let j = 0; j < tabCounter; j++) {
                  prettyString += " ";
                }
              }
              tempString += "\r\n";
              prettyString += tempString;
              tempString = "";
              for (let j = 0; j < tabCounter; j++) {
                prettyString += " ";
              }
            }
          }
          i++;
        }
        // Dump out any remaining numbers
        prettyString += tempString;
        charCounter = 0;
      }
    }

    // If ',' followed by either '"" or "]", add comma, then return and tab, then add next character and increment i once extra
    if (original[i] === ",") {
      if (original[i + 1] === '"' || original[i + 1] === "[") {
        prettyString += ",\r\n";
        for (let j = 0; j < tabCounter; j++) {
          prettyString += " ";
        }
        prettyString += original[i + 1];
        i++;
        continue;
      }
    }

    // Otherwise... add the character
    prettyString += original[i];
  }
  return prettyString;
}
