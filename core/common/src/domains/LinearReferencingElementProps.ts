/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { ElementAspectProps, GeometricElement3dProps, RelatedElementProps } from "../ElementProps";

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

/** Properties of a [LinearlyLocatedAttribution]($backend)
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

/** Properties of a [ReferentElement]($backend)
 * @beta
 */
export interface ReferentElementProps extends GeometricElement3dProps, IReferentProps {
}

/** Properties of a [DistanceExpression]($backend)
 * @beta
 */
export interface DistanceExpressionProps {
  distanceAlongFromStart: number;
  lateralOffsetFromLinearElement?: number;
  verticalOffsetFromLinearElement?: number;
  distanceAlongFromReferent?: number;
}

/** Core properties of a [LinearlyReferencedAtLocationAspect]($backend)
 * @beta
 */
export interface LinearlyReferencedAtLocationProps {
  atPosition: DistanceExpressionProps;
  fromReferent?: RelatedElementProps;
}

/** Core properties of a [LinearlyReferencedFromToLocationAspect]($backend)
 * @beta
 */
export interface LinearlyReferencedFromToLocationProps {
  fromPosition: DistanceExpressionProps;
  fromPositionFromReferent?: RelatedElementProps;
  toPosition: DistanceExpressionProps;
  toPositionFromReferent?: RelatedElementProps;
}

/** Properties of a [LinearlyReferencedAtLocationAspect]($backend)
 * @beta
 */
export interface LinearlyReferencedAtLocationAspectProps extends LinearlyReferencedAtLocationProps, ElementAspectProps {
}

/** Properties of a [LinearlyReferencedFromToLocationAspect]($backend)
 * @beta
 */
export interface LinearlyReferencedFromToLocationAspectProps extends LinearlyReferencedFromToLocationProps, ElementAspectProps {
}
