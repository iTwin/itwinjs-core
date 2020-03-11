# Extension publisher CLI

Copyright © Bentley Systems, Incorporated. All rights reserved.

Allows downloading, uploading and deleting iModel.js extensions from the Extension Service

## Usage

`node extension-cli <command> <options>`

- `command` must be one of the following:
  - `publish`
  - `get`
  - `delete`
- `options` _must_ include:
  - `--contextId` (`--cid`) - context Id
  - `--extensionName` (`--en`, `-n`) - extension name
  - `--extensionVersion` (`--ev`, `-v`) - extension version
- For `get` command, `options` must include `--savePath` (`--path`) - path to an empty directory for downloading the extension. If the directory doesn't exist, it will be created.
- For `publish` command, `options` must include `--filePath` (`--path`) - path to a zip archive containing extension files to be uploaded.

## Examples

| Action | Command |
|-|-|
| Publish a new extension to the Extension Service | `node extension-cli publish --contextId 00000000-0000-0000-0000-000000000000 --extensionName "Example extension" --extensionVersion "v1.0" --filePath /path/to/extension.zip` |
| Download an extension from the Extension Service | `node extension-cli get --cid 00000000-0000-0000-0000-000000000000 --en "Example extension" --ev "v1.0" --path /path/to/extension/directory` |
| Delete an extension from the Extension Service | `node extension-cli delete --cid 00000000-0000-0000-0000-000000000000 -n "Example extension" -v "v1.0"` |
