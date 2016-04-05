var fs = require("fs"),
    path = require("path"),

    nconf = require("nconf"),
    request = require("request"),
    requestPromise = require("request-promise"),
    moment = require("moment"),

    JSONStream = require("JSONStream"),
    Combine = require("stream-combiner"),
    spy = require("through2-spy"),

    Promise = require("bluebird")

    progress = require("./progress"),
    util = require("./util");

nconf.argv().defaults({
    input: "in.json"
}).use("memory");

var LOG = message => console.log(message);

var getHost = () => {
    var subDomain = nconf.get("subDomain");
    return subDomain
        ? subDomain + ".massexchange.com/api"
        : "localhost:8080";
};

var sources = {
    file: () => Promise.resolve(fs.createReadStream(path.resolve("./" + nconf.get("input")))),
    api: () => require("./apiSource")(getHost(), LOG)
};

var getSource = () => {
    var sourceType = nconf.get("taskId") ? "api" : "files";
    LOG("using " + sourceType + " source");

    return sources[sourceType]().call("pipe", JSONStream.parse("*"));
};

var getSink = doneCb => {
    var outputFile = nconf.get("output");
    if(outputFile) {
        LOG("saving mappings to file...");
        return fs.createWriteStream(outputFile).on("finish", doneCb);
    }

    return request({
        method: "POST",
        json: true,
        url: `http://${getHost()}/mappings/batch`,
        headers: util.tokenHeader(nconf.get("token"))
    }).on("request", () => LOG("pushing mappings to api..."))
    .on("end", doneCb);
};

var getNumRaws = () => {
    //LOG("attempting to determine number of raws...");

    var numRaws = nconf.get("numRaws");
    if(numRaws)
        return Promise.resolve(numRaws);

    return requestPromise({
        url: `http://${getHost()}/acquisition/export/${nconf.get("taskId")}/count`,
        headers: util.tokenHeader(nconf.get("token"))
    }).then(stringNum => parseInt(stringNum, 10));
};

var tryTrackProgress = source => {
    return getNumRaws()
        .then(progress(source, LOG))
        .catch(() => {
            //LOG("could not determine");
            return source;
        });
};

var caller;
var connectSource = source => {
    var mappingsCount = 0;

    var sink = Combine(
        JSONStream.stringify(),
        spy(mapping => mappingsCount++),
        getSink(() => LOG(`generated ${mappingsCount} mappings`))
    );

    return { source, sink };
};

module.exports = () => getSource()
    .then(tryTrackProgress)
    .then(connectSource);
