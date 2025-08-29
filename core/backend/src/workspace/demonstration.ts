import { constructSettingsSchemas } from "../internal/workspace/SettingsSchemasImpl";
import { SettingGroupSchema, SettingsSchemas } from "./SettingsSchemas";

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
// FormatSets Hierarchy (arrays for multiple format sets at each level):
// - defaults: Base format sets available to all users
// - organization: Organization-specific format sets (override defaults)
// - project: Project-specific format sets (override organization)
// - iModel: iModel-specific format sets (override project)
// - user: User-customized format sets (highest priority)


// Define the schema for your product settings API response
const productSettingsSchema: SettingGroupSchema = {
  schemaPrefix: "productSettings",
  description: "Product settings validation from external API",
  version: "1.0.0", // Unfortunately, version doesn't exist in SettingGroupSchema interface.
  settingDefs: {
    "formatSets": {
      type: "object",
      properties: {
        // Default format sets - base level
        defaults: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Default format sets available to all users"
        },
        // Organization-specific format sets
        organization: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Format sets specific to the organization"
        },
        // Project-specific format sets
        project: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Format sets specific to the project"
        },
        // iModel-specific format sets
        iModel: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Format sets specific to the iModel"
        },
        // User-specific format sets
        user: {
          type: "array",
          items: {
            type: "object",
            "$ref": "#/typeDefs/formatSet"
          },
          description: "Format sets customized by individual users"
        }
      }
    },
  },

  typeDefs: {
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
      // Could make an Impl that centers around querying PSS..?
      this._settingSchemas = constructSettingsSchemas();
      this._settingSchemas.addGroup(productSettingsSchema); // Need to dive deeper into how group is used during validation. ASK COPILOT
      this._initialized = true;
    }
  }

  public async validateAndFetch<T>(
    url: string,
    settingName: string,
    transformFn?: (data: any) => T
  ): Promise<T> {
    await this.initialize();

    try {
      // Fetch from external API
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const rawData = await response.json();

      // Optional transformation before validation
      const dataToValidate = transformFn ? transformFn(rawData) : rawData;

      // Validate using registered schema
      const validatedData = this._settingSchemas.validateSetting(
        dataToValidate,
        settingName
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

// Demonstration function showing FormatSet validation
export async function demonstrateFormatSetValidation(): Promise<void> {
  const client = new APIValidationClient();

  // Sample FormatSet data that matches the new array structure
  const sampleFormatSets = {
    defaults: [
      {
        name: "standard",
        label: "Standard Format Set",
        unitSystem: "imperial" as const,
        formats: {
          length: {
            name: "length",
            label: "Length Format",
            type: "decimal",
            precision: 2,
            roundFactor: 0.01,
            formatTraits: "applyRounding,showUnitLabel"
          }
        }
      }
    ],
    organization: [
      {
        name: "engineering",
        label: "Engineering Format Set",
        unitSystem: "metric" as const,
        formats: {
          length: {
            name: "length",
            label: "Engineering Length Format",
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
            name: "area",
            label: "Engineering Area Format",
            type: "decimal",
            precision: 2,
            minWidth: 1,
            showSignOption: "onlyNegative",
            formatTraits: "keepDecimalPoint,showUnitLabel"
          },
          volume: {
            name: "volume",
            label: "Engineering Volume Format",
            type: "scientific",
            precision: 4,
            scientificType: "normalized",
            formatTraits: "showUnitLabel"
          }
        }
      }
    ],
    project: [
      {
        name: "projectSpecific",
        label: "Project Specific Format Set",
        unitSystem: "metric" as const,
        formats: {
          length: {
            name: "length",
            label: "Project Length Format",
            type: "decimal",
            precision: 4,
            formatTraits: "showUnitLabel"
          }
        }
      }
    ],
    iModel: [
      {
        name: "surveying",
        label: "Surveying Format Set",
        unitSystem: "usSurvey" as const,
        formats: {
          length: {
            name: "length",
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
    ],
    user: [
      {
        name: "userCustom",
        label: "User Custom Format Set",
        unitSystem: "imperial" as const,
        formats: {
          composite: {
            name: "composite",
            label: "Feet and Inches Composite Format",
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

  try {
    // Validate the FormatSet data against the schema
    const validatedData = await client.validateData<typeof sampleFormatSets>(
      sampleFormatSets,
      "productSettings/formatSets"
    );

    // If we get here, the data is valid according to our FormatSet schema
    // In a real application, you could now safely use this data
    const _organizationFormats = validatedData.organization[0]; // First organization format set
    const _userFormats = validatedData.user; // All user format sets
    // Use the validated FormatSet data...

  } catch (error) {
    // Handle validation errors - data doesn't match FormatSet interface requirements
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`FormatSet validation failed: ${errorMessage}`);
  }
}
