# iModelJs Documentation Linking Syntax

The documentation for the iModelJs website is authored from two sources:

1. Markdown (`.md`) files in the `docs` directory
2. TypeDoc comments in source `.ts` files

Each type of file is processed (using BeMetalSmith scripts) to create `.html` files for the documentation website. It is often necessary to create links across the content of the website. These are the rules for the syntax, in the respective source files, to create those links.

## Linking to TypeDoc generated content

You can create links into the TypeDoc generated documentation using the same syntax, either from Markdown files or from other TypeDoc comments.

| Link to: | Syntax| Notes
|---------|----|--
| A package | `[label]($package)`| links to the documentation found in the index.ts file for *package*, marked with the `@docs-package-description` tag.
| A topic|`[label]($package:Topic)`| links to the documentation found in the index.ts file for *package*, marked with the `@docs-group-description Topic` tag.
| A class|`($package/Class)`| links to the documentation for *Class* in *package*
| A method|`($package/Class.method)`|links to the documentation for *Class.method* in *package*

> Note: It is possible to include a `[label]` prefix when linking to a Class or method, but that should rarely be necessary and is discouraged since it can be wrong and misleading.

## Linking Markdown -> Markdown

Standard markdown rules apply:

| Destination | Syntax | Notes
|---|---|--
| In same file |`[label](#section)`|
| In same folder|`[label](./filename.md#section)`| both `./` and `.md` are required
| Another folder|`[label](./relativePath/filename.md#section)`|`.md` is required

### Notes on #section

* #section is optional if a file is specified. If not present, the target is top of the markdown file.
* must be all lowercase. Use ‘-‘ instead of spaces.

For example, if the target is:

```md
(in ECSQL.md)

## ECSQL Parameters
```

The link from a markdown file in the same directory would be:

```md
[ECSQL Params](./ECSQL.md#ecsql-parameters)
```

## Linking TypeDoc -> Markdown

The same syntax as linking from Markdown applies, with the `$docs` prefix instead of a relative path.

For example:

```ts
/** in a TypeDoc comment
 * @see [label]($docs/learning/path/filename.md#section)
 * @see [label]($docs/overview/path/filename.md#section)
 */

```

## Linking to external Urls

Standard markdown applies: `[label](URL)`

## `leftNav.md` Files

A file in the root directory of every section of the website called `leftNav.md` creates the navigation pane on the left side of all web pages for that section.