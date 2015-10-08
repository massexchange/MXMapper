var fs = require("fs");

fs.readFile(__dirname + "/mappings.json", function(err, data) {
    if(err)
        throw err;

    var mappings = JSON.parse(data);

    mappings.map(function(mapping) {
        mapping.outputAttributes = Object.keys(mapping.outputAttributes)
                                    .map(function(type) {
                                        return {
                                            key: type,
                                            value: mapping.outputAttributes[type]
                                        };
                                    });
        return mapping;
    });

    fs.writeFile("mappings_fixed.json", JSON.stringify(mappings));
});
