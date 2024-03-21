import { ITwinIdArg, MapLayerSource, PreferenceKeyArg, TokenArg, UserPreferencesAccess } from "@itwin/core-frontend";

export class MichelTestPrefs implements UserPreferencesAccess {

  public async get(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {

    return [

      MapLayerSource.fromJSON({
        url: "https://mapservices.prorail.nl/arcgis/rest/services/Overwegen_002/FeatureServer",
        name: "Overwegen_002 F",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer",
        name: "MAGM -  Marjo PhillyCityLandmarks",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://tiles-eu1.arcgis.com/QwwahjSI9AyXrKi2/arcgis/rest/services/N4_Public_Consult_data/MapServer ",
        name: "AGM - N4_Public_Consult_data",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/arcgis/rest/services/PhillyCityLandmarksSecure/MapServer",
        name: " AGM - PhillyCityLandmarksSecure",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer",
        name: "AGM - Cadastral",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/ArcGIS/rest/services/PhilyCityLandmarks/MapServer",
        name: "AGM - PhillyCityLandmarks",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/ArcGIS/rest/services/PhilyCityLandmarks/FeatureServer",
        name: "AGF - PhillyCityLandmarks",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/ArcGIS/rest/services/PhillyTransportationImprovementProject/FeatureServer",
        name: "AGF - PhillyTransportationImprovementProject",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/ArcGIS/rest/services/PhillyRailLines/FeatureServer",
        name: "AGF - PhillyRailLines",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/arcgis/rest/services/NewYork3857/FeatureServer",
        name: "AGF - NewYork3857",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),

      MapLayerSource.fromJSON({
        url: "https://naou37251.bentley.com/MapRenderingEngine/continents.map",
        name: "naou37251 continents",
        formatId: "WMS",
        transparentBackground: true,
      }),

      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer",
        name: "Marjo bug",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
    ];

  }

  public async delete(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {
  }

  public async save(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {
  }
}
