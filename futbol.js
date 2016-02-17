var transform = require("./transform.js"),

    nconf = require("nconf"),

    through2 = require("through2"),
    mapStream = require("map-stream"),
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

/*
    drop: callback()
    emit: callback(null, data)
    error: callback(err)
*/
var map = f => mapStream((data, cb) => {
    try {
        cb(null, f(data));
    }
    catch(e) {
        cb(e);
    }
});

var flatMap = mapper => (arr, el) => arr.concat(mapper(el));

var flatMapStream = mapper => through2({ objectMode: true }, function(obj, encoding, cb) {
    mapper(obj).forEach(el => this.push(el))

    return cb();
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
        .pipe(flatMapStream(mappings =>
            Object.keys(mappings)
                .reduce(flatMap(key => mappings[key]), [])
        ))
        .pipe(output);
});
