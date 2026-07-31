---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Ratio format spacer support](#ratio-format-spacer-support)

## @itwin/core-backend

### WorkspaceDb file resource APIs deprecated

The [WorkspaceDb.getFile]($backend), [EditableWorkspaceDb.addFile]($backend), [EditableWorkspaceDb.updateFile]($backend), and [EditableWorkspaceDb.removeFile]($backend) APIs are deprecated. Store binary resources with [EditableWorkspaceDb.addBlob]($backend), or text resources with [EditableWorkspaceDb.addString]($backend), so applications can read their contents directly from the [WorkspaceDb]($backend).

```ts
// Before
editableDb.addFile("equipment-data", localFileName);
const extractedFileName = workspaceDb.getFile("equipment-data");

// After
editableDb.addBlob("equipment-data", fs.readFileSync(localFileName));
const contents = workspaceDb.getBlob("equipment-data");
```

The deprecated methods remain functional so existing file resources can be read, replaced, migrated, or removed. If still using `addFile()`, new file extensions now reject characters that are invalid in cross-platform filenames, and existing resources with unsafe extension metadata use an extensionless generated cache filename.

## @itwin/core-quantity

### Ratio format spacer support

The `composite.spacer` property now controls padding around the `ratioSeparator` in ratio formats. When `spacer` is `" "` (the default), a ratio formats as `1 : 2`; when `spacer` is `""`, it formats as `1:2`. The parser ignores spacer and accepts both spaced and unspaced input regardless of the configured spacer.

Only `" "` and `""` are accepted as spacer values for ratio formats. Non-whitespace spacers (e.g., `"-"`) are rejected during format loading because they cannot round-trip through the parser.
