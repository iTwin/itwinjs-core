/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:disable

import { expect } from "chai";
import { GcsWorkspaceIndex } from "../../GcsWorkspaceIndex";
import { GeographicCRS } from "@itwin/core-common";

describe("GcsWorkspace tests", () => {

  /* GCS Workspace index unit tests */
  it("Use a GCS extent to search workspace index", () => {

    const californiaGcrs = new GeographicCRS(
      {
        horizontalCRS: {
          id: "California2",
          description: "USES CUSTOM DATUM",
          source: "Test",
          deprecated: false,
          datumId: "NAD83",
          unit: "Meter",
          projection: {
            method: "LambertConformalConicTwoParallels",
            longitudeOfOrigin: -122,
            latitudeOfOrigin: 37.66666666667,
            standardParallel1: 39.833333333333336,
            standardParallel2: 38.333333333333334,
            falseEasting: 2000000.0,
            falseNorthing: 500000.0,
          },
          extent: {
            southWest: {
              latitude: 35,
              longitude: -125,
            },
            northEast: {
              latitude: 39.1,
              longitude: -120.45,
            },
          },
        },
        verticalCRS: {
          id: "GEOID",
        },
      });

    const EWRGCS = new GeographicCRS(
      {
        horizontalCRS: {
          id: "EPSG:27700",
          datumId: "EPSG:6277",
          unit: "Meter",
          extent: {
            southWest: {
              latitude: 49.96,
              longitude: -7.56,
            },
            northEast: {
              latitude: 60.84,
              longitude: 1.78,
            },
          },
        },
        verticalCRS: {
          id: "ELLIPSOID",
        },
      });

    const theIndex = GcsWorkspaceIndex.theDefaultIndex;

    if (californiaGcrs.horizontalCRS && californiaGcrs.horizontalCRS.extent) {
      const listOfWorkspaces = theIndex.getWorkspaceNames(californiaGcrs.horizontalCRS.extent);

      expect(listOfWorkspaces.length === 5).to.be.true;
      expect(listOfWorkspaces.indexOf("usa-nadcon") >= 0);
      expect(listOfWorkspaces.indexOf("usa-harn") >= 0);
      expect(listOfWorkspaces.indexOf("usa-nsrs2007") >= 0);
      expect(listOfWorkspaces.indexOf("usa-nsrs2011") >= 0);
      expect(listOfWorkspaces.indexOf("usa-vertcon") >= 0);
    }

    if (EWRGCS.horizontalCRS && EWRGCS.horizontalCRS.extent) {
      const listOfWorkspaces = theIndex.getWorkspaceNames(EWRGCS.horizontalCRS.extent);

      expect(listOfWorkspaces.length === 5).to.be.true;
      expect(listOfWorkspaces.indexOf("uk") >= 0);
      expect(listOfWorkspaces.indexOf("uk-networkrail") >= 0);
      expect(listOfWorkspaces.indexOf("ostn") >= 0);
      expect(listOfWorkspaces.indexOf("uk-hs2") >= 0);
      expect(listOfWorkspaces.indexOf("france") >= 0);
    }
  });
});
