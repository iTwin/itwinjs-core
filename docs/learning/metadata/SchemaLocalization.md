# Schema Localization

Schema localization provide translated labels and descriptions for schemas and their items. They are consumed by the `SchemaLocalization` API to display human-readable, locale-aware text in applications.

## File Naming Convention

Localization files follow this pattern:

```
{SchemaName}.{locale}.json
```

- **`{SchemaName}`** — exact schema name, case-sensitive (e.g., `BuildingPhysical`)
- **`{locale}`** — a BCP 47 language tag. Use a base language tag (`de`, `fr`, `es`) for broad coverage, or a region-specific tag (`es-CO`, `de-AT`) for regional overrides

**Examples:**

```
BuildingPhysical.de.json
BuildingPhysical.es.json
BuildingPhysical.es-CO.json
```

When a region-specific locale (e.g., `es-CO`) is requested and a matching file exists, it takes priority. Any keys missing from the region-specific file automatically fall back to the base locale file (e.g., `es`). If neither file exists for a given item, the original label or name defined in the schema is used.

## File Structure

Localization files are JSON documents with the following top-level fields:

| Field | Required | Description |
|---|---|---|
| `$schema` | **Yes** | Schema identifier for the localization format. |
| `name` | **Yes** | The schema name. Must match the schema actual name. |
| `version` | **Yes** | Schema version string (e.g., `"01.00.00"`). Only the major version is validated. |
| `locale` | **Yes** | The locale this file targets (e.g., `"de"`, `"es-CO"`). Must match the locale in the filename. |
| `label` | No | Localized display label for the schema itself. |
| `description` | No | Localized description for the schema itself. |
| `items` | No | Map of schema item names to their localized text (see [Items](#items)). |

### Items

The `items` object maps each schema item name (class, enumeration, unit, etc.) to a `LocalizedItemText` object:

| Field | Required | Description |
|---|---|---|
| `label` | No | Localized display label for the item. |
| `description` | No | Localized description for the item. |
| `members` | No | Map of member names to their localized text (see [Members](#members)). |

### Members

The `members` object inside an item maps member names (properties or enumerators) to a `LocalizedText` object:

| Field | Required | Description |
|---|---|---|
| `label` | No | Localized display label for the member. |
| `description` | No | Localized description for the member. |

## Content Guidelines

- **Only translate `label` and `description`.** Do not translate item names or member names — these are identifiers used in code and must remain as defined in the schema.
- **`label` and `description` are independently optional.** Provide only the fields that have meaningful translations. Missing fields fall back to the original schema value.
- **`label` should be a short, display-ready string** suitable for use in a UI (e.g., a dropdown option, a column header, or a tooltip title).
- **`description` should be a complete sentence** describing the element, ending with a period.
- **Do not duplicate the original English strings** unless the locale genuinely uses the same text.
- **Only include items that have at least one translated field.** Omitting an item entirely is equivalent to providing no translation for it.

## Version Validation

The `version` field allows the loader to validate that the localization file is compatible with the version of the schema being used. Only the **major version** is compared.

If the major version in the localization file does not match the schema's read version, the entire localization file is discarded and a console warning is emitted.

## Example

The following example localizes a `BuildingPhysical` schema into German (`de`) in the file `BuildingPhysical.de.json`:

```json
{
  "$schema": "ecschema-localization-v1",
  "name": "BuildingPhysical",
  "version": "01.00.00",
  "locale": "de",
  "label": "Physisches Gebäudeschema",
  "description": "Schema für physische Gebäudeelemente.",
  "items": {
    "Building": {
      "label": "Gebäude",
      "description": "Eine physische Gebäudestruktur.",
      "members": {
        "Height": {
          "label": "Höhe",
          "description": "Die Höhe des Gebäudes in Metern."
        },
        "Name": {
          "label": "Name"
        }
      }
    },
    "BuildingType": {
      "label": "Gebäudetyp",
      "description": "Arten von Gebäuden.",
      "members": {
        "Residential": {
          "label": "Wohngebäude",
          "description": "Ein Wohngebäude."
        },
        "Commercial": {
          "label": "Gewerbegebäude",
          "description": "Ein Gewerbegebäude."
        }
      }
    }
  }
}
```

And a region-specific override for Colombian Spanish (`es-CO`) in the file `BuildingPhysical.es-CO.json`:

```json
{
  "$schema": "ecschema-localization-v1",
  "name": "BuildingPhysical",
  "version": "01.00.00",
  "locale": "es-CO",
  "label": "Esquema de Construcciones",
  "items": {
    "Building": {
      "label": "Construcción",
      "description": "Una estructura física de construcción."
    }
  }
}
```
