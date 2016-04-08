var prepare = require("./prepare"),
    util = require("./util"),

    nconf = require("nconf");

var isPagePosition = segment => util.contains(["ATF", "BTF"], segment);
var isAdSize = segment => segment.length > 4 && util.contains([segment[3], segment[4]], 'x');

var parsePagePosition = colValue => colValue.split("_").filter(isPagePosition)[0];
var parseAdSize = colValue => colValue.split("_").filter(isAdSize)[0];

var hasAdSize = colValue =>
    colValue.split("_").some(segment =>
        isPagePosition(segment) ||
        isAdSize(segment)
    );

var parse = source => {
	var attrs = Object.keys(source.attributes)
		.map(type => ({
			key: type,
			value: source.attributes[type]
		}))
		.filter(attr => !util.contains(attr.key, "ID"));

	var output = [];

	//Ad units 3 and 4 are the ones that vary in fareportal land.
	//Possibly different for other clients (Futbol only has depth 2, for example)
    var importantAttrs = {
        "Ad unit 3": (mapping, attr) => mapping.values["SubSection"] = attr.value,
        "Ad unit 4": (mapping, attr) => {
            console.log("Well then. This shouldn't happen");
            console.log(attr);
        }
    };

    var mapAdUnit = attr => {
        var mapping = {
            colName: attr.key,
            colValue: attr.value,
            values: {}
        };

        if(hasAdSize(attr.value)) {
            var size = parseAdSize(attr.value);
            var pos = parsePagePosition(attr.value);

            if(size != 0)
                mapping.values["AdSize"] = size;
            if(pos != 0)
                mapping.values["PagePosition"] = pos;
        }
        else
            importantAttrs[attr.key](mapping, attr);

        return mapping;
    };

	return attrs.filter(attr => util.contains(Object.keys(importantAttrs), attr.key))
        .map(mapAdUnit);
};

var protoKey = proto => proto.colName + ':' + proto.colValue;

prepare().then(({ source, sink }) => {
    source
        .pipe(util.flatMapStream(parse))
        .pipe(util.mappingReducer(
            proto => proto.colName,
            proto => proto.colValue,
            protoKey,
            nconf.get("mp")))
        .pipe(util.flatMapper())
        .pipe(sink);
});
