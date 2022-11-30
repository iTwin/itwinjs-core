/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipVector, ClipVectorProps } from "@itwin/core-geometry";
import { ViewDetails } from "../ViewDetails";

describe("ViewDetails", () => {
  describe("clipVector", () => {
    class TestDetails extends ViewDetails {
      public constructor(clip?: ClipVectorProps) {
        const jsonProps = clip ? { viewDetails: { clip } } : { };
        super(jsonProps);
      }

      public get storedClip(): ClipVector | undefined {
        return (this as any)._clipVector;
      }

      public get storedClipProps(): ClipVectorProps | undefined {
        return this._json.clip;
      }
    }

    const emptyClipProps: ClipVectorProps = [];
    const clipProps: ClipVectorProps = [{
      shape: {
        points: [
          [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 0, 0],
        ],
      },
    }];

    it("should keep in sync with JSON", () => {
      let details = new TestDetails();
      expect(details.storedClipProps).to.be.undefined;
      expect(details.clipVector).to.be.undefined;

      const clip = ClipVector.fromJSON(clipProps);
      details.clipVector = clip;
      expect(details.storedClipProps).to.deep.equal(clipProps);
      expect(details.clipVector).to.equal(clip);

      details = new TestDetails(clipProps);
      expect(details.storedClipProps).to.deep.equal(clipProps);
      expect(details.clipVector).not.to.be.undefined;

      details.clipVector = undefined;
      expect(details.storedClipProps).to.be.undefined;
      expect(details.clipVector).to.be.undefined;
    });

    it("should raise event when changed", () => {
    });

    it("should do nothing if same clip is assigned", () => {
    });

    it("setter treats empty and undefined as equal", () => {
    });

    it("does not save empty clip vector in JSON", () => {
    });

    it("getter allocates on first call", () => {
    });
  });
});
