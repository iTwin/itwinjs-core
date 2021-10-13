/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** Wire format describing [[PlanProjectionSettings]].
 * @public
 */
export interface PlanProjectionSettingsProps {
  /** If defined, the absolute height in meters at which to display the model. */
  elevation?: number;
  /** If defined, specifies a uniform transparency applied to all of the geometry in the model, in the range 0.0 (fully opaque) to 1.0 (fully transparent). */
  transparency?: number;
  /** If defined and true, the model is displayed as an overlay in the view (without depth testing) so that it is always visible behind other geometry. */
  overlay?: boolean;
  /** If defined and true, subcategory display priority is used to specify the draw order of portions of the model. Geometry belonging to a subcategory with a higher priority
   * value is drawn on top of coincident geometry belonging to a subcategory with a lower priority value. The priorities can be modified at display time using
   * [FeatureSymbology.Overrides]($frontend). Note that subcategory "layers" cross model boundaries; that is, geometry belonging to the same subcategory in different models
   * are drawn as part of the same layer.
   */
  enforceDisplayPriority?: boolean;
}

/** Describes how to draw a plan projection model. A plan projection model is a [GeometricModel3d]($backend) whose geometry all lies in
 * a single XY plane, wherein the Z coordinate of the plane may be arbitrary or flexible. Multiple plan projection models can be combined into one view
 * and drawn as "layers" with relative priorities.
 * @see [[DisplayStyle3dSettings.setPlanProjectionSettings]] to define plan projection settings for a [DisplayStyle3dState]($frontend).
 * @see [GeometricModel3d.isPlanProjection]($backend).
 * @public
 */
export class PlanProjectionSettings {
  /** @see [[PlanProjectionSettingsProps.elevation]] */
  public readonly elevation?: number;
  /** @see [[PlanProjectionSettingsProps.transparency]] */
  public readonly transparency?: number;
  /** @see [[PlanProjectionSettingsProps.overlay]] */
  public readonly overlay: boolean;
  /** @see [[PlanProjectionSettingsProps.enforceDisplayPriority]] */
  public readonly enforceDisplayPriority?: boolean;

  public toJSON(): PlanProjectionSettingsProps {
    return {
      elevation: this.elevation,
      transparency: this.transparency,
      overlay: true === this.overlay ? true : undefined,
      enforceDisplayPriority: true === this.enforceDisplayPriority ? true : undefined,
    };
  }

  public static fromJSON(props: PlanProjectionSettingsProps | undefined): PlanProjectionSettings | undefined {
    if (undefined === props)
      return undefined;

    if (undefined === props.elevation && undefined === props.transparency && undefined === props.overlay && undefined === props.enforceDisplayPriority)
      return undefined;

    return new PlanProjectionSettings(props);
  }

  /** @internal */
  public constructor(props: PlanProjectionSettingsProps) {
    this.elevation = props.elevation;
    this.overlay = true === props.overlay;
    this.enforceDisplayPriority = true === props.enforceDisplayPriority;

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

    if (undefined !== changedProps.enforceDisplayPriority)
      props.enforceDisplayPriority = changedProps.enforceDisplayPriority;

    return new PlanProjectionSettings(props);
  }
}
