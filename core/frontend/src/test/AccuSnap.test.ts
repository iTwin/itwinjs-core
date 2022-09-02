/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { Point3d, XYZProps } from "@itwin/core-geometry";
import { GeometryClass, SnapRequestProps, SnapResponseProps } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { HitDetail, HitPriority, HitSource, SnapDetail } from "../HitDetail";
import { ScreenViewport } from "../Viewport";

interface HitDetailProps {
  hitPoint: XYZProps;
  viewport: ScreenViewport;
  testPoint?: XYZProps; // defaults to hitPoint
  iModel?: IModelConnection;
  sourceId?: Id64String;
  modelId?: Id64String;
  subCategoryId?: Id64String;
  isClassifier?: boolean;
  geometryClass?: GeometryClass;
}

function makeHitDetail(props: HitDetailProps): HitDetail {
  return new HitDetail(
    Point3d.fromJSON(props.testPoint ?? props.hitPoint),
    props.viewport,
    HitSource.AccuSnap,
    Point3d.fromJSON(props.hitPoint),
    props.sourceId ?? "0",
    HitPriority.Unknown,
    0,
    0,
    props.subCategoryId,
    props.geometryClass,
    props.modelId,
    props.iModel,
    undefined,
    props.isClassifier
  );
}

describe.only("AccuSnap", () => {
  describe("requestSnap", () => {
    function overrideRequestSnap(iModel: IModelConnection, impl: (props: SnapRequestProps) => SnapResponseProps): void {
      iModel.requestSnap = (props) => Promise.resolve(impl(props));
    }
  });
});
