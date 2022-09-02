/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { Point3d, XYZProps } from "@itwin/core-geometry";
import { GeometryClass, SnapRequestProps, SnapResponseProps } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { HitDetail, HitPriority, HitSource, SnapDetail, SnapMode } from "../HitDetail";
import { LocateResponse, SnapStatus } from "../ElementLocateManager";
import { ScreenViewport } from "../Viewport";
import { AccuSnap } from "../AccuSnap";
import { IModelApp } from "../IModelApp";
import { testBlankViewportAsync } from "./openBlankViewport";

interface HitDetailProps {
  hitPoint?: XYZProps;
  testPoint?: XYZProps; // defaults to hitPoint
  iModel?: IModelConnection;
  sourceId?: Id64String;
  modelId?: Id64String;
  subCategoryId?: Id64String;
  isClassifier?: boolean;
  geometryClass?: GeometryClass;
}

function makeHitDetail(vp: ScreenViewport, props?: HitDetailProps): HitDetail {
  const hitPoint = props?.hitPoint ?? [ 0, 0, 0 ];
  return new HitDetail(
    Point3d.fromJSON(props?.testPoint ?? hitPoint),
    vp,
    HitSource.AccuSnap,
    Point3d.fromJSON(hitPoint),
    props?.sourceId ?? "0",
    HitPriority.Unknown,
    0,
    0,
    props?.subCategoryId,
    props?.geometryClass,
    props?.modelId,
    props?.iModel,
    undefined,
    props?.isClassifier
  );
}

describe.only("AccuSnap", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  describe("requestSnap", () => {
    function overrideRequestSnap(iModel: IModelConnection, impl?: (props: SnapRequestProps) => SnapResponseProps): void {
      iModel.requestSnap = (props) => Promise.resolve(impl ? impl(props) : { status: SnapStatus.Success, hitPoint: props.testPoint });
    }

    type SnapResponse = SnapStatus | SnapDetail;

    function assertSnapDetail(response: SnapResponse): SnapDetail {
      expect(response).instanceOf(SnapDetail);
      return response as SnapDetail;
    }

    async function requestSnap(vp: ScreenViewport, hit: HitDetailProps, snapModes: SnapMode[] = []): Promise<SnapResponse> {
      const response = new LocateResponse();
      const detail = await AccuSnap.requestSnap(makeHitDetail(vp, hit), snapModes, 1, 1, undefined, response);
      if (detail) {
        expect(response.snapStatus).to.equal(SnapStatus.Success);
        return detail;
      } else {
        expect(response.snapStatus).not.to.equal(SnapStatus.Success);
        return response.snapStatus;
      }
    }

    async function testSnap(hit: HitDetailProps, verify: (response: SnapResponse) => void, snapModes: SnapMode[] = [], configureViewport?: (vp: ScreenViewport) => void): Promise<void> {
      await testBlankViewportAsync(async (vp) => {
        overrideRequestSnap(vp.iModel);
        if (configureViewport)
          configureViewport(vp);

        const response = await requestSnap(vp, hit, snapModes);
        verify(response);
      });
    }

    it("fails for intersection on map, model, or classifier", async () => {
      const modes = [SnapMode.Intersection];
      await testSnap({ sourceId: "0x123", modelId: "0x123" }, (response) => expect(response).to.equal(SnapStatus.NoSnapPossible), modes);
      await testSnap({ isClassifier: true }, (response) => expect(response).to.equal(SnapStatus.NoSnapPossible), modes);
      await testSnap(
        { sourceId: "0x123", modelId: "0x123" },
        (response) => expect(response).to.equal(SnapStatus.NoSnapPossible),
        modes,
        (vp) => vp.mapLayerFromHit = () => { return {} as any; }
      );
    });
  });
});
