var humanize = require("humanize-duration"),
    pluralize = require("pluralize"),

    progStream = require("progress-stream"),
    ProgressBar = require("progress");

module.exports = (stream, LOG) => numRaws => {
    var bar = new ProgressBar("mapping at :speed raws/s [:bar] :percent ETA: :estimate", {
        total: numRaws,
        incomplete: ' ',
        clear: true,
        width: 60
    });

    var toMillis = s => s * 1000;
    var humanizeSeconds = s => humanize(toMillis(s));

    return stream.pipe(progStream({
        time: 100,
        speed: 10,
        length: numRaws,
        objectMode: true
    }, prog => {
        // prog fields:
        // percentage, transferred, length, remaining, eta, runtime, delta, speed
        bar.tick(prog.delta, {
            speed: Math.round(prog.speed),
            estimate: humanizeSeconds(prog.eta)
        });

        //TODO: extract to cb for performance boost
        if(prog.percentage == 100)
            LOG(`mapped ${pluralize("raw", numRaws, true)} in ${humanizeSeconds(prog.runtime)}`);
    }));
};
