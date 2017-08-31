var express = require("express");
var request = require("request");
var router = express;

var callWP = function(method, parameters, callback) {
    var headers, options;

    // Set the headers
    headers = {
        //'Content-Type': 'application/x-www-form-urlencoded'
    }

    // Configure the request
    options = {
        url: 'http://stream-tv-series.co/wp-json/' + parameters, //posts/' + postId,
        method: method,
        headers: headers
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            //console.log(JSON.parse(body));
            callback(JSON.parse(body));
        } else {
            console.error(error);
        }
    });
};

var getPostById = function(postId) {
    callWP('GET', 'posts/' + postId, function (response) {
        console.log(response)
    });
}

var findPostsByKey = function(key, resultsCount) {
    callWP('GET', 'posts?filter[s]=' + key + '&filter[posts_per_page]=' + (resultsCount ? resultsCount : 1), function (response) {
        console.log(response)
    });
}

getPostById(239967);

findPostsByKey('Thrones', 1);



