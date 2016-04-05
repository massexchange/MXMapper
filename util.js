var through2 = require("through2"),
    mapStream = require("map-stream");

var exports = {};

exports.zip = function() {
        var lists = Array.prototype.slice.call(arguments);
        var longest = lists.reduce(function(max, list) {
            return Math.max(list.length, max);
        }, 0);

        var out = [];
        for(var pos = 0; pos < longest; pos++)
            out.push(lists.map(function(list) {
                return list[pos];
            }));
        return out;
    };

/*
    drop: callback()
    emit: callback(null, data)
    error: callback(err)
*/
exports.mapStream = f => mapStream((data, cb) => {
    try {
        cb(null, f(data));
    }
    catch(e) {
        cb(e);
    }
});

exports.flatMapReducer = mapper => (arr, el) => arr.concat(mapper(el));

exports.flatMapStream = mapper => through2.obj(function(obj, encoding, cb) {
    mapper(obj).forEach(el => this.push(el))

    return cb();
});

exports.tokenHeader = token => ({ "X-Auth-Token": token });

module.exports = exports;
