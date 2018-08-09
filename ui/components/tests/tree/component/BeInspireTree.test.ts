/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BeInspireTree } from "@src/tree/component/BeInspireTree";

describe("BeInspireTree", () => {

  it("gets created", () => {
    const tree = new BeInspireTree([], () => { });
    tree.should.not.be.undefined;
  });

});
