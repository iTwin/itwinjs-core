# Data Transformation During Schema Import

When importing new or updated EC schemas into an iModel, you may need to transform existing data to match the new schema structure. iTwin.js provides a callback mechanism that allows applications to perform custom data transformations before and after schema imports.

## Introduction

Schema import callbacks enable you to:

- **Cache or snapshot data** before schema changes are applied
- **Transform existing data** after schema import to conform to new structures
- **Upgrade channel organization** to match schema evolution requirements
- **Ensure data consistency** during schema version upgrades

The callback system provides three key hooks:

1. **Pre-import Channel Upgrade Callback** (`channelUpgrade`): Executes before anything else. Use it to upgrade your channel structure to conform to the incoming schema import/upgrade.
1. **Pre-import callback** (`preSchemaImportCallback`): Executes before schema import to prepare for transformation. Choose your data transformation strategy here.
2. **Post-import callback** (`postSchemaImportCallback`): Executes after schema import while the schema lock is still held. Perform data transformations to match the new schema structure.

This mechanism is particularly important when schema evolution requires data migration, such as when channel organization changes or when element properties need to be computed based on pre-upgrade values.

## Data Transformation Strategies

Choose from three transformation strategies based on your needs:

### None

No data transformation is performed. Use this when:
- Schema changes are purely additive (new optional properties)
- No existing data needs modification
- You'll handle data migration separately, maybe after the import schema API.

```typescript
await iModel.importSchemaStrings([schemaXml], {
  schemaImportCallbacks: {
    preSchemaImportCallback: async (context) => ({
      transformStrategy: DataTransformationStrategy.None,
    }),
  },
});
```

### InMemory

Cache specific data in memory before import for use during transformation. Use this when:
- You need to reference a small, known set of elements
- Data can fit comfortably in memory
- Fast access to cached values is needed

**Requirements**: You must provide `cachedData` in the pre-import callback result.

```typescript
await iModel.importSchemaStrings([newSchemaXml], {
  schemaImportCallbacks: {
    preSchemaImportCallback: async (context) => {
      // Query and cache element IDs that need transformation
      const elementIds = context.iModel.queryEntityIds({
        from: "TestSchema:TestElement",
        where: `Model.Id=0x123`,
      });

      return {
        transformStrategy: DataTransformationStrategy.InMemory,
        cachedData: { elementIds: Array.from(elementIds) },
      };
    },
    postSchemaImportCallback: async (context) => {
      // Transform elements using cached IDs
      const { elementIds } = context.resources.cachedData!;

      for (const id of elementIds) {
        const element = context.iModel.elements.getElementProps(id);
        // Modify element properties to match new schema
        element.newProperty = computeValue(element.oldProperty);
        context.iModel.elements.updateElement(element);
      }
    },
  },
});
```

### Snapshot

Create a complete read-only snapshot of the iModel before import. Use this when:
- You need full query access to the pre-import state
- Data transformation requires complex queries or relationships
- Memory constraints prevent caching all needed data

**Note**: Creates a complete copy of the iModel file, which may be large and time-consuming.

```typescript
await iModel.importSchemaStrings([newSchemaXml], {
  schemaImportCallbacks: {
    preSchemaImportCallback: async (context) => ({
      transformStrategy: DataTransformationStrategy.Snapshot,
    }),
    postSchemaImportCallback: async (context) => {
      const snapshot = context.resources.snapshot!;

      // Query pre-import state from snapshot
      const reader = snapshot.createQueryReader(
        "SELECT ECInstanceId, OldProperty FROM MySchema:MyElement"
      );

      // Transform data in the main iModel
      for await (const row of reader) {
        const element = context.iModel.elements.getElementProps(row.id);
        element.newProperty = row.oldProperty;
        context.iModel.elements.updateElement(element);
      }

      // Snapshot is automatically cleaned up after callback completes
    },
  },
});
```

## Callback Context

Both callbacks receive a context object with useful information:

### PreImportContext

```typescript
interface PreImportContext<T = any> {
  /** The iModel being modified */
  iModel: IModelDb;

  /** Schemas about to be imported (file paths or XML strings) */
  schemaData: LocalFileName[] | string[];

  /** Optional user-provided data passed through all callbacks */
  data?: T;
}
```

### PostImportContext

```typescript
interface PostImportContext<T = any> {
  /** The iModel being modified */
  iModel: IModelDb;

  /** Resources available for transformation */
  resources: {
    transformStrategy: DataTransformationStrategy;
    snapshot?: SnapshotDb;      // Available if Snapshot strategy
    cachedData?: T;              // Available if InMemory strategy
  };

  /** Optional user-provided data passed through all callbacks */
  data?: T;
}
```

## Channel Upgrades

Channels may need reorganization when schema versions change. The `channelUpgrade` option allows you to upgrade channel structure before schema import:

```typescript
await iModel.importSchemaStrings([newSchemaXml], {
  data: { migrationData },
  channelUpgrade: {
    channelKey: "MyChannel",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    callback: async (context) => {
      // Reorganize channel structure
      // Example: Move elements to new models as per v1.1.0 requirements
      const elements = queryElements(context.iModel);

      for (const element of elements) {
        // Move to appropriate model for new channel structure
        element.model = getNewModelId(element.type);
        context.iModel.elements.updateElement(element);
      }

      // Update channel version
      updateChannelVersion(context.iModel, "1.1.0");
      context.iModel.saveChanges();
    },
  },
  schemaImportCallbacks: {
    // ... schema import callbacks can assume channel is upgraded
  },
});
```

### ChannelUpgradeContext

```typescript
interface ChannelUpgradeContext<T = any> {
  iModel: IModelDb;
  channelKey: string;
  fromVersion: string;
  toVersion: string;
  /** Optional data shared with schema callbacks */
  data?: T;
}
```

**Execution Order**: Channel upgrade → Pre-import callback → Schema import → Post-import callback

## Error Handling

### Pre-import Errors

If the pre-import callback throws, the schema import is aborted and any changes made so far are rolled back.

```typescript
try {
  await iModel.importSchemaStrings([newSchemaXml], {
    schemaImportCallbacks: {
      preSchemaImportCallback: async (context) => {
        if (!canProceed(context.iModel)) {
          throw new Error("Prerequisites not met");
        }
        return { transformStrategy: DataTransformationStrategy.None };
      },
    },
  });
} catch (error) {
  // Schema was NOT imported
  console.error("Schema import aborted:", error.message);
}
```

### Post-import Errors

If the post-import callback throws:
- **Schema import succeeds** (schemas are now in the iModel)
- **Data transformation changes are abandoned** (rolled back)
- **Snapshots are automatically cleaned up**

```typescript
try {
  await iModel.importSchemaStrings([newSchemaXml], {
    schemaImportCallbacks: {
      postSchemaImportCallback: async (context) => {
        // Make data changes
        transformElements(context.iModel);

        // If this throws, data changes are rolled back
        throw new Error("Transformation failed");
      },
    },
  });
} catch (error) {
  // Schema IS imported, but data changes are reverted
  console.error("Schema imported, but transformation failed:", error.message);
}
```
