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
    /** Display tinted to hilite color */
    Hilite = 3,
    /** Display with the classifier color */
    ElementColor = 4,
  }

  /** Flag Properties
   * @beta
   */
  export interface FlagsProps {
    inside: SpatialClassificationProps.Display;
    outside: SpatialClassificationProps.Display;
    selected: SpatialClassificationProps.Display;
    type: number;         // Not currently implemented
  }

  /** Flags
   * @beta
   */
  export class Flags implements FlagsProps {
    public inside: Display = Display.ElementColor;
    public outside: Display = Display.Dimmed;
    public selected: Display = Display.Hilite;
    public type: number = 0;         // Not currently implemented

    public constructor(inside = Display.ElementColor, outside = Display.Dimmed) { this.inside = inside; this.outside = outside; }
  }
  /** Properties describe a single application of a classifier to a model.
   * @beta
   */
  export interface PropertiesProps {
    /** The classifier model Id. */
    modelId: Id64String;
    /** a distance to expand the classification around the basic geometry.  Curve geometry is expanded to regions, regions are expanded to volumes. */
    expand: number;
    flags: Flags;
    name: string;
    isActive: boolean;
  }

  /** Properties describe a single application of a classifier to a model.
   * @beta
   */
  export class Properties implements PropertiesProps {
    public modelId: Id64String;
    public expand: number;
    public flags: Flags;
    public name: string;
    public isActive: boolean;
    constructor(props: PropertiesProps) {
      this.name = props.name;
      this.modelId = props.modelId;
      this.expand = props.expand;
      this.flags = props.flags ? props.flags : new Flags();
      this.isActive = props.isActive;
    }
  }
}
