# ecschema2ts

ecschema2ts is a command-line tool that takes an EC3.1/EC3.2 BIS ECSchema xml file and outputs a valid Typescript module that uses iTwin.js.

## Quick Overview

```sh
npm install -g @itwin/ecschema2ts

ecschema2ts -i C:\Path\To\Schema\Domain.ecschema.xml -o C:\Desired\Output\Path\
```

## Getting Started

### Installation

Install globally:

```sh
npm install -g @itwin/ecschema2ts
```

### Creating a Typescript module

To create a Typescript file from the an ECSchema, run:

```sh
ecschema2ts -i C:\Path\To\Schema\Domain.ecschema.xml -o C:\Desired\Output\Path\
```

## Updating to new version

Since the package is installed globally, updating has a different syntax than normal. To update the package globally, run:

```sh
npm update -g @itwin/ecschema2ts
```

## Known Issues

- The ordering of the Typescript classes may be out of order preventing compilation of the typescript file. A workaround is to reorder the classes by hand.

## Troubleshooting

- Are you have issues converting your ECSchema?
  - Check to make sure your ECSchema version is EC3.1
  - Check if the BIS ECSchema passes validation, [check ECSchema status](https://bentley.sharepoint.com/sites/BIS/Lists/Schema%20Development%20Status/AllItems.aspx?viewpath=%2Fsites%2FBIS%2FLists%2FSchema%20Development%20Status%2FAllItems.aspx).
