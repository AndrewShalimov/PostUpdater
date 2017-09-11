var fs = require('fs');
var readLine = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var logger = require('./log');
var tabMode = 'openload';

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

var googleConfig = {};

module.exports.updateKnownFilesList = updateKnownFilesList;
module.exports.readAbusesList = readAbusesList;
module.exports.getPostsData = getPostsData;
module.exports.updateCell = updateCell;

function updateKnownFilesList(catalogBaseUpdater) {
    fs.readFile('app_config.json', function processClientSecrets(err, content) {
        if (err) {
            logger.error('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        googleConfig = JSON.parse(content);
        authorize(googleConfig, listFiles, catalogBaseUpdater, googleConfig.catalog.sheetId,
                                                               googleConfig.catalog.sheetName,
                                                               googleConfig.catalog.range);
    });
}

function readAbusesList(readAbusesList) {
    fs.readFile('app_config.json', function processClientSecrets(err, content) {
        if (err) {
            logger.error('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        googleConfig = JSON.parse(content);
        authorize(googleConfig, listFiles, readAbusesList, googleConfig.abuses.sheetId,
                                                           googleConfig.abuses.sheetName,
                                                           googleConfig.abuses.range);
    });
}

function getPostsData(getPostsData_callback) {
    process.argv.forEach(function (val, index, array) {
        if (val.toLowerCase().indexOf('tabmode=') > -1) {
            tabMode = val.split('=')[1].toLowerCase();
        }
    });

    fs.readFile('app_config.json', function processClientSecrets(err, content) {
        if (err) {
            logger.error('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        googleConfig = JSON.parse(content);
        authorize(googleConfig, listFiles, getPostsData_callback, googleConfig.postsUpdate[tabMode].sheetId,
                                                                  googleConfig.postsUpdate[tabMode].sheetName,
                                                                  googleConfig.postsUpdate[tabMode].range);
    });
}


function updateCell(updateInfo) {

    //sheetName, range, value
    fs.readFile('app_config.json', function processClientSecrets(err, content) {
        if (err) {
            logger.error('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        googleConfig = JSON.parse(content);
        authorize(googleConfig, updateGoogleCell, updateInfo);
    });
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, catalogBaseUpdater, sheetId, sheetName, range) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback, catalogBaseUpdater, sheetId, sheetName, range);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client, catalogBaseUpdater, sheetId, sheetName, range);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback, catalogBaseUpdater, sheetId, sheetName, range) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    logger.info('Authorize this app by visiting this url: ', authUrl);
    var rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                logger.error('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client, catalogBaseUpdater, sheetId, sheetName, range);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    logger.info('Token stored to ' + TOKEN_PATH);
}

/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
function listFiles(auth, callback, sheetId, sheetName, range) {
    logger.info("Start reading '" + sheetName  + "' spreadsheet.")
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: sheetId,
        range: sheetName + '!' + range
    }, function(err, response) {
        if (err) {
            logger.error('The API returned an error: ' + err);
            return;
        }
        var rows = response.values;
        if (!rows || rows.length == 0) {
            logger.error('--------------------- !!!!!!!!!!!!!!! No data found !!!!!!!!!!!!!!!! -------------------------------');
            logger.error("---- SheetID: '" + sheetId + "', SheetName: '" + sheetName + "', Range: '" + range + "'");
            logger.error('--------------------------------------- Finish -----------------------------------------------------');
            process.exit();
        } else {
            logger.info("'" + sheetName  + "' spreadsheet been read OK.")
            callback(rows);
        }
    });
}

function updateGoogleCell(auth, updateInfo) {
    logger.info("Updating " + updateInfo.sheetName)
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.update({
        auth: auth,
        valueInputOption: 'USER_ENTERED',
        spreadsheetId: updateInfo.sheetId,
        range: updateInfo.range,
        resource: {range: 'Sheet1!B19',
            majorDimension: 'ROWS',
            values: [['111111111']]}
    }, function(err, response) {
        if (err) {
            logger.error('The API returned an error: ' + err);
        }
    });
}