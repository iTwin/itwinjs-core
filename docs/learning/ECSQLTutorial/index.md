---
ignore: true
---
# Learning ECSQL

This tutorial allows you to learn how to use ECSQL to read and query the business data in your iModels.

ECSQL is an implementation of SQL — a proven, well-adopted text-based command language. It sticks to
standard SQL (SQL-92 and SQL-99) wherever possible.

## Scope

The data in iModels can only be modified via the respective APIs. ECSQL is used to query the data from iModels. Therefore the tutorial only covers the query portion of ECSQL, i.e. **ECSQL SELECT** statements.

## How to use the tutorial

The tutorial looks at typical questions and finds the respective ECSQL answer to it. All ECSQL examples used in the lessons can be run by
yourself by using the [iModelConsole](#imodelconsole) with the tutorial's [Sample iModel](#sample-imodel).

This also enables you to experiment more with ECSQL by modifying the tutorial's ECSQL statements or by trying out your own ECSQL statements.

So make sure to run the [iModelConsole](#imodelconsole) with the sample iModel opened when working with the tutorial.

### How to open the sample iModel in the iModelConsole

Once you fired up the iModelConsole run this command:

`.open -path:<path to sample imodel>`

### How to run an ECSQL in the iModelConsole

Once you opened the iModel just type in the ECSQL (without a leading .) and hit *Enter* to execute it.

## Prerequisites

### SQL

In the course of the tutorial you will notice how similar ECSQL and SQL are. To not reinvent the wheel, this tutorial therefore expects you to be familiar with the basics of SQL. **If you are new to SQL, please take a class on the SQL basics first.**

### iModelConsole

**WIP**
You will also need to use the **iModelConsole** to try out the ECSQL examples in the tutorial yourself and to experiment with your own ECSQL statements. You can download it from here XXX. Follow the instructions on XXX for how to install and run it.

> In the iModelConsole run the `.help` command to see all available commands.

### Sample iModel

**WIP**
The ECSQL examples in the tutorial work with the sample iModel which you can download from here: XXX

### BIS

As every iModel is based upon [BIS](../../bis/intro/introduction.md), the examples throughout the tutorial use the BIS ECSchemas. While not required to learn ECSQL, making yourself familiar with [BIS](../../bis/intro/introduction.md) is a good idea to even get more out of this tutorial (see [BIS Introduction](../../bis/intro/introduction.md)).

## Tutorial Overview

### Basic lessons

* [Lesson 1: Key to ECSQL](./KeyToECSQL)
* [Lesson 2: The first examples](./FirstExamples)
* [Lesson 3: ECSQL Data Types](./ECSQLDataTypes)
* [Lesson 4: Relationships and Joins](./Joins)
* [Lesson 5: Class Polymorphism](./PolymorphicQueries)
* [Lesson 6: SQL Functions](./SQLFunctions)

### Advanced lessons

* [Lesson 7: Meta Queries - Querying ECSchemas](./MetaQueries)
* [Lesson 8: Querying ChangeSummaries](./ChangeSummaryQueries)
