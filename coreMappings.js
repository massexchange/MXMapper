var nconf = require("nconf");
var fs = require("fs");

// usage: coreMappings --mp 3

nconf.argv();
var mpId = nconf.get("mp");

var mappingsWithoutMp = [
    {
        inputAttribute: { key: "Dimension.METRO_NAME", value: "*" },
        outputAttributes: [{ key: "DMA", value: "*" }]
    }, {
        inputAttribute: { key: "Dimension.AD_UNIT_NAME", value: "*" },
        outputAttributes: [{ key: "AdSize", value: "*" }]
    }, {
        inputAttribute: { key: "Dimension.DEVICE_CATEGORY_NAME", value: "*" },
        outputAttributes: [{ key: "Device", value: "*" }]
    }, {
        inputAttribute: { key: "Dimension.COUNTRY_NAME", value: "*" },
        outputAttributes: [{ key: "Nation", value: "*" }]
    }, {
        inputAttribute: { key: "Demo Title", value: "*" },
        outputAttributes: [{ key: "Gender", value: "*" }]
    }, {
        inputAttribute: { key: "Demo Value Title", value: "*" },
        outputAttributes: [{ key: "AgeRange", value: "*" }]
    }, {
        inputAttribute: { key: "Dimension.AD_UNIT_ID", value: "*" },
        outputAttributes: []
    }, {
        inputAttribute: { key: "Dimension.COUNTRY_CRITERIA_ID", value: "*" },
        outputAttributes: []
    }, {
        inputAttribute: { key: "Dimension.METRO_CRITERIA_ID", value: "*" },
        outputAttributes: []
    }, {
        inputAttribute: { key: "Dimension.DEVICE_CATEGORY_ID", value: "*" },
        outputAttributes: []
    }
];

var finalMappings = mappingsWithoutMp.map(function(mapping) {
    mapping.mp = { id: mpId };
    return mapping;
});

fs.writeFile("coreMappings.json", JSON.stringify(finalMappings));
