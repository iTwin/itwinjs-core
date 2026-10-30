/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- verifies compatibility with deprecated construction APIs */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { EmptyLocalization, GeometryClass } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { HitDetail, HitDetailFeatureProps, HitDetailProps, HitPriority, HitSource, SnapDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelDisplayFeature } from "../IModelDisplayReference";
import { ScreenViewport } from "../Viewport";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";

describe("HitDetail", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  function makeProps(viewport: ScreenViewport): HitDetailProps {
    return {
      testPoint: new Point3d(1, 2, 3),
      viewport,
      hitSource: HitSource.Application,
      hitPoint: new Point3d(4, 5, 6),
      sourceId: "0x123",
      priority: HitPriority.PlanarSurface,
      distXY: 2,
      distFraction: 0.5,
    };
  }

  function expectLegacyHit(hit: HitDetail, props: HitDetailProps): void {
    expect(hit.testPoint).toBe(props.testPoint);
    expect(hit.viewport).toBe(props.viewport);
    expect(hit.hitSource).toBe(props.hitSource);
    expect(hit.hitPoint).toBe(props.hitPoint);
    expect(hit.sourceId).toBe(props.sourceId);
    expect(hit.priority).toBe(props.priority);
    expect(hit.distXY).toBe(props.distXY);
    expect(hit.distFraction).toBe(props.distFraction);
    expect(hit.subCategoryId).toBe(props.subCategoryId);
    expect(hit.geometryClass).toBe(props.geometryClass);
    expect(hit.modelId).toBe(props.modelId);
    expect(hit.iModel).toBe(props.viewport.iModel);
    expect(hit.isExternalIModelHit).toBe(false);
    expect(hit.feature).toEqual({
      elementId: props.sourceId,
      subCategoryId: props.subCategoryId ?? Id64.invalid,
      geometryClass: props.geometryClass ?? GeometryClass.Primary,
      modelId: props.modelId ?? Id64.invalid,
      iModelRef: props.viewport.view.iModelRefs.primary,
    });
  }

  it("accepts legacy props and preserves omitted properties in copies and snaps", () => {
    using viewport = openBlankViewport();
    const props = makeProps(viewport);
    const hit = new HitDetail(props);
    for (const copy of [hit, hit.clone(), new HitDetail(hit), new SnapDetail(hit), new SnapDetail(hit).clone()])
      expectLegacyHit(copy, props);

    expect(hit.clone().feature).not.toBe(hit.feature);
    expect(hit.path).toBeUndefined();
    expect(new HitDetail({ ...props, path: {} }).path).toBeUndefined();
  });

  it("preserves explicit legacy values, including invalid Ids and Primary geometry", () => {
    using viewport = openBlankViewport();
    for (const geometryClass of [GeometryClass.Primary, GeometryClass.Construction]) {
      for (const id of [Id64.invalid, "0x456"]) {
        const props = { ...makeProps(viewport), subCategoryId: id, modelId: id, geometryClass };
        const hit = new HitDetail(props);
        expectLegacyHit(hit, props);
        expectLegacyHit(hit.clone(), props);
      }
    }
  });

  it("uses feature values for defined legacy properties while preserving omission flags in copies", () => {
    using viewport = openBlankViewport();
    for (const omitted of [undefined, "subCategoryId", "geometryClass", "modelId"] as const) {
      const props = { ...makeProps(viewport), subCategoryId: "0x456", geometryClass: GeometryClass.Primary, modelId: "0x789" };
      const hit = new HitDetail(omitted ? { ...props, [omitted]: undefined } : props);
      hit.feature.subCategoryId = "0xa";
      hit.feature.geometryClass = GeometryClass.Construction;
      hit.feature.modelId = "0xb";

      for (const copy of [hit, hit.clone(), new HitDetail(hit), new SnapDetail(hit), new SnapDetail(hit).clone()]) {
        expect(copy.subCategoryId).toBe(omitted === "subCategoryId" ? undefined : "0xa");
        expect(copy.geometryClass).toBe(omitted === "geometryClass" ? undefined : GeometryClass.Construction);
        expect(copy.modelId).toBe(omitted === "modelId" ? undefined : "0xb");
      }
    }
  });

  it("restores the positional constructor, including optional arguments", () => {
    using viewport = openBlankViewport();
    const props = makeProps(viewport);
    const minimal = new HitDetail(props.testPoint, viewport, props.hitSource, props.hitPoint, props.sourceId, props.priority, props.distXY, props.distFraction);
    expectLegacyHit(minimal, props);

    const fullProps = { ...props, subCategoryId: "0x456", geometryClass: GeometryClass.Dimension, modelId: "0x789" };
    const full = new HitDetail(props.testPoint, viewport, props.hitSource, props.hitPoint, props.sourceId, props.priority, props.distXY, props.distFraction,
      fullProps.subCategoryId, fullProps.geometryClass, fullProps.modelId, undefined, "tile", true);
    expectLegacyHit(full, fullProps);
    expect(full.tileId).toBe("tile");
    expect(full.isClassifier).toBe(true);

    const otherIModel = createBlankConnection();
    try {
      const external = new HitDetail(props.testPoint, viewport, props.hitSource, props.hitPoint, props.sourceId, props.priority, props.distXY, props.distFraction,
        undefined, undefined, undefined, otherIModel);
      for (const copy of [external, external.clone(), new SnapDetail(external)]) {
        expect(copy.iModel).toBe(viewport.iModel);
        expect(copy.feature.iModelRef).toBe(viewport.view.iModelRefs.primary);
        expect(copy.isExternalIModelHit).toBe(false);
      }

      const refs = viewport.view.iModelRefs;
      expect(refs.isSpatial).toBe(true);
      if (!refs.isSpatial)
        throw new Error("Expected spatial iModel references");

      const linkedRef = refs.link({ iModel: otherIModel });
      const linkedHit = new HitDetail(props.testPoint, viewport, props.hitSource, props.hitPoint, props.sourceId, props.priority, props.distXY, props.distFraction,
        undefined, undefined, undefined, otherIModel);
      for (const copy of [linkedHit, linkedHit.clone(), new SnapDetail(linkedHit)]) {
        expect(copy.iModel).toBe(otherIModel);
        expect(copy.iModel).toBe(copy.feature.iModelRef.iModel);
        expect(copy.feature.iModelRef).toBe(linkedRef);
        expect(copy.isExternalIModelHit).toBe(true);
      }
      refs.unlink(linkedRef);
    } finally {
      otherIModel.closeSync();
    }
  });

  it("prefers an explicit feature and keeps its iModel reference when copied", () => {
    using viewport = openBlankViewport();
    using otherViewport = openBlankViewport();
    const feature: IModelDisplayFeature = {
      elementId: "0xa",
      modelId: "0xb",
      subCategoryId: "0xc",
      geometryClass: GeometryClass.Pattern,
      iModelRef: otherViewport.view.iModelRefs.primary,
    };
    const { sourceId: _sourceId, ...props } = makeProps(viewport);
    const featureProps: HitDetailFeatureProps = { ...props, feature };
    const hit = new HitDetail(featureProps);
    const mixedProps = { ...makeProps(viewport), subCategoryId: "0xd", modelId: "0xe", geometryClass: GeometryClass.Primary, feature };
    const mixed = new HitDetail(mixedProps);
    for (const copy of [hit, mixed, hit.clone(), new SnapDetail(hit)]) {
      expect(copy.feature).toEqual(feature);
      expect(copy.feature).not.toBe(feature);
      expect(copy.sourceId).toBe(feature.elementId);
      expect(copy.subCategoryId).toBe(feature.subCategoryId);
      expect(copy.geometryClass).toBe(feature.geometryClass);
      expect(copy.modelId).toBe(feature.modelId);
      expect(copy.iModel).toBe(otherViewport.iModel);
      expect(copy.isExternalIModelHit).toBe(true);
    }

    feature.elementId = "0xf";
    expect(hit.sourceId).toBe("0xa");
    hit.feature.elementId = "0x10";
    expect(hit.sourceId).toBe("0x10");
    hit.draw(undefined!);
    expect(viewport.flashedElement).toEqual({ id: "0x10", iModel: otherViewport.iModel });
  });

  it("rejects props without a feature or sourceId", () => {
    using viewport = openBlankViewport();
    const { sourceId: _sourceId, ...props } = makeProps(viewport);
    // @ts-expect-error Legacy props require sourceId.
    const legacyProps: HitDetailProps = props;
    // @ts-expect-error Feature-based props require feature.
    const featureProps: HitDetailFeatureProps = props;
    expect(legacyProps).toBe(featureProps);
    // @ts-expect-error The legacy interface does not expose a feature property.
    const legacyFeature: HitDetailProps["feature"] = undefined;
    // @ts-expect-error The feature interface does not expose legacy identity properties.
    const featureSourceId: HitDetailFeatureProps["sourceId"] = undefined;
    expect(legacyFeature).toBe(featureSourceId);
    // @ts-expect-error Neither construction overload accepts props without an identity.
    expect(() => new HitDetail(props)).toThrow("HitDetail requires a feature or sourceId");
  });
});
