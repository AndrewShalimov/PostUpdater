var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var xhr = new XMLHttpRequest();
var readLine = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var config = readConfig();
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
var googleClient = authorize();

function readConfig() {
    var conf = {};
    try {
        var content = fs.readFileSync('app_config.json');
        conf = JSON.parse(content);
    } catch (e) {
        logger.error(e);
    }
    return conf;
}

function authorize() {
    var clientSecret = config.installed.client_secret;
    var clientId = config.installed.client_id;
    var redirectUrl = config.installed.redirect_uris[0];

    var auth = new googleAuth();
    var client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    var token = fs.readFileSync(TOKEN_PATH);
    client.credentials = JSON.parse(token);
    return client;
}

function writeData(accessToken) {
    //write to A2 to A3
    console.log("----------------------- accessToken: " + accessToken);
    var params = {
        "range": "Sheet1!B18:B18",
        "majorDimension": "ROWS",
        "values": [
            ["UFC"]
        ]
    };
    var xhr = new XMLHttpRequest();
    //'https://sheets.googleapis.com/v4/spreadsheets/' + config.testSheetId + 'spreadsheetId/values/Sheet1!B18:B18?valueInputOption=USER_ENTERED'
    xhr.open('PUT', 'https://sheets.googleapis.com/v4/spreadsheets/' + config.testSheetId + 'spreadsheetId/values/Sheet1!B18:B18?valueInputOption=USER_ENTERED');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onreadystatechange = function (data) {
        console.log(data);
        if (xhr.readyState == 4) {
            var responseResult = xhr.responseXML;
            console.log(xhr);

        }
    };
    xhr.send(JSON.stringify(params));
}

function updateCells(auth) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.update({
        auth: auth,
        valueInputOption: 'USER_ENTERED',
        spreadsheetId: config.testSheetId,
        range: 'Sheet1!B18:B18',
        resource: '1111111111111111'
    }, function (err, response) {
        if (err) {
            console.error('The API returned an error: ' + err);
        }
        console.log(response);
    });
}

console.log(googleClient);
updateCells(googleClient);

//console.log(googleClient);
//writeData(googleClient.credentials.access_token);