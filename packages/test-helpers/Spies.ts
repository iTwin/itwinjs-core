/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as spies from "chai-spies";

chai.use(spies);

beforeEach(() => {
  restore();
});

export const restore = (obj?: any) => {
  // @types don't export `restore`...
  (chai.spy as any).restore(obj);
};

export { spy } from "chai";
