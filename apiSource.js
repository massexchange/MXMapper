var nconf = require("nconf"),
    request = require("request"),
    requestPromise = require("request-promise"),

    util = require("./util");

var throwError = function(err) {
    throw new Error(JSON.stringify(err));
};

var getOrThrow = name => {
    var option = nconf.get(name);
    if(!option)
        throw new Error(`${name} is required`);
    return option;
};

module.exports = (host, LOG) => {
    var token = nconf.get("token");
    var tokenP;
    if(!token) {
        var username = getOrThrow("username");
        var password = getOrThrow("password");

        LOG(`logging in as ${username}...`);
        tokenP = requestPromise({
            url: `http://${host}/session`,
            method: "POST",
            json: true,
            body: { username, password }
        }).promise().get("token")
        .tap(token => nconf.set("token", token))
        .catch(err => {
            if(err.code == "ECONNREFUSED")
                throw new Error("Could not connect to server");
            else throwError(err);
        });
    } else
        tokenP = Promise.resolve(token);

    var taskId = nconf.get("taskId");

    return tokenP.then(token => {
        return request({
            url: `http://${host}/acquisition/export/dump/${taskId}`,
            headers: util.tokenHeader(token)
        }).on("request", () => LOG(`requesting raws for task ${taskId}...`))
        .on("response", response => {
            //if unautherized
            if(response.statusCode == 401)
                throw new Error("Token is invalid");
        }).on("error", throwError)
    });
};
