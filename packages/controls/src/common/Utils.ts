/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export interface IPrioritized {
  priority: number;
}
export const prioritySortFunction = (a: IPrioritized, b: IPrioritized): number => {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return 0;
};
