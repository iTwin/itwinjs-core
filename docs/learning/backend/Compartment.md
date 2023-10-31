# Working With Compartments in iModels

A "compartment" is a tree of models and elements below a *Compartment Subject* element. The purpopse of putting elements and models in a compartment is to control which applications can change them. Compartment-based access control is *cooperative* in that applications indicate the compartments to which they pertain. Any attempt to modify data outside one of those compartments is denied with a compartment constraint exception at runtime.

To help visualize how compartments are used, imagine an iModel with the following breakdown:

RootSubject

- DictionaryModel
  - Elements ...
- Subject0
  - PhysicalPartition01
    - Model01
      - Elements ...
- <span style="color:red;font-weight:bold">Subject1</span>
  - <span style="color:red">PhysicalParition11</span>
    - <span style="color:red">Model11</span>
      - <span style="color:red">Elements ...</span>

- <span style="color:blue;font-weight:bold">Subject2</span>
  - <span style="color:blue">PhysicalParition21</span>
    - <span style="color:blue">Model21</span>
      - <span style="color:blue">Elements ...</span>
  - <span style="color:blue">Subject21</span>
    - <span style="color:blue">PhysicalParition211</span>
      - <span style="color:blue">...</span>

In this example, <span style="color:red;font-weight:bold">Subject1</span> and <span style="color:blue;font-weight:bold">Subject2</span> are the compartment Subjects. All of the elements and models under them are in their respective compartments. Color-coding is used to identify each tree. Everything in <span style="color:red">red</span> is in Subject1's compartment. Everything in <span style="color:blue">blue</span> is in Subject2's compartment.

Not everything in an iModel is in a compartment. Everything that is not below a Compartment Subject is considered part of the *Shared Compartment*. The Shared Compartment may be modified by all applications. In the diagram above, everything in black is in the Shared Compartment.

## CompartmentKeys

Every compartment has a `compartmentKey` that is used for controlling write access to it.

>Note: `compartmentKey` is distinct from the Code of the Compartment Subject element. It is a key chosen by the application that creates a compartment and is not visible to the user. More than one Compartment Subject may use the same `compartmentKey`.

## CompartmentControl

Every `IModelDb` has a member [IModelDb.compartments]($backend) of type [CompartmentControl]($backend) that supplies methods for controlling which compartments are editable during a session.

The method [CompartmentControl.getCompartmentKey]($backend) will return the `compartmentKey` for an element given an `ElementId`.

### Allowed Compartments

The `CompartmentControl` member of an IModelDb holds a set of allowed (i.e. editable) compartments. Any attempt to add/delete/update an [Element]($backend), [ElementAspect]($backend), or [Model]($backend) whose `compartmentKey` is not in the set of Allowed Compartments will generate a `CompartmentConstraintViolation` exception.

After opening an `IModelDb` but before editing it, applications should call [CompartmentControl.addAllowedCompartment]($backend) one or more times with the `compartmentKey`(s) for which editing should be allowed. To stop editing a compartment, call [CompartmentControl.removeAllowedCompartment]($backend).

For example:

```ts
    imodel.compartments.addAllowedCompartment("structural-members");
```

Later, to disallow editing of that compartment call:

```ts
    imodel.compartments.removeAllowedCompartment("structural-members");
```

> Note: The "shared" compartment is editable by default, so it is automatically in the set of allowed compartments. To disallow writing to the shared compartment, you can call `imodel.compartments.removeAllowedCompartment("shared")`

### Creating New Compartments

To create a new Compartment Subject element (and thereby a new compartment), use [CompartmentControl.insertCompartmentSubject]($backend).

E.g.:

```ts
  imodel.compartments.insertCompartmentSubject({ subjectName: "Chester", compartmentKey: "surface-stubs" });
```

Generally, Compartment Subject elements are created as a child of the Root Subject. However,  `insertCompartmentSubject` accepts an optional `parentSubjectId` argument so that Compartment Subjects can appear elsewhere in the Subject hierarchy. However, compartments may not nest. Attempts to create a Compartment Subject within an exiting compartment will throw an exception.

## Compartments vs. Locks

Locks and Compartments are orthogonal concepts. To edit an element, its compartment must be allowed AND its lock must be held.

Each is possible without the other:

- If another user holds the lock on an element, editing is denied even though it is an allowed compartment.
- An element may have been edited in a previous session or by another application in the same session. In that case the lock may be held, but further edits are denied if its compartment is not allowed.
