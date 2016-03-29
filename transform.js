var fs = require("fs"),
    path = require("path"),

    nconf = require("nconf"),
    request = require("request"),
    requestPromise = require("request-promise"),
    pluralize = require("pluralize"),
    moment = require("moment"),
    humanize = require("humanize-duration"),

    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner"),
    progStream = require("progress-stream"),
    ProgressBar = require("progress"),
    spy = require("through2-spy"),

    Promise = require("bluebird");

nconf.argv().defaults({
    input: "in.json"
}).use("memory");

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

var getHost = () => {
    var subDomain = nconf.get("subDomain");
    return subDomain
        ? subDomain + ".massexchange.com/api"
        : "localhost:8080";
};

var sources = {
    file: () => Promise.resolve(fs.createReadStream(path.resolve("./" + nconf.get("input")))),
    api: () => {
        var host = getHost();

        var token = nconf.get("token");
        var tokenP;
        if(!token) {
            var username = getOrThrow("username");
            var password = getOrThrow("password");

            var creds = {
                username: username,
                password: password
            };

            tokenP = requestPromise({
                url: "http://" + host + "/session",
                method: "POST",
                json: true,
                body: creds
            }).promise().get("token")
            .tap(token => nconf.set("token", token))
            .catch(err => {
                if(err.code == "ECONNREFUSED")
                    throw new Error("Could not connect to server");
                else throwError(err);
            });
        } else
            tokenP = Promise.resolve(token);

        return tokenP.then(token =>
            request({
                url: `http://${getHost()}/acquisition/export/dump/${taskId}`,
                headers: { "X-Auth-Token": token }
            }).on("response", function(response) {
                //if unautherized
                if(response.statusCode == 401)
                    throw new Error("Token is invalid");
            }).on("error", throwError)
        );
    }
};

var getSink = () => {
    var outputFile = nconf.get("output");
    if(outputFile) {
        console.log("saving mappings to file");
        return fs.createWriteStream(outputFile);
    }

    console.log("pushing mappings to api");

    return request({
        method: "POST",
        json: true,
        url: "http://" + getHost() + "/mappings/batch",
        headers: { "X-Auth-Token": nconf.get("token") }
    });
};

var tryGetNumRaws = () => {
    var numRaws = nconf.get("numRaws");
    if(numRaws)
        return Promise.resolve(numRaws);

    return requestPromise({
        url: `http://${getHost()}/acquisition/export/${nconf.get("taskId")}/count`,
        headers: { "X-Auth-Token": nconf.get("token") }
    });
};

var trackProgress = (stream, numRaws) => {
    console.log(numRaws);
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
    return stream.pipe(progStream({
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
    }));
};

var caller;
var connectSource = source => {
    var mappingsCount = 0;
    var resultCounter = spy(mapping => mappingsCount += 1)

    var sink = Combine(
        JSONStream.stringify(),
        resultCounter,
        getSink()
            .on("finish", () => LOG("generated " + mappingsCount + " mappings"))
    );

    caller(source, sink);
};

var sourceType = taskId ? "api" : "files";
LOG("Using " + sourceType + " source");
sources[sourceType]().call("pipe", JSONStream.parse("*"))
    .then(source => tryGetNumRaws()
        .then(numRaws => trackProgress(source, numRaws))
        .catchReturn(source)
        .then(connectSource)
    );

module.exports = transform => caller = transform;
