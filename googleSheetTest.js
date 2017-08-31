var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var xhr = new XMLHttpRequest();
var readLine = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
//var config = readConfig();
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

var googleReader = require('./googleSheetReader');

var googleClient;

function readConfig() {
    var conf = {};
    try {
        var content = fs.readFileSync('app_config.json');
        conf = JSON.parse(content);
    } catch (e) {
        console.error(e);
    }
    return conf;
}

function setClient(client) {
    googleClient = client;
}

function authorize() {
    var clientSecret = config.installed.client_secret;
    var clientId = config.installed.client_id;
    var redirectUrl = config.installed.redirect_uris[0];

    var auth = new googleAuth();
    var client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    var token;
    try {
        token = fs.readFileSync(TOKEN_PATH);
    } catch (err) {
        //console.log(err);
        token = getNewToken(client);
    }

    //client.credentials = JSON.parse(token);
    //return client;
}

function getNewToken(client) {
    var authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        client.getToken(code, function(err, token) {
            if (err) {
                console.error('Error while trying to retrieve access token', err);
                return;
            }
            client.credentials = token;
            storeToken(token);
            setClient(client);
        });
    });
}

function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
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
    xhr.open('PUT', 'https://sheets.googleapis.com/v4/spreadsheets/1uMwMi6K312STQoBfS3sEkmqdaHdwiVBnPAUp6o_24vE/values/Sheet1!B18:B19?valueInputOption=USER_ENTERED');
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
        range: 'Sheet1!B18:B19',
        resource: '1111111111111111'
    }, function (err, response) {
        if (err) {
            console.error('The API returned an error: ' + err);
        }
        console.log(response);
    });
}

//authorize();
//console.log(googleClient);
//updateCells(googleClient);

//console.log(googleClient);

function ttt() {

}

googleReader.updateKnownFilesList(writeData('ya29.GluoBIatjuIpW1Lbzyp7z9IWQhkB5DLIFAl9c59JbhXCkxLXyF_D-5F25mUsVRFQuIKNxxnH4M2I-cjANkVBdj1WuHqYy-FEKQLvm8_iZgkvjQm5Ga5DL8HsTkjF'));

function googleUpdater() {
    googleReader.updateCell(
        {
            "sheetId": "1uMwMi6K312STQoBfS3sEkmqdaHdwiVBnPAUp6o_24vE",
            "sheetName": "Sheet1",
            "range": "Sheet1!B18:B19",
            "data": "1111111"
        }
    );
}
//googleReader.readAbusesList(null);