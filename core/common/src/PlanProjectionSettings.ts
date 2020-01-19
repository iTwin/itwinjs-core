/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** Describes how to draw a "plan projection" model. A plan projection model is a 3d model whose geometry
 * lies in the XY plane. Multiple such models can be combined in a single view as "layers".
 * @alpha
 */
export interface PlanProjectionSettingsProps {
  /** If defined, the absolute height in meters at which to display the model. */
  elevation?: number;
  /** If defined, specifies a uniform transparency applied to all of the geometry in the model, in the range 0.0 (fully opaque) to 1.0 (fully transparent). */
  transparency?: number;
  /** If defined and true, the model is displayed as an overlay in the view (without depth testing) so that it is always visible behind other geometry. */
  overlay?: boolean;
  /** If defined, specifies the order in which this model draws relative to other plan projection models that also define their own priority.
   * Each model with a defined priority is drawn in order from lowest to highest priority.
   * Geometry from higher-priority models draws on top of that from lower-priority models.
   * If the overlapping geometry is opaque, the underlying geometry is occluded; otherwise they are blended.
   */
  priority?: number;
}

/** An immutable description of how to draw a "plan projection" models.
 * @see [[PlanProjectionSettingsProps]].
 * @alpha
 */
export class PlanProjectionSettings {
  /** @see [[PlanProjectionSettingsProps.elevation]] */
  public readonly elevation?: number;
  /** @see [[PlanProjectionSettingsProps.transparency]] */
  public readonly transparency?: number;
  /** @see [[PlanProjectionSettingsProps.overlay]] */
  public readonly overlay: boolean;
  /** @see [[PlanProjectionSettingsProps.priority]] */
  public readonly priority?: number;

  public toJSON(): PlanProjectionSettingsProps {
    return {
      elevation: this.elevation,
      transparency: this.transparency,
      overlay: true === this.overlay ? true : undefined,
      priority: this.priority,
    };
  }

  public static fromJSON(props: PlanProjectionSettingsProps | undefined): PlanProjectionSettings | undefined {
    if (undefined === props)
      return undefined;

    if (undefined === props.elevation && undefined === props.transparency && undefined === props.overlay && undefined === props.priority)
      return undefined;

    return new PlanProjectionSettings(props);
  }

  public constructor(props: PlanProjectionSettingsProps) {
    this.elevation = props.elevation;
    this.priority = props.priority;
    this.overlay = true === props.overlay;

    let transparency = props.transparency;
    if (undefined !== transparency)
      transparency = Math.max(0, Math.min(1, transparency));

    this.transparency = transparency;
  }

  /** Create a copy of this PlanProjectionSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A PlanProjectionSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: PlanProjectionSettingsProps): PlanProjectionSettings {
    if (undefined === changedProps)
      return this;

    const props: PlanProjectionSettingsProps = this.toJSON();
    if (undefined !== changedProps.elevation)
      props.elevation = changedProps.elevation;

    if (undefined !== changedProps.transparency)
      props.transparency = changedProps.transparency;

    if (undefined !== changedProps.overlay)
      props.overlay = changedProps.overlay;

    if (undefined !== changedProps.priority)
      props.priority = changedProps.priority;

    return new PlanProjectionSettings(props);
  }
}
