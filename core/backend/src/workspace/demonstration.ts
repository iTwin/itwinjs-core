import { FormatSet } from "@itwin/ecschema-metadata";
import { constructSettingsSchemas } from "../internal/workspace/SettingsSchemasImpl";
import { SettingGroupSchema, SettingsSchemas } from "./SettingsSchemas";

// Interface for fetch and validation arguments
interface FetchArgs<T> {
  url: string;
  settingName: string;
  transformFn?: (data: any) => T;
}

// The Format schema uses EXTERNAL REFERENCE to the official BIS schema definition:
// https://github.com/iTwin/bis-schemas/blob/main/System/json_schema/ec32/ecschema-item.schema.json#L397
//
// JSON Schema Features Demonstrated:
// - $id: Unique identifiers for schema components
// - $ref: References to reusable schema definitions
// - External references: Direct linking to external schema files (BIS Format schema)
// - Schema composition: Using allOf for extending schemas
// - Structured organization: Better maintainability and reusability
// - Standards compliance: Using official iTwin.js Format specification
//
// FormatSets Hierarchy (separate settingDefs for each level):
// - defaults: Base format sets available to all users (within an application? Supplied by Bentley for all apps?)
// - organization: Organization-specific format sets (override defaults)
// - project: Project-specific format sets (override organization)
// - iModel: iModel-specific format sets (override project)
// - user: User-customized format sets (highest priority)
//
// Each level has its own settingDef that references the formatSets typeDef
// This allows for separate API endpoints and validation for each level


// Define the schema for your product settings API response
const productSettingsSchema: SettingGroupSchema = {
  schemaPrefix: "productSettings",
  description: "Product settings validation from external API",
  version: "0.1.0", // There is no version property in SettingGroupSchema however. We may have to extend the schema.
  settingDefs: {
    // Default format sets - base level
    "defaults": {
      type: "object",
      allOf: [
        {
          "$ref": "#/typeDefs/formatSets"
        }
      ]
    },

    // Organization-specific format sets
    "organization": {
      type: "object",
      allOf: [
        {
          "$ref": "#/typeDefs/formatSets"
        }
      ]
    },

    // Project-specific format sets
    "project": {
      type: "object",
      allOf: [
        {
          "$ref": "#/typeDefs/formatSets"
        }
      ]
    },

    // iModel-specific format sets
    "iModel": {
      type: "object",
      allOf: [
        {
          "$ref": "#/typeDefs/formatSets"
        }
      ]
    },

    // User-specific format sets
    "user": {
      type: "object",
      allOf: [
        {
          "$ref": "#/typeDefs/formatSets"
        }
      ]
    }
  },

  typeDefs: {
    "formatSets": {
      type: "object",
      $id: "#formatSets",
      properties: {
        formatSets: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Array of format sets"
        }
      },
      required: ["formatSets"]
    },

    "formatSet": {
      type: "object",
      $id: "#formatSet",
      properties: {
        name: {
          type: "string",
          minLength: 1,
          description: "The unique name identifier for this format set"
        },
        label: {
          type: "string",
          description: "The display label for this format set"
        },
        unitSystem: {
          type: "string",
          enum: ["metric", "imperial", "usSurvey", "usCustomary"],
          description: "A UnitSystemKey that determines the unit system for this format set"
        },
        formats: {
          type: "object",
          description: "A mapping of kind of quantity identifiers to their corresponding format properties",
          additionalProperties: {
            type: "object",
            // Direct reference to the official BIS Format schema
            $ref: "https://raw.githubusercontent.com/iTwin/bis-schemas/master/System/json_schema/ec32/ecschema-item.schema.json#/definitions/Format"
          }
        }
      },
      required: ["name", "label", "unitSystem", "formats"]
    },

    "formatDefinition": {
      type: "object",
      $id: "#formatDefinition",
      title: "EC Format Definition",
      description: "Format definition, which extends from an externally referenced BIS schema",
      // Direct reference to official BIS Format schema instead of duplicating. Can be extended via allOf.
      allOf: [
        {
          $ref: "https://raw.githubusercontent.com/iTwin/bis-schemas/master/System/json_schema/ec32/ecschema-item.schema.json#/definitions/Format"
        }
      ]
    },

    "unitSystemKey": {
      type: "string",
      $id: "#unitSystemKey",
      enum: ["metric", "imperial", "usSurvey", "usCustomary"],
      description: "A UnitSystemKey that determines the unit system for this format set"
    }
  }
};

