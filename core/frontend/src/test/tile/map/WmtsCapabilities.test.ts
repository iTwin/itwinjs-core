/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { WmtsCapabilities } from "../../../tile/map/WmtsCapabilities";

describe("WmtsCapabilities", () => {
  const SMALL_DEGREES_DIFFERENCE = 1.0e-8;
  const SMALL_DECIMAL_DIFFERENCE = 1.0e-6;

  it("should parse USGS WMTS capabilities", async () => {
    const capabilities = await WmtsCapabilities.create("assets/wmts_capabilities/USGSHydroCached_capabilities.xml");
    expect(capabilities?.version).to.equal("1.0.0");

    // Test GetCapabilities operation metadata
    expect(capabilities?.operationsMetadata?.getCapabilities).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.name).to.equals("GetCapabilities");
    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp).to.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp?.length).to.equals(2);
    if (capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].encoding).to.equals("RESTful");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].url).to.equals("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS/1.0.0/WMTSCapabilities.xml");

      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].encoding).to.equals("KVP");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].url).to.equals("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS?");
    }

    // Test GetTile operation metadata
    expect(capabilities?.operationsMetadata?.getTile).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getTile?.name).to.equals("GetTile");

    expect(capabilities?.operationsMetadata?.getTile?.postDcpHttp).to.undefined;
    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp?.length).to.equals(2);
    if (capabilities?.operationsMetadata?.getTile?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].encoding).to.equals("RESTful");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].url).to.equals("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS/tile/1.0.0/");

      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].encoding).to.equals("KVP");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].url).to.equals("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS?");
    }

    // Check that no GetFeatureInfo has been configured
    expect(capabilities?.operationsMetadata?.getFeatureInfo).to.undefined;

    //
    // Content
    //
    expect(capabilities?.contents).to.not.undefined;
    expect(capabilities?.contents?.layers.length).to.equal(1);

    // Identifier
    expect(capabilities?.contents?.layers[0].identifier).to.equal("USGSHydroCached");

    // Format
    expect(capabilities?.contents?.layers[0].format).to.equal("image/jpgpng");

    // BoundingBox
    expect(capabilities?.contents?.layers[0].boundingBox).to.not.undefined;
    expect(capabilities?.contents?.layers[0].boundingBox?.crs).to.equal("urn:ogc:def:crs:EPSG::3857");
    expect(capabilities?.contents?.layers[0].boundingBox?.range).to.not.undefined;
    expect(capabilities?.contents?.layers[0].boundingBox?.range?.low.isAlmostEqualXY(-2.003750785759102E7, -3.024245526192411E7));
    expect(capabilities?.contents?.layers[0].boundingBox?.range?.low.isAlmostEqualXY(2.003872561259901E7, 3.0240971955423884E7));

    // WSG84 BoundingBox
    expect(capabilities?.contents?.layers[0].wsg84BoundingBox).to.not.undefined;

    expect(capabilities?.contents?.layers[0].wsg84BoundingBox?.west).to.not.undefined;
    if (capabilities?.contents?.layers[0].wsg84BoundingBox?.west) {
      const area = capabilities.contents.layers[0].wsg84BoundingBox.globalLocationArea;

      expect(Math.abs(area.southwest.longitudeDegrees - (-179.99999550841463))).to.be.lessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.southwest.latitudeDegrees - (-88.99999992161116))).to.be.lessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.northeast.longitudeDegrees - (179.99999550841463))).to.be.lessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.northeast.latitudeDegrees - (88.99999992161116))).to.be.lessThan(SMALL_DEGREES_DIFFERENCE);
    }

    // Style
    expect(capabilities?.contents?.layers[0].styles).to.not.undefined;
    expect(capabilities?.contents?.layers[0].styles.length).to.equal(1);
    expect(capabilities?.contents?.layers[0].styles[0].identifier).to.equal("default");
    expect(capabilities?.contents?.layers[0].styles[0].title).to.equal("Default Style");
    expect(capabilities?.contents?.layers[0].styles[0].isDefault).to.equal(true);

    // TileMatrixSetLinks
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks.length).to.equal(2);
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[0].tileMatrixSet).to.equal("default028mm");
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[1].tileMatrixSet).to.equal("GoogleMapsCompatible");

    // Validate TileMatrix set
    expect(capabilities?.contents?.tileMatrixSets.length).to.equals(2);
    expect(capabilities?.contents?.tileMatrixSets[0].identifier).to.equal("default028mm");
    expect(capabilities?.contents?.tileMatrixSets[0].title).to.equal("TileMatrix using 0.28mm");
    expect(capabilities?.contents?.tileMatrixSets[0].abstract).to.contains("dpi assumes 0.28mm");
    expect(capabilities?.contents?.tileMatrixSets[0].supportedCrs).to.contains("urn:ogc:def:crs:EPSG::3857");

    // Validate first tile matrix definition.
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix.length).to.equals(24);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].identifier).to.equals("0");

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].scaleDenominator).to.not.undefined;
    if (capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].scaleDenominator)
      expect(Math.abs(capabilities.contents.tileMatrixSets[0].tileMatrix[0].scaleDenominator - (5.590822640285016E8))).to.lessThan(SMALL_DECIMAL_DIFFERENCE);

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner).to.not.undefined;
    if (capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner)
      expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner.isAlmostEqualXY(-2.0037508342787E7, 2.0037508342787E7)).to.true;
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileWidth).to.equals(256);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileHeight).to.equals(256);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixWidth).to.equals(2);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixHeight).to.equals(2);

    expect(capabilities?.contents?.tileMatrixSets[1].wellKnownScaleSet).to.contains("urn:ogc:def:wkss:OGC:1.0:GoogleMapsCompatible");
  });

  it("should parse sample OGC WMTS capabilities", async () => {
    const capabilities = await WmtsCapabilities.create("assets/wmts_capabilities/OGCSample_capabilities.xml");

    // Test ServiceIdentification metadata
    expect(capabilities?.serviceIdentification).to.not.undefined;
    expect(capabilities?.serviceIdentification?.abstract).to.includes("Example service that constrains");
    expect(capabilities?.serviceIdentification?.title).to.equals("World example Web Map Tile Service");
    expect(capabilities?.serviceIdentification?.serviceType).to.equals("OGC WMTS");
    expect(capabilities?.serviceIdentification?.serviceTypeVersion).to.equals("1.0.0");
    expect(capabilities?.serviceIdentification?.keywords?.length).to.equals(4);
    if (capabilities?.serviceIdentification?.keywords)
      expect(capabilities?.serviceIdentification?.keywords[0]).to.equals("World");
    expect(capabilities?.serviceIdentification?.fees).to.equals("none");
    expect(capabilities?.serviceIdentification?.accessConstraints).to.equals("none");

    // Test GetCapabilities operation metadata
    expect(capabilities?.operationsMetadata?.getCapabilities).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.name).to.equals("GetCapabilities");

    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp?.length).to.equals(1);
    if (capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].encoding).to.equals("KVP");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].url).to.equals("http://www.maps.bob/maps.cgi?");
    }

    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp?.length).to.equals(1);
    if (capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].constraintName).to.equals("PostEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].encoding).to.equals("SOAP");
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].url).to.equals("http://www.maps.bob/maps.cgi?");
    }

    // Test GetTile operation metadata
    expect(capabilities?.operationsMetadata?.getTile).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getTile?.name).to.equals("GetTile");

    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp?.length).to.equals(1);
    if (capabilities?.operationsMetadata?.getTile?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].encoding).to.equals("KVP");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].url).to.equals("http://www.maps.bob/maps.cgi?");
    }
    expect(capabilities?.operationsMetadata?.getTile?.postDcpHttp).to.undefined;

    // Test GetFeatureInfo operation metadata
    expect(capabilities?.operationsMetadata?.getFeatureInfo).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.name).to.equals("GetFeatureInfo");

    expect(capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp).to.not.undefined;
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp?.length).to.equals(1);
    if (capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].constraintName).to.equals("GetEncoding");
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].encoding).to.equals("KVP");
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].url).to.equals("http://www.maps.bob/maps.cgi?");
    }
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.postDcpHttp).to.undefined;

    // Content
    expect(capabilities?.version).to.equal("1.0.0");
    expect(capabilities?.contents).to.not.undefined;

    // layer
    expect(capabilities?.contents?.layers.length).to.equal(2);  // this sample capabilities has 2 layers
    expect(capabilities?.contents?.layers[0].identifier).to.equal("etopo2");

    // tileMatrixSetLinks
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks.length).to.equal(1);
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[0].tileMatrixSet).to.equal("WholeWorld_CRS_84");
    expect(capabilities?.contents?.layers[1].identifier).to.equal("AdminBoundaries");
    expect(capabilities?.contents?.layers[1].tileMatrixSetLinks.length).to.equal(1);
    expect(capabilities?.contents?.layers[1].tileMatrixSetLinks[0].tileMatrixSet).to.equal("WholeWorld_CRS_84");

    // Validate first tile matrix definition.
    expect(capabilities?.contents?.tileMatrixSets.length).to.equals(1);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix.length).to.equals(7);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].identifier).to.equals("2g");

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileWidth).to.equals(320);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileHeight).to.equals(200);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixWidth).to.equals(1);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixHeight).to.equals(1);
  });

  it("should parse Great artesian basin sample", async () => {
    const capabilities = await WmtsCapabilities.create("assets/wmts_capabilities/great-artesian-basin.xml");
    // I check only things that are different from other datasets

    //  Check the layer styles
    expect(capabilities?.contents?.layers).to.not.undefined;
    expect(capabilities?.contents?.layers.length).to.equal(1);  // this sample capabilities has 2 layers
    expect(capabilities?.contents?.layers[0].styles.length).to.equal(2);
    expect(capabilities?.contents?.layers[0].styles[0].identifier).to.equal("gab:gab_formation_elevation_equalised_histogram");
    expect(capabilities?.contents?.layers[0].styles[0].isDefault).to.equal(false);
    expect(capabilities?.contents?.layers[0].styles[1].identifier).to.equal("gab:gab_formation_elevation_min-max");
    expect(capabilities?.contents?.layers[0].styles[1].isDefault).to.equal(true);

    // tileMatrixSetLinks
    expect(capabilities?.contents?.tileMatrixSets.length).to.equal(6);
    const googleTms = capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();
    expect(googleTms?.length).to.equal(2);
  });
});
