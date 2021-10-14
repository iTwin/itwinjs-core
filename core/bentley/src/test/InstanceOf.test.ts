/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { asInstanceOf, isInstanceOf } from "../UtilityTypes";

describe("InstanceOf", () => {
  it("works", () => {
    interface Stuff {
      stuff: string;
    }

    class Thing implements Stuff {
      public stuff: string = "thing";
    }

    class PrivateThing extends Thing {
      private constructor() {
        super();
        this.stuff = "private";
      }

      public static create() { return new PrivateThing(); }
    }

    const test = (value: any, expectInstanceOf = false) => {
      const isInstance = isInstanceOf<Thing>(value, Thing);
      expect(isInstance).to.equal(expectInstanceOf);
      const instance = asInstanceOf<Thing>(value, Thing);
      expect(undefined !== instance).to.equal(isInstance);
      if (isInstance)
        expect(value instanceof Thing);
    };

    test(new Thing(), true);
    test(new Object());
    test({ stuff: "not a thing" });
    test(42);
    test("thing");
    test(undefined);
    test(null);
    test(true);
    test(PrivateThing.create(), true);
  });
});
