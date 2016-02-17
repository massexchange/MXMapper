var transform = require("./transform"),
    util = require("./util")

    nconf = require("nconf"),
    reduce = require("stream-reduce");

var columns = ["Publication", "Section"];

var parseName = (name) => util.zip(columns, name.split('/'))
                            .filter(tuple => tuple.every(x => x))
                            .reduce((out, tuple) => {
                                out[tuple[0]] = tuple[1];
                                return out;
                            }, {});

var colName = "Dimension.AD_UNIT_NAME";

transform((input, output) => {
    input
        .pipe(util.mapStream(raw => raw.attributes.filter(attr => attr.key == colName)[0].value))
        //create protoMappings
        .pipe(util.mapStream(colValue => ({
            adUnitName: colValue,
            values: parseName(colValue)
        })))
        //transform to real mappings
        //reduce to a map to filter duplicates
        .pipe(reduce((mappings, proto) => {
            if(!mappings[proto.adUnitName])
                mappings[proto.adUnitName] = {
                    mp: { id: nconf.get("mp") },
                    inputAttribute: {
                        key: colName,
                        value: proto.adUnitName
                    },
                    outputAttributes:
                        Object.keys(proto.values)
                            .map(type => ({
                                key: type,
                                value: proto.values[type]
                            }))
                };

            return mappings;
        }, {}))
        .pipe(util.flatMapStream(mappings =>
            Object.keys(mappings)
                .reduce(util.flatMapReducer(key => mappings[key]), [])
        ))
        .pipe(output);
});
