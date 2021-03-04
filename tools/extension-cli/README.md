# Extension publisher CLI

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

Allows downloading, uploading and deleting iTwin.js extensions from the Extension Service

## Usage

`node extension-cli <command> <options>`

- `command` must be one of the following:
  - `publish` - publishes an extension from local files.
  - `get` - downloads all extension files into a local directory.
  - `delete` - deletes an extension.
  - `view` - shows metadata about an extension, in JSON format.
- `options` described in section below.

## Command options

### `publish`

- `--extensionName` (`--en`, `-n`) - [Optional] extension name. If not provided, will attempt to read from `package.json` in current working directory.
- `--extensionVersion` (`--ev`, `-v`) - [Optional] extension version. If not provided, will attempt to read from `package.json` in current working directory.
- `--contextId` (`--cid`) - [Optional] context Id to publish to. Should be a Team Id for private extensions. If not provided, will publish to the logged in user's default Team.
- `--public` (`-p`) - [Optional] set this flag to ignore `contextId` and attempt to publish a public extension.
- `--filePath` (`--path`) - path to a directory containing extension files to be uploaded.

### `get`

- `--extensionName` (`--en`, `-n`) - extension name.
- `--extensionVersion` (`--ev`, `-v`) - extension version.
- `--contextId` (`--cid`) - [Optional] context Id to get the extension from. Should be a Project/Asset Id for private extensions. If not provided, will get a public extension.
- `--savePath` (`--path`) - path to an empty directory for downloading the extension. If the directory doesn't exist, it will be created.

### `delete`

- `--extensionName` (`--en`, `-n`) - extension name.
- `--extensionVersion` (`--ev`, `-v`) - extension version.
- `--contextId` (`--cid`) - [Optional] context Id to delete the extension from. Should be a Team Id for private extensions. If not provided, will use the logged in user's default Team.
- `--public` (`-p`) - [Optional] set this flag to ignore `contextId` and attempt to delete a public extension.
- `--force` - [Optional] add this flag to confirm the operation and avoid interactive prompts (should only be used in automated scripts).

### `view`

- `--extensionName` (`--en`, `-n`) - [Optional] extension name. If not provided, will show all extensions in the given context.
- `--extensionVersion` (`--ev`, `-v`) - [Optional] extension version. Should only be provided together with `extensionName`. If only `extensionName` is provided, will show all versions of the requested extension.
- `--contextId` (`--cid`) - [Optional] context Id. Should be a Project/Asset Id for private extensions. If not provided, will view public extensions.

## Examples

| Action | Command |
|-|-|
| Publish a new extension to the Extension Service | `node extension-cli publish --contextId 00000000-0000-0000-0000-000000000000 --extensionName "Example extension" --extensionVersion "v1.0" --path /path/to/extension` |
| Download an extension from the Extension Service | `node extension-cli get --cid 00000000-0000-0000-0000-000000000000 --en "Example extension" --ev "v1.0" --path /path/to/extension/directory` |
| Delete a public extension from the Extension Service | `node extension-cli delete -p -n "Example extension" -v "v1.0"` |
