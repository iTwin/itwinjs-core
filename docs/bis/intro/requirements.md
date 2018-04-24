# Requirements

Responsible for this page: Joe Buckley and Casey Mullen

TODO: *THIS CHAPTER HAS NOT YET BEEN REVIEWED*

## Introduction

Requirements appear often in AEC and asset-management workflows. Examples of requirements include:
 - Schedules include completion data requirements.
 - Electrical power designs include voltage and amperage requirements.
 - Assets have associated maintenance requirements.

BIS contains an *IRequirement* mix-in class that can be used to represent these situations. 

## IRequirement Mixin
The BisCore schema contains an *IRequirement* mix-in class. This mix-in class can be applied to any Element subclass. The *IRequirement* mix-in denotes that the class contains requirements. Currently (2018-04-06) the *IRequirement* mix-in does not contain any properties and is not involved in any relationships; this will likely change in future schema versions (see below).

A typical use of the *IRequirement* mix-in would be to apply it to a FunctionalComponent subclass, such as Pump (note this refers to the functional Pump and not the physical Pump). The Pump class might have properties that represent the required head (or pressure) and flow ratings.

## Requirements vs Functions
Not all FunctionalComponent subclasses will include the *IRequirement* mix-in. xxxxxxxxxx

## Likely Future Requirement Expansions in BIS
It is likely that a relationship will be created to associate an *IRequirement* with the Element (or Elements) that fulfills the requirement.

A custom attribute may be created to denote that a property represents a requirement.