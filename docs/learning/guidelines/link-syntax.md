# Link Syntax

## Linking to Reference docs (from anywhere):
* Link to package:                `[label]($package)`
*	Link to topic:                  `[label]($package:topic)`
*	Link to class:                  `[label]($package.class)`
*	Link to method:                 `[label]($package.class.method)`

## Linking to Overview/Learning to or from Overview/Learning:
*	In same file:                   `[label](#section)`
*	In same folder:                 `[label](./filename.md#section)`
*	Another folder:                 `[label](./relativePath/filename.md#section)`

## Linking to Overview/Learning from Reference:
*	To Learning:                    `[label]($docs/learning/path/filename.md#section)`  // Proposed: Not implemented yet.
*	To Overview:                    `[label]($docs/overview/path/filename.md#section)`  // Proposed: Not implemented yet.

## Linking to content outside of the site:
*	General web location:           `[label](URL)`

## Notes on #section:
*	#section is optional if a file is specified
*	All lowercase, use ‘-‘ instead of spaces, ex. `[ECSQL parameters](./ECSQL#ecsql-parameters)`.
