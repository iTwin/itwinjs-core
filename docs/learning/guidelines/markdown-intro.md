---
ignoreMarkdownIssues: true
---
# Markdown Introduction

We have standardized on [markdown](http://commonmark.org/) files for programmer guide documentation.
The goal is to combine the programmer guide documentation (extracted from markdown source) with reference documentation (extracted from JavaDoc-style source code comments) to produce the final documentation set as a static HTML web site.

[There](http://assemble.io/docs/Cheatsheet-Markdown.html) are [tons](https://www.cheatography.com/simon-fermor/cheat-sheets/markdown/) of [cheatsheets](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) for markdown, and wide support for the format in source code editors (including VS Code).

>**Note**: If you are editing Markdown in VS Code, please install the [Markdown Lint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) and the [Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) extensions.

You may also find the [Markdown Preview Enhanced](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced) extension helpful.

Examples of the markdown syntax are below...

---

## Heading

### Sub-heading

#### Another deeper heading

Paragraphs are separated
by a blank line.

Text attributes: _italic_, *italic*, __bold__, **bold**, `monospace`, ~~strikethrough~~.

Use 3 hyphens for a horizontal rule:

---

## Bullet list

```md
- apples
- oranges
- pears
  - subList
  - subList
```

- apples
- oranges
- pears
  - subList
  - subList

---

## Numbered list

```md
  1. apples
     - subList
     - subList
  1. oranges
  1. pears
```

  1. apples
      - subList
      - subList
  2. oranges
  3. pears

---

## Notes

```md
> Note: this is an example note.
```

> Note: this is an example note.

---

## HTTP Links

```md
A [link](https://en.wikipedia.org/wiki/Markdown)
```

A [link](https://en.wikipedia.org/wiki/Markdown)

---

## Images

```md
An image: ![alternate text](logo.png "tooltip text")
```

An image: ![alternate text](logo.png "tooltip text")

---

## Source Code

Use backticks for inline source code: `public static myPublicStaticMethod(x: number): Promise<string>`

Use 3 backticks plus **ts** for source code blocks.

``` ts
/** My public static method */
public static myPublicStaticMethod(x: number): Promise<string> {
  if (0 === x)
    return Promise.reject(new Error("Invalid parameter"));

  // Rest of implementation removed...
}
```

## Tables

Tables are created by adding pipes as dividers between each cell, and by adding a line of dashes (also separated by bars) beneath the header. Note that the pipes do not need to be vertically aligned.

```md
Option|Description
---|---
data |path to data files that will be passed into templates.
engine |engine to be used for processing templates.
ext|extension to be used for destination files.
```

Option|Description
---|---
data |path to data files that will be passed into templates.
engine |engine to be used for processing templates.
ext|extension to be used for destination files.

## `leftnav.md` Files

A file in the root directory of every section of the website called `leftNav.md` creates the navigation pane on the left side of all web pages for that section.

## Ignoring a markdown file

There are cases when a markdown file should not end up in the final site. For example, a file that is under construction, a feature that has not been turned on, or a readme markdown file. In these cases a file can be ignored by adding an ignore tag to the frontmatter:

```markdown
---
ignore: true
---
```

The markdown will not be processed and will not be present in the final output.

## LaTex-like syntax

We have implemented a math typesetting library with a syntax similar to LaTex, called [KaTex](https://katex.org/). To insert an equation, add a source code snippet with the language `math` or equation.

```md
f(x) = \int_{-\infty}^\infty
    \hat f(\xi)\,e^{2 \pi i \xi x}
    \,d\xi
```

Results in

```equation
f(x) = \int_{-\infty}^\infty
    \hat f(\xi)\,e^{2 \pi i \xi x}
    \,d\xi
```

### KaTex options

KaTex options can be customized by editing the `katexOptions` entry in docs/config/docSites.json. For example, a KaTex macro can be defined in `macros`:

```json
  "\\rowXYZ": "{\\begin{bmatrix} #1 & #2 & #3\\end{bmatrix}}"
```

Then

```md
  \rowXYZ{x}{y}{z}
```

Results in

```math
  \rowXYZ{x}{y}{z}
```
