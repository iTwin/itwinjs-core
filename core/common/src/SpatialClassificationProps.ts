/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SpatialClassificationProps */
import { Id64String } from "@bentley/bentleyjs-core";

/** Geometry may be classified by its spatial location.  This is typically used to classify reality models.
 * A volume classifier classifies on all space within a closed mesh.  A planar classifier classifies within a
 * planar region swept perpendicular to its plane.
 * @beta
 */
export namespace SpatialClassificationProps {
  /** Classification Type
   * @beta
   */
  export enum Type { Planar = 0, Volume = 1 }

  /** Display modes
   * @beta
   */
  export enum Display {
    /** If off, geometry is omitted (invisible) */
    Off = 0,
    /** If on geometry is displayed without alteration */
    On = 1,
    /** Dimmed geometry is darkened. */
    Dimmed = 2,
    /** Display tinted to hilite color. Not applicable to unclassified geometry. */
    Hilite = 3,
    /** Display with the classifier color. Not applicable to unclassified geometry. */
    ElementColor = 4,
  }

  /** Flag Properties
   * @beta
   */
  export interface FlagsProps {
    inside: SpatialClassificationProps.Display;
    outside: SpatialClassificationProps.Display;
    type: number;         // Not currently implemented
  }

  /** Flags
   * @beta
   */
  export class Flags implements FlagsProps {
    public inside: Display = Display.ElementColor;
    public outside: Display = Display.Dimmed;
    public type: number = 0;         // Not currently implemented

    public constructor(inside = Display.ElementColor, outside = Display.Dimmed) { this.inside = inside; this.outside = outside; }
  }

  /** Describes a single classifier.
   * @beta
   */
  export interface Classifier {
    /** The Id of the classifier model. */
    modelId: Id64String;
    /** A distance in meters to expand the classification around the basic geometry. Curve geometry is expanded to regions; regions are expanded to volumes. */
    expand: number;
    /** Flags controlling how geometry is displayed based on containment within classification. */
    flags: FlagsProps;
    /** A user-friendly name for this classifier. */
    name: string;
  }

  /** Properties describe a single application of a classifier to a model.
   * @beta
   */
  export interface Properties extends Classifier {
    isActive: boolean;
  }

  /** Returns true if two FlagsProps are equivalent
   * @beta
   */
  export function equalFlags(lhs: FlagsProps, rhs: FlagsProps): boolean {
    if (lhs === rhs)
      return true;

    return lhs.inside === rhs.inside && lhs.outside === rhs.outside;
  }

  /** Returns true if two Classifiers are equivalent.
   * @beta
   */
  export function equalClassifiers(lhs: Classifier, rhs: Classifier): boolean {
    if (lhs === rhs)
      return true;

    return lhs.modelId === rhs.modelId && lhs.expand === rhs.expand && equalFlags(lhs.flags, rhs.flags) && lhs.name === rhs.name;
  }

  /** Returns true if two Properties are equivalent.
   * @beta
   */
  export function equalProperties(lhs: Properties, rhs: Properties): boolean {
    return equalClassifiers(lhs, rhs) && lhs.isActive === rhs.isActive;
  }
}
