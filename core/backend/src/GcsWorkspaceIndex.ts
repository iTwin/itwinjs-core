/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */
// cspell:ignore nadcon, harn, nsrs, vertcon, newzealand, ostn, networkrail

import { HorizontalCRSExtent, HorizontalCRSExtentProps } from "@itwin/core-common";

/** Represents an entry in the GCS Workspace Index.
 *  @beta
*/
export interface GcsWorkspaceIndexEntryProps {
  /* The extent in longitude/latitude in degrees for the index entry */
  extent: HorizontalCRSExtentProps;
  /* name of the workspace applicable in extent */
  workspaceName: string;
}

/** Represents an entry in the GCS Workspace Index.
 *  @beta
*/
export class GcsWorkspaceIndexEntry implements GcsWorkspaceIndexEntryProps {
  /* The extent in longitude/latitude in degrees for the index entry */
  public readonly extent: HorizontalCRSExtent;
  /* name of the workspace applicable in extent */
  public readonly workspaceName: string;

  public constructor(data?: GcsWorkspaceIndexEntryProps) {
    this.extent = new HorizontalCRSExtent();
    this.workspaceName = "";
    if (data) {
      this.extent = HorizontalCRSExtent.fromJSON(data.extent);
      this.workspaceName = data.workspaceName;
    }
  }

  /** Creates a workspace index entry from JSON representation.
  * @beta */
  public static fromJSON(data: GcsWorkspaceIndexEntryProps): GcsWorkspaceIndexEntry {
    return new GcsWorkspaceIndexEntry(data);
  }

  /** Creates a JSON from the Workspace Index entry definition
   * @beta */
  public toJSON(): GcsWorkspaceIndexEntryProps {
    return { extent: this.extent.toJSON(), workspaceName: this.workspaceName };
  }

  /** Indicates if the extent of the entry overlaps with extent provided
   * @beta */
  public overlaps(extent: HorizontalCRSExtent): boolean {
    return this.extent.overlaps(extent);
  }
}

/** Represents a GCS Workspace Index.
 *  @beta
 */
export interface GcsWorkspaceIndexProps {
  /* List of index entries */
  entries: GcsWorkspaceIndexEntryProps[];
}

/** Represents a GCS Workspace Index. The index contains entries relating a cartographic extent to a GCS workspace name
 *  @beta
 */
export class GcsWorkspaceIndex implements GcsWorkspaceIndexProps {
  /* List of index entries */
  public entries: GcsWorkspaceIndexEntry[];

  public constructor(data?: GcsWorkspaceIndexProps) {
    this.entries = [];
    if (data) {
      if (Array.isArray(data.entries)) {
        for (const item of data.entries)
          this.entries.push(GcsWorkspaceIndexEntry.fromJSON(item));
      }
    }
  }

  public static fromJSON(data: GcsWorkspaceIndexProps): GcsWorkspaceIndex {
    return new GcsWorkspaceIndex(data);
  }

  /** Creates a JSON from the WorkspaceIndex definition
  * @beta */
  public toJSON(): GcsWorkspaceIndexProps {
    const data: GcsWorkspaceIndexProps = { entries: [] };
    if (Array.isArray(this.entries)) {
      for (const item of this.entries)
        data.entries.push(item.toJSON());
    }
    return data;
  }

  /** Returns a list of workspace names overlapping given area
   * @beta */
  public getWorkspaceNames(extent: HorizontalCRSExtent): string[] {
    const listNames: string[] = [];
    for (const item of this.entries) {
      if (item.overlaps(extent) && (-1 === listNames.indexOf(item.workspaceName)))
        listNames.push(item.workspaceName);
    }
    return listNames;
  }

