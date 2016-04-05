var prepare = require("./prepare"),
    util = require("./util")

    nconf = require("nconf"),
    reduce = require("stream-reduce");

var colName = "Dimension.AD_UNIT_NAME";
var columns = ["Publication", "Section"];

//main parsing logic
var parseName = (name) =>
    //create protoAttr kvps
    util.zip(columns, name.split('/'))
        //filter out value-less protoAttrs
        .filter(tuple => tuple.every(x => x))
        //convert tuples to map
        .reduce((out, tuple) => {
            out[tuple[0]] = tuple[1];
            return out;
        }, {});


//extract relevant column
var columnExtractor = util.mapStream(raw =>
    raw.attributes.filter(attr => attr.key == colName)[0].value
);

//create protoMappings
var protoMapper = util.mapStream(colValue => ({
    adUnitName: colValue,
    values: parseName(colValue)
}));

//transform to real mappings
//reduce to a map to filter duplicates
var mappingReducer = reduce((mappings, proto) => {
    if(!mappings[proto.adUnitName])
        mappings[proto.adUnitName] = {
            mp: { id: nconf.get("mp") },
            inputAttribute: {
                key: colName,
                value: proto.adUnitName
            },
            outputAttributes:
                //convert protoMappings
                Object.keys(proto.values)
                    .map(type => ({
                        key: type,
                        value: proto.values[type]
                    }))
        };

    return mappings;
}, {});

var flatMapper = util.flatMapStream(mappings =>
    Object.keys(mappings)
        .reduce(util.flatMapReducer(key => mappings[key]), [])
);

prepare().then(({ source, sink }) => {
    source
        .pipe(columnExtractor)
        .pipe(protoMapper)
        .pipe(mappingReducer)
        .pipe(flatMapper)
        .pipe(sink);
});