// FIX NAME
class APIValidationClient {
  // DO WE NEED THIS?
  private _initialized = false;
  private _settingSchemas!: SettingsSchemas;
  public async initialize() {
    if (!this._initialized) {
      // constructSettingsSchemas should not be part of internal. Or maybe we need a new implementation that's more generic
      // Current impl is very locally file-based. Could do something new.
      // Could make an Impl that centers around querying an external settings service?
      this._settingSchemas = constructSettingsSchemas();
      this._settingSchemas.addGroup(productSettingsSchema); // Need to dive deeper into how group is used during validation. ASK COPILOT
      this._initialized = true;
    }
  }

  public async validateAndFetch<T>(
    args: FetchArgs<T>
  ): Promise<T> {
    await this.initialize();

    try {
      // Fetch from external API
      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const rawData = await response.json();

      // Optional transformation before validation
      const dataToValidate = args.transformFn ? args.transformFn(rawData) : rawData;

      // Validate using registered schema
      // NOTE: MIGHT NEED MORE IMPLEMENTATION?
      const validatedData = this._settingSchemas.validateSetting(
        dataToValidate,
        args.settingName
      );

      return validatedData as T;

    } catch (error) {
      // Log validation errors for debugging
      throw error;
    }
  }

  public async validateData<T>(data: any, settingName: string): Promise<T> {
    await this.initialize();

    // Will throw error if data is incorrect to whatever we defined in the settingSchema.
    return this._settingSchemas.validateSetting(data, settingName) as T;
  }
}

// Demonstration function showing FormatSet validation with separate API calls
export async function demonstrateFormatSetValidation(): Promise<void> {
  const client = new APIValidationClient();

  try {
    // 1. Validate defaults from API
    const defaultsResponse = await client.validateAndFetch<{formatSets: any[]}>({
      url: "https://example.com/api/settings/defaults",
      settingName: "productSettings/defaults"
    });
    // Successfully validated defaults with formatSets

    // 2. Validate organization settings from API
    const organizationResponse = await client.validateAndFetch<{formatSets: any[]}>({
      url: "https://example.com/api/settings/organization/acme-corp",
      settingName: "productSettings/organization"
    });
    // Successfully validated organization with formatSets

    // 3. Validate user settings from API
    const userResponse = await client.validateAndFetch<{formatSets: any[]}>({
      url: "https://example.com/api/settings/user/john.doe",
      settingName: "productSettings/user"
    });
    // Successfully validated user with formatSets

    // 4. Validate iModel settings from API
    const iModelResponse = await client.validateAndFetch<{formatSets: any[]}>({
      url: "https://example.com/api/settings/imodel/site-survey-2024",
      settingName: "productSettings/iModel"
    });
    // Successfully validated iModel with formatSets

    // All validations passed - data is ready to use
    const _allResponses = [defaultsResponse, organizationResponse, userResponse, iModelResponse];

  } catch (error) {
    // Handle validation errors - data doesn't match FormatSet interface requirements
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`FormatSet validation failed: ${errorMessage}`);
  }
}

