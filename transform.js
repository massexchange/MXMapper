var fs = require("fs"),
    path = require("path"),

    nconf = require("nconf"),
    request = require("request"),
    pluralize = require("pluralize"),
    moment = require("moment"),

    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner"),
    progStream = require("progress-stream"),
    ProgressBar = require("progress"),
    spy = require("through2-spy");

nconf.argv().defaults({
    input: "in.json",
    output: "out.json"
});

var LOG = message => console.log(message);

var taskId = nconf.get("taskId");

var sources = {
    file: () => fs.createReadStream(path.resolve("./" + nconf.get("input"))),
    api: () => {
        return request({
            url: "http://localhost:8080/acquisition/export/dump/" + taskId,
            headers: { "X-Auth-Token": nconf.get("token") }
        }).on("response", function(response) {
            //if unautherized
            if(response.statusCode == 401)
                throw new Error("Token is invalid");
        }).on("error", function(err) { throw new Error(JSON.stringify(err)); });
    }
}

var sourceType = taskId ? "api" : "files";
LOG("Using " + sourceType + " source");
var source = sources[sourceType]().pipe(JSONStream.parse("*"));

var numRaws = nconf.get("numRaws");
if(numRaws) {
    var bar = new ProgressBar("mapping at :speed raws/s [:bar] :percent", { total: numRaws, incomplete: ' ' });

    // prog fields:
    // percentage, transferred, length, remaining, eta, runtime, delta, speed
    source = source.pipe(progStream({
        time: 100,
        length: numRaws,
        objectMode: true
    }, prog => {
        bar.tick(prog.delta, {
            speed: Math.round(prog.speed)
        });

        if(prog.percentage == 100)
            LOG("mapped " + pluralize("raw", numRaws, true) + " in " + moment.duration(prog.runtime, "s").humanize());
    }))
}

var mappingsCount = 0;
var resultCounter = spy(mapping => mappingsCount += 1)

var sink = Combine(
    JSONStream.stringify(),
    resultCounter,
    fs.createWriteStream(nconf.get("output"))
        .on("finish", () => LOG("generated " + mappingsCount + " mappings"))
);

module.exports = transform => transform(source, sink);
