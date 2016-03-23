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

var getOrThrow = name => {
    var option = nconf.get(name);
    if(!option)
        throw new Error(`${name} is required`);
    return option;
};

var throwError = function(err) {
    throw new Error(JSON.stringify(err));
};

var sources = {
    file: cb => cb(fs.createReadStream(path.resolve("./" + nconf.get("input")))),
    api: cb => {
        var getRaws = token => cb(request({
            url: "http://" + host + "/acquisition/export/dump/" + taskId,
            headers: { "X-Auth-Token": token }
        }).on("response", function(response) {
            //if unautherized
            if(response.statusCode == 401)
                throw new Error("Token is invalid");
        }).on("error", throwError));

        var subDomain = nconf.get("subDomain");
        var host = subDomain
            ? subDomain + ".massexchange.com/api"
            : "localhost:8080";

        var token = nconf.get("token");
        if(!token) {
            var username = getOrThrow("username");
            var password = getOrThrow("password");

            var creds = {
                username: username,
                password: password
            };

            request({
                url: "http://" + host + "/session",
                method: "POST",
                json: true,
                body: creds
            }, (err, res, credentials) => {
                if(err)
                    if(err.code == "ECONNREFUSED")
                        throw new Error("Could not connect to server");
                    else throwError(err);

                getRaws(credentials.token);
            });
        } else
            getRaws(token);
    }
};

var sourceType = taskId ? "api" : "files";
LOG("Using " + sourceType + " source");
sources[sourceType](source => {
    source = source.pipe(JSONStream.parse("*"))

    var numRaws = nconf.get("numRaws");
    if(numRaws) {
        var bar = new ProgressBar("mapping at :speed raws/s [:bar] :percent ETA: :estimate", {
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

    caller(source, sink);
});

var caller;
module.exports = transform => caller = transform;
