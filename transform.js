var fs = require("fs"),
    nconf = require("nconf"),
    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner"),
    progress = require("progress-stream"),
    spy = require("through2-spy"),
    request = require("request");

nconf.argv().defaults({
    input: "in.json",
    output: "out.json"
});

var LOG = message => console.log(message);

var taskId = nconf.get("taskId");

var sources = {
    file: () => {
        var path = __dirname + '/' + nconf.get("input");

        LOG("Using file source:" + path);

        return fs.createReadStream(path);
    },
    api: () => {
        var token = "49aeb3a5-2f1d-4bf6-872c-f3d1e2791486";

        LOG("Using api source, task id: " + taskId);

        return request({
            url: "http://localhost:8080/acquisition/export/dump/" + taskId,
            headers: { "X-Auth-Token": token }
        });
    }
}

var source = sources[
    taskId
        ? "api"
        : "files"
]().pipe(JSONStream.parse("*"));

//651356
var numRaws = nconf.get("numRaws");
if(numRaws)
    source
        .pipe(spy({ objectMode: true }, LOG))
        .pipe(progress({
            time: 3000,
            length: numRaws,
            objectMode: true
        }, prog => LOG("Parsing " + Math.round(prog.percentage) + "% complete...")));

module.exports = transform =>
    transform(
        source,
        Combine(
            JSONStream.stringify(),
            fs.createWriteStream(nconf.get("output"))
        )
    );
