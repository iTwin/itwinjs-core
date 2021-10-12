/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64Array } from "@itwin/core-bentley";

/** Describes the level of detail with which to report each geometric primitive in a [[GeometrySummaryRequestProps]].
 * @public
 */
export enum GeometrySummaryVerbosity {
  /** Simply output the type of geometry as a string. */
  Basic = 10,
  /** Output some details of the geometry. e.g., for a sphere, include the center and radius; for a line string, the number of points; etc. */
  Detailed = 20,
  /** Output extremely detailed information. e.g., for a line string, the coordinates of each point. This may produce an enormous amount of data for some primitives. */
  Full = 30,
}

/** Describes what information to include in a [[GeometrySummaryRequestProps]].
 * @public
 */
export interface GeometrySummaryOptions {
  /** If true, include detailed description of each symbology change (e.g., output material Id, line/fill color, etc). */
  verboseSymbology?: boolean;
  /** If true, include placement information for geometric elements. */
  includePlacement?: boolean;
  /** The level of detail with which to summarize each geometric primitive. Default: Basic. */
  geometryVerbosity?: GeometrySummaryVerbosity;
  /** If defined, for each geometry part, output a list of all geometric elements that reference that part in their geometry streams.
   * @note This requires an exhaustive search through every geometric element in the iModel and may be extremely slow.
   */
  includePartReferences?: "2d" | "3d";
}

/** Describes the elements for which to generate an array of geometry summaries and the options controlling the contents of each summary.
 * @see [IModelConnection.getGeometrySummary]($frontend).
 * @public
 */
export interface GeometrySummaryRequestProps {
  /** The Ids of the elements whose geometry is to be summarized. This can include the Ids of [GeometricElement]($backend)s and [GeometryPart]($backend)s.
   * The response will include an entry for each element Id.
   */
  elementIds: Id64Array;

  /** Options controlling the contents of the summary. */
  options?: GeometrySummaryOptions;
}
