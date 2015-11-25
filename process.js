var nconf = require("nconf");
var fs = require("fs");

nconf.argv().defaults({
    input: "in.json",
    output: "out.json"
});

module.exports = function(transform) {
    return fs.readFile(__dirname + '/' + nconf.get("input"), (err, data) => {
        if(err)
            throw err;

        var objects = JSON.parse(data);

        var out = transform(objects);

        fs.writeFile(nconf.get("output"), JSON.stringify(out));
    });
};
