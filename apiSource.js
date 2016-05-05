var nconf = require("nconf"),
    request = require("request"),
    requestPromise = require("request-promise"),

    util = require("./util");

var throwError = err => {
    throw new Error(JSON.stringify(err));
};

var getOrThrow = name => {
    var option = nconf.get(name);
    if(!option)
        throw new Error(`${name} is required`);

    return option;
};

var getToken = (host, LOG) => {
    var username = getOrThrow("username");
    var password = getOrThrow("password");

    LOG(`logging in as ${username}...`);
    return requestPromise({
        url: `http://${host}/session`,
        method: "POST",
        json: true,
        body: { username, password }
    }).promise()
      .tap(creds => nconf.set("mp", creds.user.mp.id))
      .get("token")
      .tap(token => nconf.set("token", token))
      .catch(err => {
        if(err.error.code == "ECONNREFUSED")
            throw new Error("Could not connect to server");

        else throwError(err);
    });
};

module.exports = (host, LOG) => {
    var taskId = nconf.get("taskId");
    var token = nconf.get("token");

    return (token
        ? Promise.resolve(token)
        : getToken(host, LOG)
    ).then(token => {
        return request({
            url: `http://${host}/acquisition/export/dump/${taskId}`,
            headers: util.tokenHeader(token)
        }).on("error", throwError)
          .on("request", () => LOG(`requesting raws for task ${taskId}...`))
          .on("response", response => {
            //if unautherized
            if(response.statusCode == 401)
                throw new Error("Token is invalid");
          })
    })
};
