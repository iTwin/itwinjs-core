/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BackgroundMapProps, BackgroundMapSettings, BackgroundMapType, GlobeMode } from "../BackgroundMapSettings";
import { MapLayerSettings } from "../MapLayerSettings";
import { TerrainHeightOriginMode } from "../TerrainSettings";

describe("BackgroundMapSettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (input: BackgroundMapProps | undefined, expected: BackgroundMapProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as BackgroundMapProps;

      const settings = BackgroundMapSettings.fromJSON(input);
      const output = settings.toJSON();

      expect(output.groundBias).to.equal(expected.groundBias);
      expect(output.providerName).to.equal(expected.providerName);
      expect(output.providerData?.mapType).to.equal(expected.providerData?.mapType);
      expect(output.transparency).to.equal(expected.transparency);
      expect(output.useDepthBuffer).to.equal(expected.useDepthBuffer);
      expect(output.applyTerrain).to.equal(expected.applyTerrain);
      expect(output.globeMode).to.equal(expected.globeMode);

      // We used to omit the terrain settings entirely if they matched the defaults. Now we always include them.
      const outTerrain = output.terrainSettings;
      expect(outTerrain).not.to.be.undefined;
      const expTerrain = expected.terrainSettings ?? {};

      if (outTerrain) {
        if (undefined === expTerrain.heightOriginMode) {
          // We used to omit the height origin mode if it matched the default. Then we changed the default, and stopped omitting it.
          expTerrain.heightOriginMode = TerrainHeightOriginMode.Geodetic;
        }

        expect(outTerrain.providerName).to.equal(expTerrain.providerName);
        expect(outTerrain.exaggeration).to.equal(expTerrain.exaggeration);
        expect(outTerrain.applyLighting).to.equal(expTerrain.applyLighting);
        expect(outTerrain.heightOrigin).to.equal(expTerrain.heightOrigin);
        expect(outTerrain.heightOriginMode).to.equal(expTerrain.heightOriginMode);
        expect(outTerrain.nonLocatable).to.equal(expTerrain.nonLocatable); // eslint-disable-line deprecation/deprecation
      }

      expect(settings.equalsJSON(expected)).to.be.true;

      const expectedSettings = BackgroundMapSettings.fromJSON(expected);
      expect(settings.equals(expectedSettings)).to.be.true;

      const mapLayer = MapLayerSettings.fromMapSettings(settings);
      const providerProps = BackgroundMapSettings.providerFromMapLayer(mapLayer.toJSON());
      const synchedFromProvider = settings.clone(providerProps);
      expect(settings.equals(synchedFromProvider)).to.be.true;
    };

    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ groundBias: 123 }, "input");

    roundTrip({ providerName: "BingProvider" }, {});
    roundTrip({ providerName: "MapBoxProvider" }, "input");
    roundTrip({ providerName: "UnknownProvider" }, {});

    roundTrip({ providerData: { mapType: BackgroundMapType.Hybrid } }, {});
    roundTrip({ providerData: { mapType: BackgroundMapType.Street } }, "input");
    roundTrip({ providerData: { mapType: BackgroundMapType.Aerial } }, "input");
    roundTrip({ providerData: { mapType: -123 } }, {});

    roundTrip({ transparency: false }, {});
    roundTrip({ transparency: 0 }, "input");
    roundTrip({ transparency: 1 }, "input");
    roundTrip({ transparency: 1.1 }, { transparency: 1 });
    roundTrip({ transparency: -0.1 }, { transparency: 0 });

    roundTrip({ useDepthBuffer: false }, {});
    roundTrip({ useDepthBuffer: true }, "input");

    roundTrip({ applyTerrain: false }, {});
    roundTrip({ applyTerrain: true }, "input");

    roundTrip({ globeMode: GlobeMode.Ellipsoid }, {});
    roundTrip({ globeMode: GlobeMode.Plane }, "input");
    roundTrip({ globeMode: 42 }, {});

    roundTrip({ terrainSettings: { providerName: "CesiumWorldTerrain" } }, {});
    roundTrip({ terrainSettings: { providerName: "UnknownProvider" } }, {});

    roundTrip({ terrainSettings: { exaggeration: 1 } }, {});
    roundTrip({ terrainSettings: { exaggeration: 99 } }, "input");
    roundTrip({ terrainSettings: { exaggeration: 101 } }, { terrainSettings: { exaggeration: 100 } });
    roundTrip({ terrainSettings: { exaggeration: 0.05 } }, { terrainSettings: { exaggeration: 0.1 } });
    roundTrip({ terrainSettings: { exaggeration: 0.15 } }, "input");

    roundTrip({ terrainSettings: { applyLighting: false } }, {});
    roundTrip({ terrainSettings: { applyLighting: true } }, "input");

    roundTrip({ terrainSettings: { heightOrigin: 0 } }, {});
    roundTrip({ terrainSettings: { heightOrigin: 42 } }, "input");

    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground } }, "input");
    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic } }, "input");
    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geoid } }, "input");
    roundTrip({ terrainSettings: { heightOriginMode: -99 } }, {});

    roundTrip({ terrainSettings: { nonLocatable: false } }, {}); // eslint-disable-line deprecation/deprecation
    roundTrip({ terrainSettings: { nonLocatable: true } }, "input"); // eslint-disable-line deprecation/deprecation

    roundTrip({
      providerName: "BingProvider",
      providerData: { mapType: BackgroundMapType.Hybrid },
      transparency: false,
      useDepthBuffer: false,
      applyTerrain: false,
      globeMode: GlobeMode.Ellipsoid,
      terrainSettings: {
        providerName: "CesiumWorldTerrain",
        applyLighting: false,
        exaggeration: 1,
        heightOrigin: 0,
        heightOriginMode: TerrainHeightOriginMode.Geodetic,
        nonLocatable: false, // eslint-disable-line deprecation/deprecation
      },
    }, {});
  });
});
