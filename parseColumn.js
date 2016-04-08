var nconf = require("nconf"),
    prepare = require("./prepare"),
    util = require("./util");

var getAdUnitName = proto => proto.adUnitName;

module.exports = ({ colName, columns, seperator }) => {
    prepare().then(({ source, sink }) =>
        source
            .pipe(util.columnExtractor(colName))
            .pipe(util.protoMapper(columns, seperator))
            .pipe(util.mappingReducer(
                proto => colName,
                getAdUnitName,
                getAdUnitName,
                nconf.get("mp")))
            .pipe(util.flatMapper())
            .pipe(sink)
    );
}