  public static theDefaultIndex = new GcsWorkspaceIndex({
    entries: [
      { extent: { southWest: { longitude: -127.0, latitude: 23.25 }, northEast: { longitude: -65.0, latitude: 44.75 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: -127.0, latitude: 23.25 }, northEast: { longitude: -65.0, latitude: 44.75 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: -127.0, latitude: 23.25 }, northEast: { longitude: -65.0, latitude: 44.75 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: -127.0, latitude: 23.25 }, northEast: { longitude: -65.0, latitude: 44.75 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: -127.0, latitude: 23.25 }, northEast: { longitude: -65.0, latitude: 44.75 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: -180.0, latitude: 51.0 }, northEast: { longitude: -140.0, latitude: 72.0 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: -180.0, latitude: 51.0 }, northEast: { longitude: -140.0, latitude: 72.0 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: -180.0, latitude: 51.0 }, northEast: { longitude: -140.0, latitude: 72.0 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: -180.0, latitude: 51.0 }, northEast: { longitude: -140.0, latitude: 72.0 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: -180.0, latitude: 51.0 }, northEast: { longitude: -140.0, latitude: 72.0 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: -68.0, latitude: 16.75 }, northEast: { longitude: -63.0, latitude: 19.0 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: -68.0, latitude: 16.75 }, northEast: { longitude: -63.0, latitude: 19.0 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: -68.0, latitude: 16.75 }, northEast: { longitude: -63.0, latitude: 19.0 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: -68.0, latitude: 16.75 }, northEast: { longitude: -63.0, latitude: 19.0 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: -68.0, latitude: 16.75 }, northEast: { longitude: -63.0, latitude: 19.0 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: -162.0, latitude: 17.0 }, northEast: { longitude: -153.0, latitude: 22.5 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: -162.0, latitude: 17.0 }, northEast: { longitude: -153.0, latitude: 22.5 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: -162.0, latitude: 17.0 }, northEast: { longitude: -153.0, latitude: 22.5 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: -162.0, latitude: 17.0 }, northEast: { longitude: -153.0, latitude: 22.5 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: -162.0, latitude: 17.0 }, northEast: { longitude: -153.0, latitude: 22.5 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: 144.3, latitude: 13.0 }, northEast: { longitude: 145.1, latitude: 13.75 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: 144.3, latitude: 13.0 }, northEast: { longitude: 145.1, latitude: 13.75 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: 144.3, latitude: 13.0 }, northEast: { longitude: 145.1, latitude: 13.75 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: 144.3, latitude: 13.0 }, northEast: { longitude: 145.1, latitude: 13.75 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: 144.3, latitude: 13.0 }, northEast: { longitude: 145.1, latitude: 13.75 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: -171.0, latitude: -14.5 }, northEast: { longitude: -169.0, latitude: -14.0 } }, workspaceName: "usa-nadcon" },
      { extent: { southWest: { longitude: -171.0, latitude: -14.5 }, northEast: { longitude: -169.0, latitude: -14.0 } }, workspaceName: "usa-harn" },
      { extent: { southWest: { longitude: -171.0, latitude: -14.5 }, northEast: { longitude: -169.0, latitude: -14.0 } }, workspaceName: "usa-nsrs2007" },
      { extent: { southWest: { longitude: -171.0, latitude: -14.5 }, northEast: { longitude: -169.0, latitude: -14.0 } }, workspaceName: "usa-nsrs2011" },
      { extent: { southWest: { longitude: -171.0, latitude: -14.5 }, northEast: { longitude: -169.0, latitude: -14.0 } }, workspaceName: "usa-vertcon" },
      { extent: { southWest: { longitude: 110.0, latitude: -46.6 }, northEast: { longitude: 156.0, latitude: -10.3 } }, workspaceName: "australia" },
      { extent: { southWest: { longitude: 110.0, latitude: -46.6 }, northEast: { longitude: 156.0, latitude: -10.3 } }, workspaceName: "australia-agd66" },
      { extent: { southWest: { longitude: 110.0, latitude: -46.6 }, northEast: { longitude: 156.0, latitude: -10.3 } }, workspaceName: "australia-agd84" },
      { extent: { southWest: { longitude: -75.0, latitude: -36.5 }, northEast: { longitude: -33.0, latitude: -5.5 } }, workspaceName: "brazil" },
      { extent: { southWest: { longitude: -5.5, latitude: 41.0 }, northEast: { longitude: 8.5, latitude: 51.15 } }, workspaceName: "france" },
      { extent: { southWest: { longitude: 5.5, latitude: 47.0 }, northEast: { longitude: 15.25, latitude: 55.0 } }, workspaceName: "germany" },
      { extent: { southWest: { longitude: 123.0, latitude: 23.5 }, northEast: { longitude: 147, latitude: 45.7 } }, workspaceName: "japan" },
      { extent: { southWest: { longitude: 164.0, latitude: -51.5 }, northEast: { longitude: 179.5, latitude: -34.0 } }, workspaceName: "newzealand" },
      { extent: { southWest: { longitude: -10.0, latitude: 36.5 }, northEast: { longitude: -6.0, latitude: 42.15 } }, workspaceName: "portugal" },
      { extent: { southWest: { longitude: 16.75, latitude: 18.25 }, northEast: { longitude: 22.75, latitude: 49.70 } }, workspaceName: "slovakia" },
      { extent: { southWest: { longitude: -9.75, latitude: 5.5 }, northEast: { longitude: 3.6, latitude: 44.0 } }, workspaceName: "spain" },
      { extent: { southWest: { longitude: 5.75, latitude: 45.6 }, northEast: { longitude: 10.6, latitude: 47.75 } }, workspaceName: "switzerland" },
      { extent: { southWest: { longitude: -6.6, latitude: 49.75 }, northEast: { longitude: 2.0, latitude: 61.0 } }, workspaceName: "ostn" },
      { extent: { southWest: { longitude: -6.6, latitude: 49.75 }, northEast: { longitude: 2.0, latitude: 61.0 } }, workspaceName: "uk" },
      { extent: { southWest: { longitude: -6.6, latitude: 49.75 }, northEast: { longitude: 2.0, latitude: 61.0 } }, workspaceName: "uk-networkrail" },
      { extent: { southWest: { longitude: -3.5, latitude: 50.5 }, northEast: { longitude: 1.0, latitude: 54.0 } }, workspaceName: "uk-hs2" },
      { extent: { southWest: { longitude: -73.5, latitude: 0.25 }, northEast: { longitude: -59.5, latitude: 12.3 } }, workspaceName: "venezuela" },
    ],
  });
}

