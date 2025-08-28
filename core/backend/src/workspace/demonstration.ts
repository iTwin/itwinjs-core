import { constructSettingsSchemas } from "../internal/workspace/SettingsSchemasImpl";
import { SettingGroupSchema, SettingsSchemas } from "./SettingsSchemas";

// FormatSet interface structure (mirrors @itwin/core-ecschema-metadata FormatSet)
// This demonstrates the structure of the actual FormatSet interface that we're validating against


// Define the schema for your product settings API response
const productSettingsSchema: SettingGroupSchema = {
  schemaPrefix: "productSettings",
  description: "Product settings validation from external API",

  settingDefs: {
    "formatSets": {
      type: "object",
      properties: {
        // Organization-specific format sets
        organization: {
          type: "object",
          additionalProperties: { "$ref": "#/typeDefs/formatSet" }
        },
        // Default format sets
        defaults: {
          type: "object",
          additionalProperties: { "$ref": "#/typeDefs/formatSet" }
        }
      }
    },

    "userPreferences": {
      // fictional, could be anything.
      type: "object",
      properties: {
        theme: { type: "string", enum: ["light", "dark", "auto"] },
        language: { type: "string", pattern: "^[a-z]{2}-[A-Z]{2}$" },
        notifications: { type: "boolean" }
      }
    }
  },

  typeDefs: {
    "formatSet": {
      type: "object",
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
            properties: {
              type: { type: "string" },
              precision: { type: "number", minimum: 0 },
              // Add more format properties as needed
              minWidth: { type: "number", minimum: 1 },
              showSignOption: { type: "string", enum: ["noSign", "onlyNegative", "signAlways", "negativeParentheses"] },
              decimalSeparator: { type: "string" },
              thousandSeparator: { type: "string" },
              uomSeparator: { type: "string" }
            },
            required: ["type"]
          }
        }
      },
      required: ["name", "label", "unitSystem", "formats"]
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

  // Sample FormatSet data that matches the actual FormatSet interface
  const sampleFormatSets = {
    organization: {
      "engineering": {
        name: "engineering",
        label: "Engineering Format Set",
        unitSystem: "metric" as const,
        formats: {
          length: {
            type: "decimal",
            precision: 3,
            minWidth: 1,
            showSignOption: "onlyNegative",
            decimalSeparator: ".",
            thousandSeparator: ",",
            uomSeparator: " "
          },
          area: {
            type: "decimal",
            precision: 2,
            minWidth: 1,
            showSignOption: "onlyNegative"
          }
        }
      },
      "surveying": {
        name: "surveying",
        label: "Surveying Format Set",
        unitSystem: "usSurvey" as const,
        formats: {
          length: {
            type: "fractional",
            precision: 4,
            minWidth: 1
          }
        }
      }
    },
    defaults: {
      "standard": {
        name: "standard",
        label: "Standard Format Set",
        unitSystem: "imperial" as const,
        formats: {
          length: {
            type: "decimal",
            precision: 2
          }
        }
      }
    }
  };

  try {
    // Validate the FormatSet data against the schema
    const validatedData = await client.validateData<typeof sampleFormatSets>(
      sampleFormatSets,
      "productSettings/formatSets"
    );

    // If we get here, the data is valid according to our FormatSet schema
    // In a real application, you could now safely use this data
    const _engineeringFormats = validatedData.organization.engineering;
    // Use the validated FormatSet data...

  } catch (error) {
    // Handle validation errors - data doesn't match FormatSet interface requirements
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`FormatSet validation failed: ${errorMessage}`);
  }
}