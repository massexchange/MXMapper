var prepare = require("./prepare"),
    util = require("./util"),

    nconf = require("nconf");

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
			var thingToPush = {
                colName: attr.key,
                colValue: attr.value,
                values: {}
            };

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
			var thingToPush = {
                colName: attr.key,
                colValue: attr.value,
                values: {}
            };

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
        .pipe(util.flatMapStream(parse))
        .pipe(util.mappingReducer(
            proto => proto.colName,
            proto => proto.colValue,
            protoKey,
            nconf.get("mp")))
        .pipe(util.flatMapper())
        .pipe(sink);
});
