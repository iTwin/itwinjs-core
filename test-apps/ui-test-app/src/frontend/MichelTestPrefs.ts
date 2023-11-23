import { ITwinIdArg, MapLayerSource, PreferenceKeyArg, TokenArg, UserPreferencesAccess } from "@itwin/core-frontend";

export class MichelTestPrefs implements UserPreferencesAccess {

  public async get(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {

    return [
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyTransportationImprovementProject/MapServer",
        name: "PTIP",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/Philly_PoliticalDivisionsLODMinMax/MapServer",
        name: "Political",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      /*
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer",
        name: "MAGM -  Marjo PhillyCityLandmarks",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/Philly_PoliticalDivisions/FeatureServer",
        name: "Philly_PoliticalDivisions",
        formatId: "ArcGISFeature",
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
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/arcgis/rest/services/PhillyCityLandmarksSecure/FeatureServer",
        name: " AGF - PhillyCityLandmarksSecure",
        formatId: "ArcGISFeature",
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
        // url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/ArcGIS/rest/services/PhilyCityLandmarks/FeatureServer",
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/FeatureServer",
        name: "AGF - PhillyCityLandmarks",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyBuildingsStructures/FeatureServer",
        name: "AGF - PhillyBuildingsStructures",
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
        url: "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/arcgis/rest/services/NewYork3857/MapServer",
        name: "AGM - NewYork3857",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      MapLayerSource.fromJSON({
        url: "https://naou37251.bentley.com/MapRenderingEngine/continents.map",
        name: "naou37251 continents",
        formatId: "WMS",
        transparentBackground: true,
      }),

      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/NYHomicides/FeatureServer",
        name: "AGF -  NYHomicides",
        formatId: "ArcGISFeature",
        transparentBackground: true,
      }),

      MapLayerSource.fromJSON({
        url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/iTwinImageTest1/MapServer",
        name: "iTwinImageTest1",
        formatId: "ArcGIS",
        transparentBackground: true,
      }),
      */
    ];

  }

  public async delete(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {
  }

  public async save(_arg: PreferenceKeyArg & ITwinIdArg & TokenArg)  {
  }
}
