
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { WmtsCapabilities } from "../../../internal/tile/map/WmtsCapabilities";
import { fakeTextFetch } from "./MapLayerTestUtilities";

const SMALL_DEGREES_DIFFERENCE = 1.0e-8;
const SMALL_DECIMAL_DIFFERENCE = 1.0e-6;

describe("WmtsCapabilities1", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should parse USGS WMTS capabilities", async () => {
    const response = await fetch(`/assets/wmts_capabilities/USGSHydroCached_capabilities.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const capabilities = await WmtsCapabilities.create("https://fake/url");

    expect(capabilities?.version).toEqual("1.0.0");

    // Test GetCapabilities operation metadata
    expect(capabilities?.operationsMetadata?.getCapabilities).toBeDefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.name).toEqual("GetCapabilities");
    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp).toBeUndefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp).toBeDefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp?.length).toEqual(2);
    if (capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].encoding).toEqual("RESTful");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].url).toEqual("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS/1.0.0/WMTSCapabilities.xml");

      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].encoding).toEqual("KVP");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[1].url).toEqual("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS?");
    }

    // Test GetTile operation metadata
    expect(capabilities?.operationsMetadata?.getTile).toBeDefined();
    expect(capabilities?.operationsMetadata?.getTile?.name).toEqual("GetTile");

    expect(capabilities?.operationsMetadata?.getTile?.postDcpHttp).toBeUndefined();
    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp?.length).toEqual(2);
    if (capabilities?.operationsMetadata?.getTile?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].encoding).toEqual("RESTful");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].url).toEqual("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS/tile/1.0.0/");

      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].encoding).toEqual("KVP");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[1].url).toEqual("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/WMTS?");
    }

    // Check that no GetFeatureInfo has been configured
    expect(capabilities?.operationsMetadata?.getFeatureInfo).toBeUndefined();

    //
    // Content
    //
    expect(capabilities?.contents).toBeDefined();
    expect(capabilities?.contents?.layers.length).toEqual(1);

    // Identifier
    expect(capabilities?.contents?.layers[0].identifier).toEqual("USGSHydroCached");

    // Format
    expect(capabilities?.contents?.layers[0].format).toEqual("image/jpgpng");

    // BoundingBox
    expect(capabilities?.contents?.layers[0].boundingBox).toBeDefined();
    expect(capabilities?.contents?.layers[0].boundingBox?.crs).toEqual("urn:ogc:def:crs:EPSG::3857");
    expect(capabilities?.contents?.layers[0].boundingBox?.range).toBeDefined();
    expect(capabilities?.contents?.layers[0].boundingBox?.range?.low.isAlmostEqualXY(-2.003750785759102e7, -3.024245526192411e7));
    expect(capabilities?.contents?.layers[0].boundingBox?.range?.low.isAlmostEqualXY(2.003872561259901e7, 3.0240971955423884e7));

    // WSG84 BoundingBox
    expect(capabilities?.contents?.layers[0].wsg84BoundingBox).toBeDefined();

    expect(capabilities?.contents?.layers[0].wsg84BoundingBox?.west).toBeDefined();
    if (capabilities?.contents?.layers[0].wsg84BoundingBox?.west) {
      const area = capabilities.contents.layers[0].wsg84BoundingBox.globalLocationArea;

      expect(Math.abs(area.southwest.longitudeDegrees - -179.99999550841463)).toBeLessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.southwest.latitudeDegrees - -88.99999992161116)).toBeLessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.northeast.longitudeDegrees - 179.99999550841463)).toBeLessThan(SMALL_DEGREES_DIFFERENCE);
      expect(Math.abs(area.northeast.latitudeDegrees - 88.99999992161116)).toBeLessThan(SMALL_DEGREES_DIFFERENCE);
    }

    // Style
    expect(capabilities?.contents?.layers[0].styles).toBeDefined();
    expect(capabilities?.contents?.layers[0].styles.length).toEqual(1);
    expect(capabilities?.contents?.layers[0].styles[0].identifier).toEqual("default");
    expect(capabilities?.contents?.layers[0].styles[0].title).toEqual("Default Style");
    expect(capabilities?.contents?.layers[0].styles[0].isDefault).toEqual(true);

    // TileMatrixSetLinks
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks.length).toEqual(2);
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[0].tileMatrixSet).toEqual("default028mm");
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[1].tileMatrixSet).toEqual("GoogleMapsCompatible");

    // Validate TileMatrix set
    expect(capabilities?.contents?.tileMatrixSets.length).toEqual(2);
    expect(capabilities?.contents?.tileMatrixSets[0].identifier).toEqual("default028mm");
    expect(capabilities?.contents?.tileMatrixSets[0].title).toEqual("TileMatrix using 0.28mm");
    expect(capabilities?.contents?.tileMatrixSets[0].abstract).to.contains("dpi assumes 0.28mm");
    expect(capabilities?.contents?.tileMatrixSets[0].supportedCrs).to.contains("urn:ogc:def:crs:EPSG::3857");

    // Validate first tile matrix definition.
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix.length).toEqual(24);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].identifier).toEqual("0");

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].scaleDenominator).toBeDefined();
    if (capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].scaleDenominator)
      expect(Math.abs(capabilities.contents.tileMatrixSets[0].tileMatrix[0].scaleDenominator - 5.590822640285016e8)).to.lessThan(SMALL_DECIMAL_DIFFERENCE);

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner).toBeDefined();
    if (capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner)
      expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].topLeftCorner.isAlmostEqualXY(-2.0037508342787e7, 2.0037508342787e7)).toBe(true);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileWidth).toEqual(256);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileHeight).toEqual(256);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixWidth).toEqual(2);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixHeight).toEqual(2);

    expect(capabilities?.contents?.tileMatrixSets[1].wellKnownScaleSet).toContain("urn:ogc:def:wkss:OGC:1.0:GoogleMapsCompatible");
  });

  it("should parse sample OGC WMTS capabilities", async () => {
    const response = await fetch(`/assets/wmts_capabilities/OGCSample_capabilities.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const capabilities = await WmtsCapabilities.create("https://fake/url1");

    // Test ServiceIdentification metadata
    expect(capabilities?.serviceIdentification).toBeDefined();
    expect(capabilities?.serviceIdentification?.abstract).toContain("Example service that constrains");
    expect(capabilities?.serviceIdentification?.title).toEqual("World example Web Map Tile Service");
    expect(capabilities?.serviceIdentification?.serviceType).toEqual("OGC WMTS");
    expect(capabilities?.serviceIdentification?.serviceTypeVersion).toEqual("1.0.0");
    expect(capabilities?.serviceIdentification?.keywords?.length).toEqual(4);
    if (capabilities?.serviceIdentification?.keywords)
      expect(capabilities?.serviceIdentification?.keywords[0]).toEqual("World");
    expect(capabilities?.serviceIdentification?.fees).toEqual("none");
    expect(capabilities?.serviceIdentification?.accessConstraints).toEqual("none");

    // Test GetCapabilities operation metadata
    expect(capabilities?.operationsMetadata?.getCapabilities).toBeDefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.name).toEqual("GetCapabilities");

    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp).toBeDefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp?.length).toEqual(1);
    if (capabilities?.operationsMetadata?.getCapabilities?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].encoding).toEqual("KVP");
      expect(capabilities.operationsMetadata.getCapabilities.getDcpHttp[0].url).toEqual("http://www.maps.bob/maps.cgi?");
    }

    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp).toBeDefined();
    expect(capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp?.length).toEqual(1);
    if (capabilities?.operationsMetadata?.getCapabilities?.postDcpHttp) {
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].constraintName).toEqual("PostEncoding");
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].encoding).toEqual("SOAP");
      expect(capabilities.operationsMetadata.getCapabilities.postDcpHttp[0].url).toEqual("http://www.maps.bob/maps.cgi?");
    }

    // Test GetTile operation metadata
    expect(capabilities?.operationsMetadata?.getTile).toBeDefined();
    expect(capabilities?.operationsMetadata?.getTile?.name).toEqual("GetTile");

    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp).toBeDefined();
    expect(capabilities?.operationsMetadata?.getTile?.getDcpHttp?.length).toEqual(1);
    if (capabilities?.operationsMetadata?.getTile?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].encoding).toEqual("KVP");
      expect(capabilities.operationsMetadata.getTile.getDcpHttp[0].url).toEqual("http://www.maps.bob/maps.cgi?");
    }
    expect(capabilities?.operationsMetadata?.getTile?.postDcpHttp).to.undefined;

    // Test GetFeatureInfo operation metadata
    expect(capabilities?.operationsMetadata?.getFeatureInfo).toBeDefined();
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.name).toEqual("GetFeatureInfo");

    expect(capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp).toBeDefined();
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp?.length).toEqual(1);
    if (capabilities?.operationsMetadata?.getFeatureInfo?.getDcpHttp) {
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].constraintName).toEqual("GetEncoding");
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].encoding).toEqual("KVP");
      expect(capabilities.operationsMetadata.getFeatureInfo.getDcpHttp[0].url).toEqual("http://www.maps.bob/maps.cgi?");
    }
    expect(capabilities?.operationsMetadata?.getFeatureInfo?.postDcpHttp).toBeUndefined();

    // Content
    expect(capabilities?.version).toEqual("1.0.0");
    expect(capabilities?.contents).toBeDefined();

    // layer
    expect(capabilities?.contents?.layers.length).toEqual(2); // this sample capabilities has 2 layers
    expect(capabilities?.contents?.layers[0].identifier).toEqual("etopo2");

    // tileMatrixSetLinks
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks.length).toEqual(1);
    expect(capabilities?.contents?.layers[0].tileMatrixSetLinks[0].tileMatrixSet).toEqual("WholeWorld_CRS_84");
    expect(capabilities?.contents?.layers[1].identifier).toEqual("AdminBoundaries");
    expect(capabilities?.contents?.layers[1].tileMatrixSetLinks.length).toEqual(1);
    expect(capabilities?.contents?.layers[1].tileMatrixSetLinks[0].tileMatrixSet).toEqual("WholeWorld_CRS_84");

    // Validate first tile matrix definition.
    expect(capabilities?.contents?.tileMatrixSets.length).toEqual(1);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix.length).toEqual(7);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].identifier).toEqual("2g");

    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileWidth).toEqual(320);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].tileHeight).toEqual(200);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixWidth).toEqual(1);
    expect(capabilities?.contents?.tileMatrixSets[0].tileMatrix[0].matrixHeight).toEqual(1);
  });

  it("should parse Great artesian basin sample", async () => {
    const response = await fetch(`/assets/wmts_capabilities/great-artesian-basin.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const capabilities = await WmtsCapabilities.create("https://fake/url2");

    //  Check the layer styles
    expect(capabilities?.contents?.layers).toBeDefined();
    expect(capabilities?.contents?.layers.length).toEqual(1); // this sample capabilities has 2 layers
    expect(capabilities?.contents?.layers[0].title).toEqual("Base of Hooray Sandstone and Equivalents");
    expect(capabilities?.contents?.layers[0].styles.length).toEqual(2);
    expect(capabilities?.contents?.layers[0].styles[0].identifier).toEqual("gab:gab_formation_elevation_equalised_histogram");
    expect(capabilities?.contents?.layers[0].styles[0].isDefault).toEqual(false);
    expect(capabilities?.contents?.layers[0].styles[1].identifier).toEqual("gab:gab_formation_elevation_min-max");
    expect(capabilities?.contents?.layers[0].styles[1].isDefault).toEqual(true);

    // tileMatrixSetLinks
    expect(capabilities?.contents?.tileMatrixSets.length).toEqual(6);
    const googleTms = capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();
    expect(googleTms?.length).toEqual(2);
  });

  it("should parse TileMatrixSetLimits from great-artesian-basin", () => {
    // Minimal WMTS capabilities XML with TileMatrixSetLimits to test parsing.
    // Based on the great-artesian-basin.xml fixture structure.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
  <Contents>
    <Layer>
      <ows:Title>TestLayer</ows:Title>
      <ows:Identifier>test-layer</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style>
      <Format>image/png</Format>
      <TileMatrixSetLink>
        <TileMatrixSet>EPSG:3857</TileMatrixSet>
        <TileMatrixSetLimits>
          <TileMatrixLimits>
            <TileMatrix>EPSG:3857:0</TileMatrix>
            <MinTileRow>0</MinTileRow>
            <MaxTileRow>0</MaxTileRow>
            <MinTileCol>0</MinTileCol>
            <MaxTileCol>0</MaxTileCol>
          </TileMatrixLimits>
          <TileMatrixLimits>
            <TileMatrix>EPSG:3857:5</TileMatrix>
            <MinTileRow>16</MinTileRow>
            <MaxTileRow>19</MaxTileRow>
            <MinTileCol>27</MinTileCol>
            <MaxTileCol>30</MaxTileCol>
          </TileMatrixLimits>
        </TileMatrixSetLimits>
      </TileMatrixSetLink>
    </Layer>
    <TileMatrixSet>
      <ows:Identifier>EPSG:3857</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::3857</ows:SupportedCRS>
      <TileMatrix><ows:Identifier>EPSG:3857:0</ows:Identifier><ScaleDenominator>559082264</ScaleDenominator><TopLeftCorner>-20037508 20037508</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>1</MatrixWidth><MatrixHeight>1</MatrixHeight></TileMatrix>
    </TileMatrixSet>
  </Contents>
</Capabilities>`;

    const capabilities = WmtsCapabilities.createFromXml(xml);
    expect(capabilities).toBeDefined();

    const layer = capabilities?.contents?.layers[0];
    expect(layer).toBeDefined();
    expect(layer!.identifier).toEqual("test-layer");

    const epsg3857Link = layer?.tileMatrixSetLinks.find((link) => link.tileMatrixSet === "EPSG:3857");
    expect(epsg3857Link).toBeDefined();

    // BUG: TileMatrixSetLimits are never parsed because inner getElementsByTagName uses
    // "TileMatrixSetLimits" (the container tag) instead of "TileMatrixLimits" (the child tag).
    // This test SHOULD pass once the parsing bug is fixed.
    expect(epsg3857Link!.tileMatrixSetLimits.length).toEqual(2);

    // Verify the first limit entry (level 0)
    const firstLimit = epsg3857Link!.tileMatrixSetLimits[0];
    expect(firstLimit.tileMatrix).toEqual("EPSG:3857:0");
    expect(firstLimit.limits).toBeDefined();
    expect(firstLimit.limits!.low.x).toEqual(0);  // MinTileCol
    expect(firstLimit.limits!.low.y).toEqual(0);  // MinTileRow
    expect(firstLimit.limits!.high.x).toEqual(0); // MaxTileCol
    expect(firstLimit.limits!.high.y).toEqual(0); // MaxTileRow

    // Verify level 5 limit entry
    const level5Limit = epsg3857Link!.tileMatrixSetLimits[1];
    expect(level5Limit.tileMatrix).toEqual("EPSG:3857:5");
    expect(level5Limit.limits).toBeDefined();
    expect(level5Limit.limits!.low.x).toEqual(27);  // MinTileCol
    expect(level5Limit.limits!.low.y).toEqual(16);  // MinTileRow
    expect(level5Limit.limits!.high.x).toEqual(30); // MaxTileCol
    expect(level5Limit.limits!.high.y).toEqual(19); // MaxTileRow
  });

  it("should parse Propeller Aero NDOT capabilities", () => {
    // Minimal XML representative of Propeller Aero WMTS: localized dataset,
    // no TileMatrixSetLimits, resource URL template, small WGS84 bounding box.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0.0">
  <ows:ServiceIdentification>
    <ows:Title>PropellerAero WMTS Service</ows:Title>
    <ows:ServiceType>OGC WMTS</ows:ServiceType>
    <ows:ServiceTypeVersion>1.0.0</ows:ServiceTypeVersion>
  </ows:ServiceIdentification>
  <Contents>
    <Layer>
      <ows:Title>Oct 30, 2025</ows:Title>
      <ows:Identifier>dsce0d0b33</ows:Identifier>
      <ows:WGS84BoundingBox crs="urn:ogc:def:crs:OGC:2:84">
        <ows:LowerCorner>-96.18430645001274 40.81005980948186</ows:LowerCorner>
        <ows:UpperCorner>-96.17298696901085 40.81541280531352</ows:UpperCorner>
      </ows:WGS84BoundingBox>
      <Style isDefault="true">
        <ows:Title>default</ows:Title>
        <ows:Identifier>default</ows:Identifier>
      </Style>
      <Format>image/png</Format>
      <TileMatrixSetLink>
        <TileMatrixSet>PropellerAeroTileMatrix</TileMatrixSet>
      </TileMatrixSetLink>
      <ResourceURL format="image/png" resourceType="tile" template="https://cdn.example.com/tiles/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.png"/>
    </Layer>
    <TileMatrixSet>
      <ows:Title>PropellerAeroTileMatrix</ows:Title>
      <ows:Identifier>PropellerAeroTileMatrix</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::3857</ows:SupportedCRS>
      <WellKnownScaleSet>urn:ogc:def:wkss:OGC:1.0:GoogleMapsCompatible</WellKnownScaleSet>
      <TileMatrix><ows:Identifier>0</ows:Identifier><ScaleDenominator>559082264.0287178</ScaleDenominator><TopLeftCorner>-20037508.3427892 20037508.3427892</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>1</MatrixWidth><MatrixHeight>1</MatrixHeight></TileMatrix>
      <TileMatrix><ows:Identifier>1</ows:Identifier><ScaleDenominator>279541132.0143589</ScaleDenominator><TopLeftCorner>-20037508.3427892 20037508.3427892</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>2</MatrixWidth><MatrixHeight>2</MatrixHeight></TileMatrix>
      <TileMatrix><ows:Identifier>20</ows:Identifier><ScaleDenominator>533.182395962446</ScaleDenominator><TopLeftCorner>-20037508.3427892 20037508.3427892</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>1048576</MatrixWidth><MatrixHeight>1048576</MatrixHeight></TileMatrix>
    </TileMatrixSet>
  </Contents>
</Capabilities>`;

    const capabilities = WmtsCapabilities.createFromXml(xml);
    expect(capabilities).toBeDefined();
    expect(capabilities?.version).toEqual("1.0.0");

    // Service identification
    expect(capabilities?.serviceIdentification?.title).toEqual("PropellerAero WMTS Service");
    expect(capabilities?.serviceIdentification?.serviceType).toEqual("OGC WMTS");

    // Layer
    expect(capabilities?.contents?.layers.length).toEqual(1);
    const layer = capabilities!.contents!.layers[0];
    expect(layer.identifier).toEqual("dsce0d0b33");

    // The layer covers a small area near Lincoln, NE
    expect(layer.wsg84BoundingBox).toBeDefined();
    expect(layer.wsg84BoundingBox!.west).toBeDefined();
    const area = layer.wsg84BoundingBox!.globalLocationArea;
    // Longitude ~ -96.18 to -96.17 (small site in Nebraska)
    expect(area.southwest.longitudeDegrees).toBeCloseTo(-96.184, 2);
    expect(area.northeast.longitudeDegrees).toBeCloseTo(-96.173, 2);
    expect(area.southwest.latitudeDegrees).toBeCloseTo(40.810, 2);
    expect(area.northeast.latitudeDegrees).toBeCloseTo(40.815, 2);

    // Tile matrix set
    expect(capabilities?.contents?.tileMatrixSets.length).toEqual(1);
    const tms = capabilities!.contents!.tileMatrixSets[0];
    expect(tms.identifier).toEqual("PropellerAeroTileMatrix");
    expect(tms.supportedCrs).toContain("EPSG::3857");
    expect(tms.wellKnownScaleSet).toContain("GoogleMapsCompatible");

    // Verify it's recognized as Google Maps compatible
    const googleTms = capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();
    expect(googleTms?.length).toEqual(1);
    expect(googleTms![0].identifier).toEqual("PropellerAeroTileMatrix");

    // No TileMatrixSetLimits — this Propeller endpoint doesn't publish them,
    // which is part of why sparse tile requests fail.
    const tmLink = layer.tileMatrixSetLinks[0];
    expect(tmLink.tileMatrixSet).toEqual("PropellerAeroTileMatrix");
    expect(tmLink.tileMatrixSetLimits.length).toEqual(0);

    // Resource URL should be present
    expect(layer.resourceUrls.length).toBeGreaterThan(0);
    const pngUrl = layer.resourceUrls.find((u) => u.format.includes("png"));
    expect(pngUrl).toBeDefined();
    expect(pngUrl!.template).toContain("{TileMatrix}");
    expect(pngUrl!.template).toContain("{TileCol}");
    expect(pngUrl!.template).toContain("{TileRow}");
  });



  it("should request proper URL", async () => {
    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const sampleUrl = "https://service.server.com/rest/WMTS";
    const searchParams = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const queryParams: {[key: string]: string} = {};
    searchParams.forEach((value: string, key: string) =>  queryParams[key] = value);
    await WmtsCapabilities.create(sampleUrl, undefined, true, queryParams);
    expect(fetchStub).toHaveBeenCalledOnce();
    const firstCall = fetchStub.mock.calls[0];
    expect(firstCall[0]).toEqual(`${sampleUrl}?request=GetCapabilities&service=WMTS&${searchParams.toString()}`);
  });

});


