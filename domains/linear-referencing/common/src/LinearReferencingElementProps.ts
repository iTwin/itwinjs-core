/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module LinearReferencing
 */

import { ElementAspectProps, GeometricElement3dProps, RelatedElementProps } from "@itwin/core-common";

/** Properties of an ILinearElement
 * @beta
 */
export interface ILinearElementProps extends GeometricElement3dProps {
  startValue: number;
  lengthValue: number;
  source: RelatedElementProps;
}

/** Properties of an ILinearlyLocatedAttribution
 * @beta
 */
export interface ILinearlyLocatedAttributionProps {
  attributedElement?: RelatedElementProps;
}

/** Properties of a [LinearlyLocatedAttribution]($linear-referencing-backend)
 * @beta
 */
export interface LinearlyLocatedAttributionProps extends GeometricElement3dProps, ILinearlyLocatedAttributionProps {
}

/** Properties of an IReferent
 * @beta
 */
export interface IReferentProps {
  referencedElement?: RelatedElementProps;
}

/** Properties of a [ReferentElement]($linear-referencing-backend)
 * @beta
 */
export interface ReferentElementProps extends GeometricElement3dProps, IReferentProps {
}

/** Properties of a [DistanceExpression]($linear-referencing-backend)
 * @beta
 */
export interface DistanceExpressionProps {
  distanceAlongFromStart: number;
  lateralOffsetFromILinearElement?: number;
  verticalOffsetFromILinearElement?: number;
  distanceAlongFromReferent?: number;
}

/** Core properties of a [LinearlyReferencedAtLocation]($linear-referencing-backend)
 * @beta
 */
export interface LinearlyReferencedAtLocationProps {
  atPosition: DistanceExpressionProps;
  fromReferent?: RelatedElementProps;
}

/** Core properties of a [LinearlyReferencedFromToLocation]($linear-referencing-backend)
 * @beta
 */
export interface LinearlyReferencedFromToLocationProps {
  fromPosition: DistanceExpressionProps;
  fromPositionFromReferent?: RelatedElementProps;
  toPosition: DistanceExpressionProps;
  toPositionFromReferent?: RelatedElementProps;
}

/** Properties of a [LinearlyReferencedAtLocation]($linear-referencing-backend)
 * @beta
 */
export interface LinearlyReferencedAtLocationAspectProps extends LinearlyReferencedAtLocationProps, ElementAspectProps {
}

/** Properties of a [LinearlyReferencedFromToLocation]($linear-referencing-backend)
 * @beta
 */
export interface LinearlyReferencedFromToLocationAspectProps extends LinearlyReferencedFromToLocationProps, ElementAspectProps {
}
