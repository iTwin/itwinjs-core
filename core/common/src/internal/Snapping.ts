/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64ArraySchema, Id64StringSchema } from "@itwin/core-bentley";
import { Matrix4DPropsSchema, TransformPropsSchema, XYZPropsSchema } from "@itwin/core-geometry";
import { GeometryClassSchema } from "../GeometryParams";
import { ViewFlagPropsSchema } from "../ViewFlags";
import { Static, Type } from "@sinclair/typebox";
import { GeometryStreamPropsSchema } from "../geometry/GeometryStream";

/* eslint-disable @typescript-eslint/naming-convention */

const DecorationGeometryPropsSchema = Type.Object({
  id: Id64StringSchema,
  geometryStream: GeometryStreamPropsSchema,
}, { description: "Information required to request a *snap* to a pickable decoration from the front end to the back end." });
export type DecorationGeometryProps = Static<typeof DecorationGeometryPropsSchema>;

/**
 * Interface for snap request properties
 * @public
 */
export const SnapRequestPropsSchema = Type.Object({
  id: Id64StringSchema,
  testPoint: XYZPropsSchema,
  closePoint: XYZPropsSchema,
  worldToView: Matrix4DPropsSchema,
  viewFlags: Type.Optional(ViewFlagPropsSchema),
  snapModes: Type.Optional(Type.Array(Type.Number())),
  snapAperture: Type.Optional(Type.Number()),
  snapDivisor: Type.Optional(Type.Number()),
  subCategoryId: Type.Optional(Id64StringSchema),
  geometryClass: Type.Optional(GeometryClassSchema),
  intersectCandidates: Type.Optional(Id64ArraySchema),
  decorationGeometry: Type.Optional(Type.Array(DecorationGeometryPropsSchema)),
  /** A transform to be applied to the snap geometry.
   * testPoint, closePoint, and worldToView are in "world" coordinates (the coordinates of the viewport's iModel).
   * The snap geometry is in "model" coordinates (the coordinates of the iModel to which we're snapping).
   * In normal cases these are the same iModel. They may differ when people draw multiple iModels into the same viewport.
   */
  modelToWorld: Type.Optional(TransformPropsSchema),
}, { description: 'Interface for snap request properties' });
export type SnapRequestProps = Static<typeof SnapRequestPropsSchema>;

export const SnapResponsePropsSchema = Type.Object({
  status: Type.Number(),
  snapMode: Type.Optional(Type.Number()),
  heat: Type.Optional(Type.Number()),
  geomType: Type.Optional(Type.Number()),
  parentGeomType: Type.Optional(Type.Number()),
  hitPoint: Type.Optional(XYZPropsSchema),
  snapPoint: Type.Optional(XYZPropsSchema),
  normal: Type.Optional(XYZPropsSchema),
  curve: Type.Optional(Type.Any()),
  intersectCurve: Type.Optional(Type.Any()),
  intersectId: Type.Optional(Type.String()),
}, { description: "Information returned from the back end to the front end holding the result of a *snap* operation." });
export type SnapResponseProps = Static<typeof SnapResponsePropsSchema>;

