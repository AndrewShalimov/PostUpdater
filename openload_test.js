var fs = require('fs');
var openLoad = require('./openload');

fs.readFile('app_config.json', function processClientSecrets(err, content) {
    if (err) {
        logger.error('Error configuration file: ' + err);
        return;
    }
    config = JSON.parse(content);
    startMain();
});

function  startMain() {
    openLoad.remoteUpload("bad_link" );
}

