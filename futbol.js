var process = require("./process.js"),
    nconf = require("nconf");

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

process(raws => {
    var colName = "Dimension.AD_UNIT_NAME";

    var protoMappings = raws.reduce((proto, raw) => {
        var colValue = raw.attributes[colName];

        if(!proto[colValue])
            proto[colValue] = {};

        Object.assign(proto[colValue], parseName(colValue));

        return proto;
    }, {});

    var mappings = Object.keys(protoMappings).map((adUnitName) => ({
        mp: { id: nconf.get("mp") },
        inputAttribute: {
            key: colName,
            value: adUnitName
        },
        outputAttributes: Object.keys(protoMappings[adUnitName])
                            .map(function(type) {
                                return {
                                    key: type,
                                    value: protoMappings[adUnitName][type]
                                };
                            })
    }));

    return mappings;
});