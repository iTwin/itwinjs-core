/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
// Ensure this is treated as a module.
export {};

declare global {
  export interface String {
    format(...params: string[]): string;
  }
}

String.prototype.format = function() {
    const args = arguments;
    return this.replace(/{(\d+)}/g, (match, theNumber) => {
      return typeof args[theNumber] !== "undefined"
        ? args[theNumber]
        : match;
    });
  };
