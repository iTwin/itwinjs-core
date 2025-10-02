/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "../Geometry";

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

/** Return a random number in [a, b). */
export function getRandomNumber(a: number, b: number): number {
  return (b - a) * Math.random() + a;
}

/**
 * Return a random number in the interval [0, scale) with options for interval expansion.
 * * All defaults is just `Math.random()`.
 * @param scale largest value that can be returned. Default is 1.
 * @param edgeProbability additional probability of returning zero or an interval endpoint.
 * Default zero means no additional probability over `Math.random()`. Increase this value for edge case testing.
 * @param allowNegative whether to expand the interval to [-scale, scale). Default is false, for the interval [0,scale).
 */
export function getRandomNumberScaled(scale: number = 1, edgeProbability: number = 0, allowNegative: boolean = false): number {
  scale = Math.abs(scale);
  edgeProbability = Geometry.clamp(Math.abs(edgeProbability), 0, 1);
  const fractionProbability = 1 - edgeProbability;
  let numEdgeCases, numFractionCases;
  if (allowNegative) {
    numEdgeCases = 3;     // -1, 0, 1
    numFractionCases = 2; // -f, f
  } else {
    numEdgeCases = 2;     // 0, 1
    numFractionCases = 1; // f
  }
  let unscaled = 1, prevProbability = 0;
  const choice = Math.random(); // in [0, 1)
  if (allowNegative) {
    if (choice < (prevProbability += edgeProbability / numEdgeCases))
      unscaled = -1;
    else if (choice < (prevProbability += fractionProbability / numFractionCases))
      unscaled = -Math.random();
  }
  if (1 === unscaled) {
    if (choice < (prevProbability += edgeProbability / numEdgeCases))
      unscaled = 0;
    else if (choice < (prevProbability += fractionProbability / numFractionCases))
      unscaled = Math.random();
  }
  return unscaled * scale;
};