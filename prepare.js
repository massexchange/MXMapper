var fs = require("fs"),
    path = require("path"),
    mkdirp = require("mkdirp"),

    nconf = require("nconf"),
    request = require("request"),
    requestPromise = require("request-promise"),
    moment = require("moment"),

    PassThroughStream = require("stream").PassThrough,
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
        ? `${subDomain}.massexchange.com/api`
        : "localhost:8080";
};

var sources = {
    file: () => Promise.resolve(fs.createReadStream(path.resolve("./" + nconf.get("input")))),
    api: () => require("./apiSource")(getHost(), LOG)
};

var getSource = () => {
    var sourceType = nconf.get("taskId")
        ? "api"
        : "file";

    LOG(`using ${sourceType} source`);
    return sources[sourceType]().call("pipe", JSONStream.parse("*"));
};

var sinks = {
    file: (outputFile, cb) => {
        var outPath = path.join(__dirname, "out");

        // return a promise that is resolved after directory exists
        return new Promise((resolve, reject) => mkdirp(outPath, err => {
            if(err)
                reject(new Error(err));

            // see (1)
            resolve(() => fs.createWriteStream(path.join(outPath, outputFile))
                .on("pipe", src => LOG("saving mappings to file..."))
                .on("finish", cb)
            );
        }))
    },
    // see (1)
    api: cb => Promise.resolve(() => request({
        method: "POST",
        json: true,
        url: `http://${getHost()}/mappings/batch`,
        headers: Object.assign(
                    { "Content-Type": "application/json" },
                    util.tokenHeader(nconf.get("token"))
                ) // merge headers
    }).on("pipe", src => LOG("pushing mappings to api..."))
      .on("end", cb))
};
// (1) the promises are resolved with a getter so that the streams are opened exactly when they're needed

var getSink = cb => {
    var outputFile = nconf.get("output");
    if(outputFile)
        return sinks.file(outputFile, cb);

    return sinks.api(cb);
};

var getNumRaws = () => {
    var numRaws = nconf.get("numRaws");
    if(numRaws)
        return Promise.resolve(numRaws);

    return requestPromise({
        url: `http://${getHost()}/acquisition/export/${nconf.get("taskId")}/count`,
        headers: util.tokenHeader(nconf.get("token"))
    }).then(stringNum => parseInt(stringNum, 10));
};

var tryTrackProgress = source =>
    getNumRaws()
        .then(progress(source, LOG))
        .catch(() => source);

var connectSink = source => {
    var mappingsCount = 0;

    return getSink(() => LOG(`generated ${mappingsCount} mappings`))
        .then(sinkGetter => ({
            source,
            sink: Combine(
                JSONStream.stringify(),
                spy(mapping => mappingsCount++),
                new PassThroughStream()
                    // placeholder stream, replaced with sink on pipe
                    .on("pipe", src => src.pipe(sinkGetter()))
            )
        }));
};

module.exports = () => getSource()
    .then(tryTrackProgress)
    .then(connectSink);
