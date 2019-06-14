/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RelatedElement, DistanceExpressionProps, LinearlyReferencedAtLocationAspectProps, LinearlyReferencedFromToLocationAspectProps } from "@bentley/imodeljs-common";
import { Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ElementMultiAspect } from "../ElementAspect";
import { IModelDb } from "../IModelDb";

/** Core structure carrying linearly-referenced information.
 * @beta
 */
export class DistanceExpression implements DistanceExpressionProps {
  public distanceAlongFromStart: number;
  public lateralOffsetFromLinearElement?: number;
  public verticalOffsetFromLinearElement?: number;
  public distanceAlongFromReferent?: number;

  constructor(props: DistanceExpressionProps) {
    this.distanceAlongFromStart = JsonUtils.asDouble(props.distanceAlongFromStart);
    this.lateralOffsetFromLinearElement = JsonUtils.asDouble(props.lateralOffsetFromLinearElement);
    this.verticalOffsetFromLinearElement = JsonUtils.asDouble(props.verticalOffsetFromLinearElement);
    this.distanceAlongFromReferent = JsonUtils.asDouble(props.distanceAlongFromReferent);
  }

  public static fromJSON(json: DistanceExpressionProps): DistanceExpression { return new DistanceExpression(json); }
  public toJSON(): DistanceExpressionProps {
    return this;
  }
}

/** Base class for multi-aspects carrying linearly-referenced locations.
 * @beta
 */
export class LinearlyReferencedLocation extends ElementMultiAspect {
  /** @internal */
  public static get className(): string { return "LinearlyReferencedLocation"; }
}

/** Concrete multi-aspect class carrying 'at' linearly-referenced positions along a Linear-Element.
 * @beta
 */
export class LinearlyReferencedAtLocation extends LinearlyReferencedLocation implements LinearlyReferencedAtLocationAspectProps {
  /** @internal */
  public static get className(): string { return "LinearlyReferencedAtLocation"; }

  public element: RelatedElement;
  public atPosition: DistanceExpression;
  public fromReferent?: Id64String;

  constructor(props: LinearlyReferencedAtLocationAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.element = RelatedElement.fromJSON(props.element)!;
    this.atPosition = DistanceExpression.fromJSON(props.atPosition);
    this.fromReferent = props.fromReferent;
  }
}

/** Concrete multi-aspect class carrying 'from-to' linearly-referenced positions along a Linear-Element.
 * @beta
 */
export class LinearlyReferencedFromToLocation extends LinearlyReferencedLocation implements LinearlyReferencedFromToLocationAspectProps {
  /** @internal */
  public static get className(): string { return "LinearlyReferencedFromToLocation"; }

  public element: RelatedElement;
  public fromPosition: DistanceExpression;
  public fromPositionFromReferent?: Id64String;
  public toPosition: DistanceExpression;
  public toPositionFromReferent?: Id64String;

  constructor(props: LinearlyReferencedFromToLocationAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.element = RelatedElement.fromJSON(props.element)!;
    this.fromPosition = DistanceExpression.fromJSON(props.fromPosition);
    this.toPosition = DistanceExpression.fromJSON(props.toPosition);
    this.fromPositionFromReferent = props.fromPositionFromReferent;
    this.toPositionFromReferent = props.toPositionFromReferent;
  }
}
