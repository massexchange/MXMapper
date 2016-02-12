var fs = require("fs"),
    nconf = require("nconf"),
    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner");
    progress = require("progress-stream");

nconf.argv().defaults({
    input: "in.json",
    output: "out.json"
});

/*
    drop: callback()
    emit: callback(null, data)
    error: callback(err)
*/

var path = __dirname + '/' + nconf.get("input");

//var size = fs.statSync(path).size;

var str = progress({ time: 3200, length: 180108 });
str.on('progress', prog => console.log(Math.round(prog.percentage) + "% complete..."));

module.exports = transform =>
    transform(
        fs.createReadStream(path)
            .pipe(JSONStream.parse("*"))
            .pipe(str),
        Combine(
            JSONStream.stringify(),
            fs.createWriteStream(nconf.get("output"))
        )
    );
