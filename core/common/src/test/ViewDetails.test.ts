/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ClipVector, ClipVectorProps } from "@itwin/core-geometry";
import { ViewDetails } from "../ViewDetails";

describe("ViewDetails", () => {
  describe("clipVector", () => {
    class TestDetails extends ViewDetails {
      private _clipChanged = false;

      public constructor(clip?: ClipVectorProps) {
        super(clip ? { viewDetails: { clip } } : { });
        this.onClipVectorChanged.addListener(() => this._clipChanged = true);
      }

      public get storedClip(): ClipVector | undefined {
        return (this as any)._clipVector;
      }

      public get storedClipProps(): ClipVectorProps | undefined {
        return this._json.clip;
      }

      public get clipChanged() {
        const changed = this._clipChanged;
        this._clipChanged = false;
        return changed;
      }
    }

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
      const details = new TestDetails();
      expect(details.clipChanged).to.be.false;

      details.clipVector = ClipVector.fromJSON(clipProps);
      expect(details.clipChanged).to.be.true;
      expect(details.clipChanged).to.be.false;

      details.clipVector = undefined;
      expect(details.clipChanged).to.be.true;

      details.clipVector = ClipVector.fromJSON(clipProps);
      expect(details.clipChanged).to.be.true;

      details.clipVector = ClipVector.createEmpty();
      expect(details.clipChanged).to.be.true;
    });

    it("treats empty and undefined as equivalent", () => {
      const details = new TestDetails();
      expect(details.clipVector).to.be.undefined;
      expect(details.storedClip).not.to.be.undefined;
      expect(details.storedClip!.isValid).to.be.false;

      details.clipVector = ClipVector.createEmpty();
      expect(details.clipVector).to.be.undefined;
      expect(details.storedClip).not.to.be.undefined;
      expect(details.storedClip!.isValid).to.be.false;
    });

    it("should do nothing if equivalent clip is assigned", () => {
      const details = new TestDetails();
      expect(details.clipChanged).to.be.false;

      details.clipVector = ClipVector.createEmpty();
      expect(details.clipChanged).to.be.false;

      details.clipVector = undefined;
      expect(details.clipChanged).to.be.false;

      const clip = ClipVector.fromJSON(clipProps);
      details.clipVector = clip;
      expect(details.clipChanged).to.be.true;

      details.clipVector = clip;
      expect(details.clipChanged).to.be.false;

      details.clipVector = clip.clone();
      expect(details.clipChanged).to.be.true;

      details.clipVector = undefined;
      expect(details.clipChanged).to.be.true;

      details.clipVector = undefined;
      expect(details.clipChanged).to.be.false;
    });

    it("does not save empty clip vector in JSON", () => {
      const details = new TestDetails();
      details.clipVector = ClipVector.createEmpty();
      expect(details.storedClip).not.to.be.undefined;
      expect(details.storedClipProps).to.be.undefined;
    });

    it("getter allocates on first call", () => {
      const details = new TestDetails(clipProps);
      expect(details.storedClip).to.be.undefined;
      expect(details.storedClipProps).not.to.be.undefined;

      expect(details.clipVector).not.to.be.undefined;
      expect(details.storedClip).not.to.be.undefined;
    });
  });
});
