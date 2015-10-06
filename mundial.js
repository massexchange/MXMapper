var fs = require("fs");

var origFile = "Mundial LIVE DUMP.txt";
var fixedFile = "mundial_fixed.json";
var shortFile = "mundial_short.json";

var columns = ["Publication", "Section", "Location", "AdSize"];

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

var parseName = (name) => zip(columns, name.split('_'))
                            .reduce((out, tuple) => {
                                out[tuple[0]] = tuple[1];
                                return out;
                            }, {});

fs.readFile(__dirname + '/' + fixedFile, (err, data) => {
    if(err)
        throw err;

    var raws = JSON.parse(data);

    var colName = "Dimension.AD_UNIT_NAME";

    var protoMappings = raws.reduce((proto, raw) => {
        var colValue = raw.attributes[colName];

        if(!proto[colValue])
            proto[colValue] = {};

        Object.assign(proto[colValue], parseName(colValue));

        return proto;
    }, {});

    var mappings = Object.keys(protoMappings).map((adUnitName) => ({
        mp: 2,
        inputAttribute: {
            key: colName,
            value: adUnitName
        },
        outputAttributes: protoMappings[adUnitName]
    }));

    fs.writeFile("mappings.json", JSON.stringify(mappings));
});