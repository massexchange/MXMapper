# MXMapper

###### an inventory mapping tool

When onboarding a new client, we need to map their data to our inventory format. This can be
done by hand, but often (hopefully) the client's data is sensibly organized, and in those cases
we can take advantage of their hard work.

This tool helps you parse client data using a schema.

### Installation

Clone the repo, and then run `npm install` in the repo directory.

### Mapping

Depending on the client's data format, you may want to use this tool in one of several ways.
In every case, you will be creating a mapping script named appropriately for that client, in which
you use the tools provided.

#### Parse single column


The simplest case is where you only care about the contents of a single column, in which the values
are seperated by one consistent character.

##### Example:
```
Heading: IgnoredCol1    IgnoredCol2    IgnoredCol3    ImportantCol
Row 1:   IgnoredVal1    IgnoredVal2    IgnoredVal3    Val1/Val2/Val3
Row 2:   IgnoredVal1    IgnoredVal2    IgnoredVal3    Val4/Val5/Val6
```
Schema: `Attr1/Attr2/Attr3`

Here, you only care about the values in `ImportantCol`, which you want to parse based on their
order of appearance, which would be matched with the provided schema.

The results would be:
```
Row 1: Attr1:Val1, Attr2:Val2, Attr3:Val3
Row 2: Attr1:Val4, Attr2:Val5, Attr3:Val6
```

##### Implementation

There are currently two examples of using this, `futbol.js` and `mundial.js`.
They follow this format:
```javascript
require("./parseColumn")({
    colName: "ImportantCol",
    columns: ["Attr1", "Attr2", "Attr3"],
    seperator: '/'
});
```

#### Custom

If the data is in a more complicated format and the simple case does not suffice, you can implement
your own mapping logic.

##### Implementation

From `parseColumn.js`:
```javascript
var nconf = require("nconf"),
    prepare = require("./prepare"),
    util = require("./util");

module.exports = ({ colName, columns, seperator }) => {
    prepare().then(({ source, sink }) =>
        source
            .pipe(util.columnExtractor(colName))
            .pipe(util.protoMapper(columns, seperator))
            .pipe(util.mappingReducer(colName, nconf.get("mp")))
            .pipe(util.flatMapper())
            .pipe(sink)
    );
}

```




### Usage

This tool accepts raw inventory and generates mappings. It is used though a UNIX CLI.
The input/output are configurable, and it reports progress while working.

```bash
npm start <script> -- [--option value] ... [--option value]
```
The `--` tells `npm` to pass the options to the called script.

#### General

You must supply an `mpId` option.

For progress to be reported, either the `numRaws` option must be supplied, or the `Acqusition`
raw count endpoint must be available.

#### Input

Raws can be read either from a `JSON` file or from the `Acquisition` API.

Options required:
   - **file**: `input`
   - **api**: `username` `password` `taskId`

#### Output

Mappings can be output to a `JSON` file or to the `Mapping` API.

Options required:
   - **file**: `output`
