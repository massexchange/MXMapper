var prepare = require("./prepare"),
    util = require("./util"),

    nconf = require("nconf"),
    reduce = require("stream-reduce");

var isAdSize = str => {
	var retval = false;
	var splitstr = str.split("_");

	splitstr.forEach(segment => {
		//ifs seperate for readability
		if(segment == "ATF" || segment == "BTF")
			retval = true;
		if(segment.length > 4 && (segment[3] == 'x' || segment [4]=='x'))
			retval = true;
	});
	return retval;
};

var parsePagePosition = str => {
	var retval = 0;

	str.split("_").forEach(segment => {
		if (segment == "ATF" || segment == "BTF")
			retval = segment;
	});

	return retval;
};

var parseAdSize = str => {
	var retval = 0;

	str.split("_").forEach(segment => {
		if(segment.length > 4 && (segment[3]=='x'||segment[4]=='x'))
			retval = segment;
	});

	return retval;
};

var parse = source => {
	var attrs = Object.keys(source.attributes)
		.map(type => ({
			key: type,
			value: source.attributes[type]
		}))
		.filter(attr => attr.key.indexOf("ID") == -1);

	var output = [];

	//Ad units 3 and 4 are the ones that vary in fareportal land.
	//Possibly different for other clients (Futbol only has depth 2, for example)
	attrs.forEach(attr => {
		if(attr.key == "Ad unit 3") {
			var thingToPush = { colName:attr.key, colValue:attr.value, values:{} };

			if(isAdSize(attr.value)) {
				var size = parseAdSize(attr.value);
				var pos = parsePagePosition(attr.value);

				if(size != 0)
					thingToPush.values["AdSize"] = size;
				if(pos != 0)
					thingToPush.values["PagePosition"] = pos;
			}
			else
				thingToPush.values["SubSection"] = attr.value;

			output.push(thingToPush);
		}
		else if(attr.key == "Ad unit 4") {
			var thingToPush = { colName:attr.key, colValue:attr.value, values:{} };

			if(isAdSize(attr.value)) {
				var size = parseAdSize(attr.value);
				var pos = parsePagePosition(attr.value);

				if (size != 0)
					thingToPush.values["AdSize"] = size;
				if (pos != 0)
					thingToPush.values["PagePosition"] = pos;
			}
			else {
				console.log("Well then. This shouldn't happen");
				console.log(attr);
			}
			output.push(thingToPush);
		}
	});

	return output;
};

var protoKey = proto => proto.colName + ':' + proto.colValue;

prepare().then(({ source, sink }) => {
    source
        //create protoMappings
        .pipe(util.flatMapStream(parse))
        //transform to real mappings
        //reduce to a map to filter duplicates
        .pipe(reduce((mappings, proto) => {
            var key = protoKey(proto);
            if(!mappings[key])
                mappings[key] = {
                    mp: { id: nconf.get("mp") },
                    inputAttribute: {
                        key: proto.colName,
                        value: proto.colValue
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
        .pipe(util.flatMapper())
        .pipe(sink);
});
