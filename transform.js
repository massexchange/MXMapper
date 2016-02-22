var fs = require("fs"),
    path = require("path"),

    nconf = require("nconf"),
    request = require("request"),
    pluralize = require("pluralize"),
    moment = require("moment"),
    humanize = require("humanize-duration"),

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
    var bar = new ProgressBar("mapping at :speed raws/s, should be done in around :estimate [:bar] :percent ", {
        total: numRaws,
        incomplete: ' ',
        clear: true,
        width: 60
    });

    var toMillis = s => s * 1000;
    var humanizeSeconds = s => humanize(toMillis(s));

    // prog fields:
    // percentage, transferred, length, remaining, eta, runtime, delta, speed
    source = source.pipe(progStream({
        time: 100,
        speed: 10,
        length: numRaws,
        objectMode: true
    }, prog => {
        bar.tick(prog.delta, {
            speed: Math.round(prog.speed),
            estimate: humanizeSeconds(prog.eta)
        });

        if(prog.percentage == 100)
            LOG("mapped " + pluralize("raw", numRaws, true) + " in " + humanizeSeconds(prog.runtime));
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
