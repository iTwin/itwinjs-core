/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { LineSegment3d, Matrix3d, Point3d, Transform, XYZ, XYZProps } from "@itwin/core-geometry";
import { GeometryClass, SnapRequestProps, SnapResponseProps } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { HitDetail, HitPriority, HitSource, SnapDetail, SnapMode } from "../HitDetail";
import { LocateResponse, SnapStatus } from "../ElementLocateManager";
import { ScreenViewport } from "../Viewport";
import { AccuSnap } from "../AccuSnap";
import { IModelApp } from "../IModelApp";
import { testBlankViewportAsync } from "./openBlankViewport";

interface HitDetailProps {
  hitPoint?: XYZProps; // defaults to [0, 0, 0]
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
      iModel.requestSnap = (props) => Promise.resolve(impl ? impl(props) : {
        status: SnapStatus.Success,
        hitPoint: props.testPoint,
        snapPoint: props.testPoint,
        normal: [0, 1, 0],
        curve: { lineSegment: [ [0, 0, 0], [1, 0, 0] ] },
      });
    }

    type SnapResponse = SnapStatus | SnapDetail;

    function assertSnapDetail(response: SnapResponse): SnapDetail {
      expect(response).instanceOf(SnapDetail);
      return response as SnapDetail;
    }

    interface SnapDetailProps {
      point: XYZProps;
      normal: XYZProps;
      curve: [XYZProps, XYZProps];
    }

    function expectPoint(actual: XYZ, expected: XYZProps): void {
      const expectedPt = Point3d.fromJSON(expected);
      expect(actual.x).to.equal(expectedPt.x);
      expect(actual.y).to.equal(expectedPt.y);
      expect(actual.z).to.equal(expectedPt.z);
    }

    function expectSnapDetail(response: SnapResponse, expected: SnapDetailProps): SnapDetail {
      expect(response).instanceOf(SnapDetail);
      const detail = response as SnapDetail;

      expectPoint(detail.snapPoint, expected.point);

      expect(detail.normal).not.to.be.undefined;
      expectPoint(detail.normal!, expected.normal);

      const segment = detail.primitive as LineSegment3d;
      expect(segment).instanceOf(LineSegment3d);
      expectPoint(segment.point0Ref, expected.curve[0]);
      expectPoint(segment.point1Ref, expected.curve[1]);

      expectPoint(detail.hitPoint, expected.point);

      return detail;
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

    it("produces expected result with no display transform", async () => {
      await testSnap(
        { sourceId: "0x123", modelId: "0x456", hitPoint: [ 1, 2, 3 ] },
        (response) => expectSnapDetail(response, { point: [ 1, 2, 3 ], normal: [ 0, 1, 0 ], curve: [[0, 0, 0], [1, 0, 0]] })
      );
    });

    it("applies elevation to elements in plan projection models", async () => {
      await testSnap(
        { sourceId: "0x123", modelId: "0x456", hitPoint: [1, 2, 3] },
        (response) => expectSnapDetail(response, { point: [1, 2, 7], normal: [0, 1, 0], curve: [[0, 0, 4], [1, 0, 4]] }),
        [],
        (vp) => vp.view.getModelElevation = () => 4
      );
    });

    class Transformer {
      public constructor(public readonly transform: Transform) { }

      public getModelDisplayTransform(): Transform {
        return this.transform.clone();
      }
    }

    it("applies model display transform to elements", async () => {
      await testSnap(
        { sourceId: "0x123", modelId: "0x456", hitPoint: [1, 2, 3] },
        (response) => expectSnapDetail(response, { point: [0, 2, 4], normal: [0, 1, 0], curve: [[-1, 0, 1], [0, 0, 1]] }),
        [],
        (vp) => vp.view.modelDisplayTransformProvider = new Transformer(Transform.createTranslationXYZ(-1, 0, 1))
      );

      await testSnap(
        { sourceId: "0x123", modelId: "0x456", hitPoint: [1, 2, 3] },
        (response) => expectSnapDetail(response, { point: [-1, -2, -3], normal: [0, -1, 0], curve: [[0, 0, 0], [-1, 0, 0]] }),
        [],
        (vp) => vp.view.modelDisplayTransformProvider = new Transformer(Transform.createRefs(undefined, Matrix3d.createUniformScale(-1)))
      );
    });

    it("applies schedule script transforms to elements", async () => {
      // both model and element timelines
      // normal and point
    });

    it("applies multiple transforms", async () => {
      // plan projection elevation, model display transform, schedule script transforms.
    });

    it("applies elevation and model display transform", async () => {
      await testSnap(
        { sourceId: "0x123", modelId: "0x456", hitPoint: [1, 2, 3] },
        (response) => expectSnapDetail(response, { point: [2, 1, 9], normal: [0, 1, 0], curve: [[1, -1, 6], [2, -1, 6]] }),
        [],
        (vp) => {
          vp.view.modelDisplayTransformProvider = new Transformer(Transform.createRefs(new Point3d(1, -1, 10), Matrix3d.createIdentity()));
          vp.view.getModelElevation = () => -4;
        }
      );
    });

    it("ignores model timeline transform", async () => {
    });
  });
});
