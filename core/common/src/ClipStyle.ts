/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** Wire format describing a [[ClipStyle]].
 * @see [[DisplayStyleSettingsProps.clipStyle]].
 * @beta
 */
export interface ClipStyleProps {
  /** If `true`, geometry will be produced at the clip planes in a 3d view.
   * - Solids will produce facets on the clip planes.
   * - Surfaces will produce line strings representing the edges of the surface at the clip planes.
   * - Line strings will produce points at their intersections with the clip planes.
   */
  produceCutGeometry?: boolean;
}

/** Describes symbology and behavior applied to a [ClipVector]($geometry-core) when applied to a [ViewState]($frontend) or [[ModelClipGroup]].
 * @see [[DisplayStyleSettings.clipStyle]].
 * @beta
 */
export class ClipStyle {
  /** If `true`, geometry will be produced at the clip planes.
   * - Solids will produce facets on the clip planes.
   * - Surfaces will produce line strings representing the edges of the surface at the clip planes.
   * - Line strings will produce points at their intersections with the clip planes.
   */
  public readonly produceCutGeometry: boolean;

  private static readonly _defaultClipStyle = new ClipStyle();
  private static readonly _cutClipStyle = new ClipStyle({ produceCutGeometry: true });

  private constructor(json?: ClipStyleProps) {
    this.produceCutGeometry = json?.produceCutGeometry ?? false;
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    // At present we have only one property - a boolean. In future we may add symbology for cut geometry.
    return true === props?.produceCutGeometry ? this._cutClipStyle : this._defaultClipStyle;
  }

  public toJSON(): ClipStyleProps {
    const props: ClipStyleProps = { };
    if (this.produceCutGeometry)
      props.produceCutGeometry = true;

    return props;
  }

  public equals(other: ClipStyle): boolean {
    return this === other || this.produceCutGeometry === other.produceCutGeometry;
  }

  public get matchesDefaults(): boolean {
    return !this.produceCutGeometry;
  }
}
