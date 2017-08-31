var fs = require('fs');
const openLoad = require('node-openload');
var logger = require('./log');

var ol;

fs.readFile('app_config.json', function loginToOpenLoad(err, content) {
    if (err) {
        logger.error('Error loading application config: ' + err);
        return;
    }
    var conf = JSON.parse(content);
    ol = openLoad({
        api_login: conf.openLoad.API_login,
        api_key: conf.openLoad.API_Key
    });
});

module.exports.remoteUpload = remoteUpload;
module.exports.remoteUploadStatus = remoteUploadStatus;

var callBackFunction;

function remoteUpload(uploadInfo, callback) {
    callBackFunction = callback;
    var fileInfo = uploadInfo;
    logger.info("Uploading file to OpenLoad: '" + uploadInfo.linkToUpload + "'");
    try {
        ol.remoteUpload({
            url: uploadInfo.linkToUpload
        }).then(function (data) {
                remoteUploadStatus(data.id, fileInfo);
            },
            function (err) {
                logger.error(err);
                callBackFunction("", "", "Error upload link '" + uploadInfo.linkToUpload + "' to OpenLoad:" + err);
            });
    } catch (e) {
        logger.error(e);
        callBackFunction("", "", "Error upload link '" + uploadInfo.linkToUpload + "' to OpenLoad:" + e);
    }
}

//function onUploadSuccess(data) {
//    var uploadId = data.id;
//    logger.info(data.id);
//    remoteUploadStatus(uploadId);
//    //ol.getFileInfo(data.id).then(getFileInfo, onUploadReject);
//}
//
//function onUploadReject(data) {
//    logger.error(data);
//}

//function getFileInfo(fileInfo) {
////77577822
//    logger.error(fileInfo);
//}

function remoteUploadStatus(uploadId, fileInfo) {
    ol.remoteUploadStatus({
        id: uploadId
    }).then(function(uploadedFileInfo) {
        logger.info("'" + fileInfo.linkToUpload + "' uploaded  successfully.");
        var embedLink = generateEmbedLink(uploadedFileInfo);
        callBackFunction(fileInfo.fileKey, embedLink);
    }, function(err) {
        logger.error(err);
        callBackFunction("", "", "Error: " + err);
    });
}

function generateEmbedLink(uploadedFileInfo) {
    var extId = uploadedFileInfo[Object.keys(uploadedFileInfo)[0]].extid;
    var added = uploadedFileInfo[Object.keys(uploadedFileInfo)[0]].added;
    var remoteUrl = uploadedFileInfo[Object.keys(uploadedFileInfo)[0]].remoteurl;
    var fileName = remoteUrl.slice(remoteUrl.lastIndexOf('/') + 1, remoteUrl.length);
    var embedLink = '<iframe src="https://openload.co/embed/' + extId + '/' + fileName + '" scrolling="no" frameborder="0" width="700" height="430" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>';
    return embedLink;

}