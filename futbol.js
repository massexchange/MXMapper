var transform = require("./transform.js"),
    nconf = require("nconf"),
    mapStream = require("map-stream"),
    JSONStream = require("JSONStream");
    reduce = require("stream-reduce");

var columns = ["Publication", "Section"];

var zip = function() {
    var lists = Array.prototype.slice.call(arguments);
    var longest = lists.reduce(function(max, list) {
        return Math.max(list.length, max);
    }, 0);

    var out = [];
    for(var pos = 0; pos < longest; pos++)
        out.push(lists.map(function(list) {
            return list[pos];
        }));
    return out;
};

var parseName = (name) => zip(columns, name.split('/'))
                            .filter(tuple => tuple.every(x => x))
                            .reduce((out, tuple) => {
                                out[tuple[0]] = tuple[1];
                                return out;
                            }, {});

var colName = "Dimension.AD_UNIT_NAME";

var map = f => mapStream((data, cb) => {
    try {
        cb(null, f(data));
    }
    catch(e) {
        cb(e);
    }
});

transform((input, output) => {
    input
        .pipe(map(raw => raw.attributes.filter(attr => attr.key == colName)[0].value))
        //create protoMappings
        .pipe(map(colValue => ({
            adUnitName: colValue,
            values: parseName(colValue)
        })))
        //transform to real mappings
        .pipe(map(proto => ({
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
        }))).pipe(output);
});