// Sample data demonstration function using local data
export async function demonstrateLocalFormatSetValidation(): Promise<void> {
  const client = new APIValidationClient();

  // Sample data for each level
  const defaultsData = {
    formatSets: [
      {
        name: "standard",
        label: "Standard Format Set from Design Review",
        unitSystem: "imperial" as const,
        formats: {
          length: {
            name: "AecUnits.LENGTH",
            label: "Length Format",
            type: "decimal",
            precision: 2,
            roundFactor: 0.01,
            formatTraits: "applyRounding,showUnitLabel"
          }
        }
      }
    ]
  };

  const organizationData = {
    formatSets: [
      {
        name: "CivilFormatSet",
        label: "Civil Department Format Set",
        description: "Format sets used by the Civil department",
        unitSystem: "metric" as const,
        formats: {
          length: {
            name: "AecUnits.LENGTH",
            label: "Length",
            type: "decimal",
            precision: 3,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "showUnitLabel,use1000Separator",
            decimalSeparator: ".",
            thousandSeparator: ",",
            uomSeparator: " "
          },
          area: {
            name: "AecUnits.AREA",
            label: "Area",
            type: "decimal",
            precision: 2,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "keepDecimalPoint,showUnitLabel"
          }
        }
      }
    ]
  };

  const userData = {
    formatSets: [
      {
        name: "my own set",
        label: "My own format set",
        unitSystem: "imperial" as const,
        formats: {
          length: {
            name: "AecUnits.LENGTH",
            label: "Length",
            type: "decimal",
            precision: 0,
            composite: {
              spacer: " ",
              includeZero: true,
              units: [
                { name: "ft", label: "feet" },
                { name: "in", label: "inches" }
              ]
            }
          }
        }
      }
    ]
  };

  const projectData = {
    formatSets: [
      {
        name: "HighwayProjectHI200F",
        label: "Format Set for Highway Project HI200F",
        unitSystem: "metric" as const,
        formats: {
          "AecUnits.LENGTH": {
            name: "AecUnits.LENGTH",
            label: "Length Format",
            type: "decimal",
            precision: 3,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "showUnitLabel,use1000Separator",
            decimalSeparator: ".",
            thousandSeparator: ",",
            uomSeparator: " "
          },
          "AecUnits.AREA": {
            name: "AecUnits.AREA",
            label: "Area Format",
            type: "decimal",
            precision: 1,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "keepDecimalPoint,showUnitLabel"
          },
          "AecUnits.VOLUME": {
            name: "AecUnits.VOLUME",
            label: "Volume Format",
            type: "decimal",
            precision: 2,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "showUnitLabel,use1000Separator"
          }
        }
      },
      {
        name: "HighwayProjectHI200FBridge",
        label: "Format Set for Highway Project HI200F, Bridge Portion",
        unitSystem: "metric" as const,
        formats: {
          "AecUnits.LENGTH": {
            name: "AecUnits.LENGTH",
            label: "Length",
            type: "decimal",
            precision: 1,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "showUnitLabel,keepDecimalPoint"
          },
          "AecUnits.FORCE": {
            name: "AecUnits.FORCE",
            label: "Force",
            type: "scientific",
            precision: 3,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "showUnitLabel",
            scientificType: "normalized"
          }
        }
      }
    ]
  };

  const iModelData = {
    formatSets: [
      {
        name: "surveying",
        label: "Surveying Format Set",
        unitSystem: "usSurvey" as const,
        formats: {
          length: {
            name: "AecUnits.LENGTH",
            label: "Surveying Length Format",
            type: "fractional",
            precision: 4,
            minWidth: 1,
            formatTraits: "fractionDash,showUnitLabel"
          },
          station: {
            name: "station",
            label: "Station Format",
            type: "station",
            precision: 2,
            stationOffsetSize: 100,
            stationSeparator: "+",
            formatTraits: "showUnitLabel"
          }
        }
      }
    ]
  };

  try {
    // The idea is to retrieve these defaultData, organizationData, user

    // Validate each level separately
    const _validatedDefaults = await client.validateData<FormatSet[]>(defaultsData, "productSettings/defaults");
    const _validatedOrganization = await client.validateData<FormatSet[]>(organizationData, "productSettings/organization");
    const _validatedProject = await client.validateData<FormatSet[]>(projectData, "productSettings/project");
    const _validatedUser = await client.validateData<FormatSet[]>(userData, "productSettings/user");
    const _validatedIModel = await client.validateData<FormatSet[]>(iModelData, "productSettings/iModel");

    // All local validations completed successfully

  } catch (error) {
    // Handle validation errors - data doesn't match FormatSet interface requirements
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Local FormatSet validation failed: ${errorMessage}`);
  }
}
