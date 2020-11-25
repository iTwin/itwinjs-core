/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { WmtsCapabilities } from "../../../tile/map/WmtsCapabilities";

describe.only("WmtsCapabilities", () => {
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

    expect(capabilities?.layers.length).to.equal(1);
    expect(capabilities?.layers[0].identifier).to.equal("USGSHydroCached");
    expect(capabilities?.layers[0].format).to.equal("image/jpgpng");

  });

  it("should parse sample OGC WMTS capabilities", async () => {
    const capabilities = await WmtsCapabilities.create("assets/wmts_capabilities/OGCSample_capabilities.xml");

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


    expect(capabilities?.version).to.equal("1.0.0");
    expect(capabilities?.layers.length).to.equal(2);
    expect(capabilities?.layers[0].identifier).to.equal("etopo2");
    expect(capabilities?.layers[1].identifier).to.equal("AdminBoundaries");
  });
});
