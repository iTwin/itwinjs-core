/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ClipVector } from "@bentley/geometry-core";

/** Wire format describing a [[ClipStyle]].
 * @alpha
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
 * @alpha
 */
export class ClipStyle {
  /** If `true`, geometry will be produced at the clip planes.
   * - Solids will produce facets on the clip planes.
   * - Surfaces will produce line strings representing the edges of the surface at the clip planes.
   * - Line strings will produce points at their intersections with the clip planes.
   */
  public readonly produceCutGeometry: boolean;

  private constructor(json?: ClipStyleProps) {
    this.produceCutGeometry = json?.produceCutGeometry ?? false;
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    return new ClipStyle(props);
  }

  public toJSON(): ClipStyleProps {
    const props: ClipStyleProps = { };
    if (this.produceCutGeometry)
      props.produceCutGeometry = true;

    return props;
  }

  public get matchesDefaults(): boolean {
    return !this.produceCutGeometry;
  }
}

/** Describes a [ClipVector]($geometry-core) styled for display in a [Viewport]($frontend).
 * @alpha
 */
export interface StyledClipVector {
  readonly clip: ClipVector;
  readonly style: ClipStyle;
}
