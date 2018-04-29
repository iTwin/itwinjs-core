/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

let previousUniqueNumber: number = 0;
export const getUniqueNumber = (): number => {
  let date = Date.now();
  if (date <= previousUniqueNumber)
    date = ++previousUniqueNumber;
  else
    previousUniqueNumber = date;
  return date;
};

export interface ValuesDictionary<T> {
  [key: string]: T;
}
