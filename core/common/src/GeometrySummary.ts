/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import {
  Id64Array,
} from "@bentley/bentleyjs-core";

/** Describes the level of detail with which to report each geometric primitive in a geometrysummary.
 * @alpha
 */
export enum GeometrySummaryVerbosity {
  /** Simply output the type of geometry. */
  Basic = 10,
  /** Output some details of the geometry. e.g., for a sphere, include the center and radius; for a line string, the number of points; etc. */
  Detailed = 20,
  /** Output extremely detailed information. e.g., for a line string, the coordinates of each point. This may produce an enormous amount of data for some primitives. */
  Full = 30,
}

/** Describes what information will be returned by a geometry summary.
 * @alpha
 */
export interface GeometrySummaryOptions {
  /** If true, include detailed description of each symbology change (e.g., output material Id, line/fill color, etc). */
  verboseSymbology?: boolean;
  /** If true, include placement information for geometric elements. */
  includePlacement?: boolean;
  /** The level of detail with which to summarize each geometric primitive. Default: Basic. */
  geometryVerbosity?: GeometrySummaryVerbosity;
  /** If defined, for each geometry part, output a list of all geometric elements that reference that part in their geometry streams.
   * WARNING: This requires an exhaustive search through every geometric element in the iModel and may be extremely slow.
   */
  includePartReferences?: "2d" | "3d";
}

/** Describes the elements for which to generate an array of geometry summaries and the options controlling the contents of each summary.
 * @alpha
 */
export interface GeometrySummaryRequestProps {
  /** The Ids of the elements whose geometry is to be summarized. Can include 2d or 3d geometric elements as well as geometry parts.
   * The response array will include an entry for each element Id.
   */
  elementIds: Id64Array;

  /** Options controlling the contents of each summary. */
  options?: GeometrySummaryOptions;
}
