# Code Playgrounds
This page contains examples of how we can integrate a typescript playground
that uses the "geometry-core" module.

**Note**: The playground currently only supports the "geometry-core" module due
to it's independent nature. Other modules will still follow the same pattern
when added.

The playground uses the monaco-editor, the same editor used in Microsoft's
[vscode](https://code.visualstudio.com/).

Playgrounds use the same markdown as the code snippet backtick format \`\`\` with
term "playground" as the type indicator.

Multiple playgrounds may be present on a single page.
## Importing modules

Imports follow "package-name/Module" format:

``` ts
import * as geometry from "geometry-core/Geometry"
import {Angle} from "geometry-core/Geometry"
import * as graph from "geometry-core/topology/Graph"
```

The monaco-editor **must** have the imports in order for the editor to
understand exported objects.


## Examples

### Markdown Basic sample:
````
``` playground
import {Point3d, Vector3d} from "geometry-core/PointVector"
import {IModelJson} from "geometry-core/serialization/IModelJsonSchema"

function emit(...data: any[]) {
  const stringData = [];
  // Catch known types for special formatting.  Dispatch others unchanged.
  for (const d of data) {
    const imjs = IModelJson.Writer.toIModelJson(d);
    if (imjs !== undefined) {
      stringData.push(imjs);
    } else if (d.toJSON) {
      stringData.push(d.toJSON());
    } else {
      stringData.push(d);
    }
  }
  document.body.innerHTML += " " + stringData + "<br />";
}

const myPoint = Point3d.create(1, 2, 3);
const myVector = Vector3d.create(3, 1, 0);
emit(" Here is a point ", myPoint);
emit(" Here is a vector ", myVector);
emit(" Here is a point reached by moving 3 times the vector ",
myPoint.plusScaled(myVector, 3));
```
````
#### Output:
``` playground
import {Point3d, Vector3d} from "geometry-core/PointVector"
import {IModelJson} from "geometry-core/serialization/IModelJsonSchema"

function emit(...data: any[]) {
  const stringData = [];
  // Catch known types for special formatting.  Dispatch others unchanged.
  for (const d of data) {
    const imjs = IModelJson.Writer.toIModelJson(d);
    if (imjs !== undefined) {
      stringData.push(imjs);
    } else if (d.toJSON) {
      stringData.push(d.toJSON());
    } else {
      stringData.push(d);
    }
  }
  document.body.innerHTML += " " + stringData + "<br />";
}

const myPoint = Point3d.create(1, 2, 3);
const myVector = Vector3d.create(3, 1, 0);
emit(" Here is a point ", myPoint);
emit(" Here is a vector ", myVector);
emit(" Here is a point reached by moving 3 times the vector ",
myPoint.plusScaled(myVector, 3));
```

### Markdown Includes sample:

````
``` playground
// Spaces should not be included (necessary here to prevent expansion)
[[ include:Playground_Samples ]]
```
````

#### Playground_Samples:
```
import {Angle} from "geometry-core/Geometry"
document.body.innerHTML = " " + Angle.adjustDegrees0To360(-25);

```

#### Output (hard-coded in since this extract doesn't exist):
``` playground
import {Angle} from "geometry-core/Geometry"
document.body.innerHTML = " " + Angle.adjustDegrees0To360(-25);
```
