var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ json: false, timestamp: function() { return formatDate(new Date()); } }),
        new winston.transports.File({ filename: __dirname + '/app.log', json: false })
    ],
    exceptionHandlers: [
        new (winston.transports.Console)({ json: false, timestamp: function() { return formatDate(new Date()); } }),
        new winston.transports.File({ filename: __dirname + '/exceptions.log', json: false })
    ],
    exitOnError: false
});

module.exports = logger;

function formatDate(date) {
    var monthNames = [
        "January", "February", "March",
        "April", "May", "June", "July",
        "August", "September", "October",
        "November", "December"
    ];

    var day = date.getDate();
    var monthIndex = date.getMonth();
    var year = date.getFullYear();

    return twoDigitsFormatter(day) + '-' + monthNames[monthIndex] + '-' + year + "-" + twoDigitsFormatter(date.getHours()) + ":" + twoDigitsFormatter(date.getUTCMinutes()) + ":" + twoDigitsFormatter(date.getSeconds());
}

function twoDigitsFormatter(myNumber) {
    return ("0" + myNumber).slice(-2);
}
