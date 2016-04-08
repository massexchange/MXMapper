var through2 = require("through2"),
    mapStream = require("map-stream"),
    reduce = require("stream-reduce");

var exports = {};

exports.zip = () => {
    var lists = Array.prototype.slice.call(arguments);
    var longest = lists.reduce((max, list) => Math.max(list.length, max), 0);

    var out = [];
    for(var pos = 0; pos < longest; pos++)
        out.push(lists.map(list => list[pos]));

    return out;
};

/*
    drop: callback()
    emit: callback(null, data)
    error: callback(err)
*/
exports.mapStream = f => mapStream((data, cb) => {
    try {
        cb(null, f(data));
    }
    catch(e) {
        cb(e);
    }
});

exports.flatMapReducer = mapper => (arr, el) => arr.concat(mapper(el));

exports.flatMapStream = mapper => through2.obj(function(obj, encoding, cb) {
    mapper(obj).forEach(el => this.push(el));

    return cb();
});

exports.flatMapper = () => exports.flatMapStream(mappings =>
    Object.keys(mappings)
        .reduce(exports.flatMapReducer(key => mappings[key]), [])
);

//extract relevant column
exports.columnExtractor = colName => exports.mapStream(raw =>
    raw.attributes.filter(attr => attr.key == colName)[0].value
);

exports.parseName = (name, columns, seperator) =>
    //create protoAttr kvps
    exports.zip(columns)
        //filter out value-less protoAttrs
        .filter(tuple => tuple.every(x => x))
        //convert tuples to map
        .reduce((out, tuple) => {
            out[tuple[0]] = tuple[1];
            return out;
        }, {});

//create protoMappings
exports.protoMapper = (columns, seperator) => exports.mapStream(colValue => ({
    adUnitName: colValue,
    values: exports.parseName(colValue, columns, seperator)
}));

//transform to real mappings
//reduce to a map to filter duplicates
exports.mappingReducer = (colName, colValue, protoKey, mpId) => reduce((mappings, proto) => {
    var key = protoKey(proto);
    if(!mappings[key])
        mappings[key] = {
            mp: { id: mpId },
            inputAttribute: {
                key: colName(proto),
                value: colValue(proto)
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

exports.tokenHeader = token => ({ "X-Auth-Token": token });

module.exports = exports;
