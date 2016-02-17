var fs = require("fs"),
    path = require("path"),

    nconf = require("nconf"),
    request = require("request"),
    pluralize = require("pluralize"),
    moment = require("moment"),

    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner"),
    progStream = require("progress-stream"),
    ProgressBar = require("progress");

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
LOG("Using " + sourceType + "source");
var source = sources[sourceType]().pipe(JSONStream.parse("*"));

var numRaws = nconf.get("numRaws");
if(numRaws) {
    var bar = new ProgressBar("generating mappings [:bar] :percent Speed: :speed raws/s", { total: numRaws });

    // prog fields:
    // percentage, transferred, length, remaining, eta, runtime, delta, speed
    source = source.pipe(progStream({
        time: 200,
        length: numRaws,
        objectMode: true
    }, prog => {
        bar.tick(prog.delta, {
            speed: Math.round(prog.speed)
        });

        if(prog.percentage == 100)
            LOG("Generated mappings for " + pluralize("raw", numRaws, true) + " in " + moment.duration(prog.runtime, "s").humanize());
    }))
}

module.exports = transform =>
    transform(
        source,
        Combine(
            JSONStream.stringify(),
            fs.createWriteStream(nconf.get("output"))
        )
    );
