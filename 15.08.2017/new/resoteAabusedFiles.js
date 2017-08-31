var inbox = require("inbox");
var htmlToText = require('html-to-text');
var mimeLib = require("mimelib");
var googleReader = require('./googleSheetReader');
var openLoad = require('./openload');
var fs = require('fs');
var wpAPI = require( 'wpapi' );
var logger = require('./log');
const emailSender = require('emailjs');

var config;
var counter = 0;
var catalogBase = [];
var mailClient;
var wp;
var readyToNextFile = true;
var uploadLinks = [];
var successPosts = [];
var abusesList = [];
var failedFileNames = [];

fs.readFile('app_config.json', function processClientSecrets(err, content) {
    if (err) {
        logger.error('Error configuration file: ' + err);
        return;
    }
    config = JSON.parse(content);
    startMain();
});



function getFilesListFromEmailMessage(message) {
    if (!message) {
        return;
    }
    var messageStream = mailClient.createMessageStream(message.UID);
    //mark this message a 'seen'
    mailClient.addFlags(message.UID, ["\\Seen"], function(err, flags) { });
    //move message to Processed folder
    mailClient.moveMessage(message.UID, config.mailServer.processedPath, function (err) {
        if (err) {
            logger.error("Error while moving message'" + message.messageId + "' to " + config.mailServer.processedPath);
        } else {
            logger.info("Moved message'" + message.messageId + "' to '" + config.mailServer.processedPath + "' successfully.");
        }
    });


    var messageBody = "";
    messageStream.on('data', function (buffer) {
        messageBody += buffer;
    });
    messageStream.on('end',function() {
        var textRaw = mimeLib.decodeQuotedPrintable(messageBody);
        //var patternStart = 'we recieved a DMCA Abuse Report for the following files which you uploaded:<br>\r\n';
        //var patternEnd = '\r\n<br>\r\nTherefore ';
        var patternStart = 'we recieved a DMCA Abuse Report for the following files which you uploaded:\r\n';
        var patternEnd = '\r\n\r\nTherefore ';
        var links = textRaw.slice(textRaw.indexOf(patternStart) + patternStart.length, textRaw.indexOf(patternEnd));

        var lines = links.split("\n");
        var filesInfo = new Array();
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            //var quoteStart = '</a>'
            //var quoteEnd = '<br>'
            var quoteStart = '\t';
            var quoteEnd = '\r\n';
            var endQuotePosition = line.indexOf(quoteEnd) > -1 ? line.indexOf(quoteEnd) : line.length;

            var textBetween = line.slice(line.indexOf(quoteStart) + quoteStart.length, endQuotePosition).trim();
            var link = line.slice(0, line.indexOf(quoteStart));
            var fileKey = line.replace(config.openLoad.linkPrefix, "");
            fileKey = fileKey.slice(0, fileKey.indexOf("/"));
            textBetween = textBetween.replace(/<wbr>/g, " ");
            textBetween = textBetween.replace(/ /g, "");
            filesInfo.push({"fileName": textBetween, "fileKey": fileKey});
            lines[i] = textBetween;
        }
        findDeletedFilesInDB(filesInfo);
    });
}


function processDmcaMailbox() {
    if(catalogBase.length == 1) {
        return;
    }
    if(!readyToNextFile) {
        return;
    }
    if (successPosts.length > 0) {
        var successPosts_toSend = successPosts.slice();
        successPosts = [];
        sendMail('Update success', successPosts_toSend.join('\n') );
    }


    logger.info("Checking Mailbox.");
    mailClient.openMailbox(config.mailServer.path, function (error, info) {
        if (error) {
            logger.error(error);
            throw error;
        }

        mailClient.listMessages((config.mailFilter.messagesToReadCount * -1), function (err, messages) {
            if (err) {
                logger.error(err);
                return;
            }

            for (var i = 0; i < messages.length; i++) {
                var messageToProcess = messages[i];
                if (isMessageSuitable(messageToProcess)) {
                    getFilesListFromEmailMessage(messageToProcess);
                    break;
                }
            }

        });
    });
}


function isMessageSuitable(message) {
    if (message.title.indexOf(config.mailFilter.subject) == -1) {
        return false;
    }

    //check if message was already seen
    if (!message.flags || message.flags.length == 0) {
        return true;
    }

    for (var i = 0; i < message.flags.length; i++) {
        if (message.flags[i].indexOf("Seen") > -1) {
            return false;
        }
    }
    return true;
}

function catalogBaseUpdater(filesList) {
    catalogBase = filesList.map(function(file) {return file[0];});
    readAbusesList();
}

function processAbuses(abusesListFromGoogle) {
    //for (var i = 0; i < abusesListFromGoogle.length; i++) {
    //    console.log(abusesListFromGoogle[i][0]);
    //}
    abusesList = abusesListFromGoogle.map(function(file) {return file[0];});
    restoreAbuseFile();
}

function readAbusesList() {
    googleReader.readAbusesList(processAbuses);
}

function restoreAbuseFile() {
    if (abusesList.length > 0) {
        var deletedFile = abusesList[0];
        abusesList.splice(0, 1);
        if (!deletedFile) {
            restoreAbuseFile();
        } else {
            findFileAtCatalog(deletedFile);
        }
    } else {
        goToFinish();
    }
}

function findFileAtCatalog(fileName) {
    var index = -1;
    for (var i = 0; i < catalogBase.length; i++) {
        if (catalogBase[i].indexOf(fileName) > -1) {
            index = i;
            break;
        }
    }
    var linkToUpload = catalogBase[index];
    if (index > -1) {
        var uploadLink = {
            "linkToUpload": linkToUpload,
            "fileKey": fileName
        };
        uploadLinks.push(uploadLink);
        logger.info("Restoring file: " + uploadLink.linkToUpload + ",  " + uploadLink.fileKey);
        openLoad.remoteUpload(uploadLink, wordPressUpdater);
        //wordPressUpdater(uploadLink.fileKey, "new_embed_link");
        //restoreAbuseFile();
    } else {
        var infoLine = "File '" + fileName + "' was not found in Catalog.";
        logger.info(infoLine);
        failedFileNames.push(infoLine);
        restoreAbuseFile();
    }

}

function goToFinish() {
    logger.info("--------------------------------- Finish!");
    sendMail('Files restored successfully:', successPosts.join('\n'));
    sendMail('Files failed:', failedFileNames.join('\n'));
    //process.exit();
}

function refreshCatalog() {
    googleReader.updateKnownFilesList(catalogBaseUpdater);
}

function findDeletedFilesInDB(filesInfo) {
    var uploadLink = "";
    uploadLinks = [];
    var failedFileNames = [];
    for (var i = 0; i < filesInfo.length; i++) {
        var fileName = filesInfo[i].fileName;
        var index = -1;
        for (var ii = 0; ii < catalogBase.length; ii++) {
            if (catalogBase[ii].indexOf(fileName) > -1) {
                index = ii;
                break;
            }
        }
        if (index > -1) {
            uploadLinks.push({"linkToUpload" : catalogBase[index],
                               "fileKey" : filesInfo[i].fileKey
            });
        } else {
            failedFileNames.push(fileName);
        }
    }
    processFailedNames(failedFileNames);
    setInterval(processSuccessLinks, 1000);
}

function processFailedNames(failedFileNames) {
    if(!failedFileNames || failedFileNames.length == 0) {
        return;
    }
    logger.info('----------------------- Failed file names:');
    failedFileNames.forEach(function (name) {
        logger.info("Failed file: " + name);
    });

    sendMail('Failed file names list', 'Next files are failed to recover:\n' + failedFileNames.join('\n'));
}

function processSuccessLinks() {
    if(!uploadLinks || uploadLinks.length == 0) {
        return;
    }
    if (!readyToNextFile) {
        return;
    }
    var uploadLink = uploadLinks[0];
    uploadLinks.splice(0, 1);
    readyToNextFile = false;
    openLoad.remoteUpload(uploadLink, wordPressUpdater);
}

function wordPressUpdater(fileKeyForSearch, newEmbedLink, error) {
    if (error) {
        failedFileNames.push(infoLine);
        restoreAbuseFile();
        return;
    }
    wp.posts()
        .param('context', 'edit')
        .search(fileKeyForSearch)
        .perPage(1)
        .get()
        .then(function (posts) {
            if (posts.length == 0) {
                var infoLine = "Post with key '" + fileKeyForSearch + "' was NOT found in WordPress.";
                logger.info(infoLine);
                failedFileNames.push(infoLine);
                restoreAbuseFile();
                return;
            } else {
                updatePost(posts[0], newEmbedLink, fileKeyForSearch);
            }
        },
        function (err) {
            logger.error(err);
            restoreAbuseFile();
        }
    );
}


function updatePost(post, newEmbedLink, fileKeyForSearch) {
    backupContent(post.content.raw, post.id);
    var newContent = post.content.raw;
    var postId = post.id;
    var oldEmbedLink = newContent.slice(newContent.indexOf('<iframe'), newContent.indexOf('</iframe>'));
    newContent = newContent.replace(oldEmbedLink, newEmbedLink);

    //var infoLine = "File '" + fileKeyForSearch + "' restored OK. PostID: " + postId;
    //logger.info(infoLine);
    //successPosts.push(infoLine);
    //restoreAbuseFile();

    wp.posts().id(postId).update({
        content: newContent
    }).then(
        function (response) {
            var infoLine = "File '" + fileKeyForSearch + "' restored OK. PostID: " + postId;
            logger.info(infoLine);
            successPosts.push(infoLine);
            restoreAbuseFile();
            return;
        },
        function (error) {
            logger.error(error);
            failedFileNames.push("Failed to update WordPress post. PostID: " + postId + ", file name: '" + fileKeyForSearch + "'. " + error);
            restoreAbuseFile();
        });
}


function sendMail(subject, text, callback) {
    var server = emailSender.server.connect({
        user: config.mailServer.user,
        password: config.mailServer.password,
        host: config.mailServer.smtp.address,
        ssl: true
    });

    server.send({
        text:    text,
        from:    '"Files recover script" <' + config.mailServer.user + '>',
        to:      config.mailServer.adminRecipients.join(),
        subject: subject
    }, function (err, message) {
        if (err) {
            logger.error(err);
        } else {
            if(callback) {
                callback;
            };
        }
    });

}

function backupContent(content, postId) {
    try {
        fs.writeFileSync('./backUpPosts/' + postId + '.txt', content);
    } catch (e) {
        logger.error(e);
    }
}

function startMain() {
    try {
        mailClient = inbox.createConnection(false, config.mailServer.address, {
            secureConnection: true,
            auth: {
                user: config.mailServer.user,
                pass: config.mailServer.password
            }
        });
    } catch (e) {
        logger.error(e);
        process.exit();
    }

    wp = new wpAPI({
        endpoint: config.wordPress.endpoint,
        username: config.wordPress.user,
        password: config.wordPress.password
    });

    //mailClient.on("connect", function () {
    //    // processDmcaMailbox();
    //});
    //mailClient.on("new", function(message){
    //    processDmcaMailbox();
    //});


    //processFailedNames(["111111", "222222222222",
    //    "co/embed/_9ZLfapaSx4/Letterkenny_s01e01.mkv.mp4",
    //    "onMouseOver=posTabsShowLinks(TheVid return true"]);

    //testParser('<p><ul id=\'postTabs_ul_241259\' class=\'postTabs\' style=\'display:none\'>\n<li id=\'postTabs_li_0_241259\' class=\'postTabs_curr\'><a  id="241259_0" onMouseOver="posTabsShowLinks(\'TheVid\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>TheVid</a></li>\n<li id=\'postTabs_li_1_241259\' ><a  id="241259_1" onMouseOver="posTabsShowLinks(\'TheVid\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>TheVid</a></li>\n<li id=\'postTabs_li_2_241259\' ><a  id="241259_2" onMouseOver="posTabsShowLinks(\'Vidup\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>Vidup</a></li>\n<li id=\'postTabs_li_3_241259\' ><a  id="241259_3" onMouseOver="posTabsShowLinks(\'Vidup\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>Vidup</a></li>\n<li id=\'postTabs_li_4_241259\' ><a  id="241259_4" onMouseOver="posTabsShowLinks(\'Vshare\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>Vshare</a></li>\n<li id=\'postTabs_li_5_241259\' ><a  id="241259_5" onMouseOver="posTabsShowLinks(\'Openload\'); return true;"  onMouseOut="posTabsShowLinks();"  class=\'postTabsLinks\'>Openload</a></li>\n</ul>\n\n<div class=\'postTabs_divs postTabs_curr_div\' id=\'postTabs_0_241259\'>\n<span class=\'postTabs_titles\'><b>TheVid</b></span><br />\n<iframe src="https://thevideo.me/embed-g26ucyry5zc1.html" width="640" height="360" style="width:640px; height:360px;" frameborder="0" allowfullscreen></iframe><br />\n</div>\n\n<div class=\'postTabs_divs\' id=\'postTabs_1_241259\'>\n<span class=\'postTabs_titles\'><b>TheVid</b></span><br />\n<iframe src="https://thevideo.me/embed-9e64ci56vhpk.html" width="640" height="360" style="width:640px; height:360px;" frameborder="0" allowfullscreen></iframe><br />\n</div>\n\n<div class=\'postTabs_divs\' id=\'postTabs_2_241259\'>\n<span class=\'postTabs_titles\'><b>Vidup</b></span><br />\n<iframe width="640" height="360" src="http://vidup.me/embed-aahh2ngj7fm2.html" frameborder="0" allowfullscreen></iframe><br />\n</div>\n\n<div class=\'postTabs_divs\' id=\'postTabs_3_241259\'>\n<span class=\'postTabs_titles\'><b>Vidup</b></span><br />\n<iframe width="640" height="360" src="http://vidup.me/embed-3wdelnlvspij.html" frameborder="0" allowfullscreen></iframe><br />\n</div>\n\n<div class=\'postTabs_divs\' id=\'postTabs_4_241259\'>\n<span class=\'postTabs_titles\'><b>Vshare</b></span><br />\n<iframe src="http://vshare.eu/embed-f7e2v9v7vwld-520x360.html" frameborder=0 marginwidth=0 marginheight=0 scrolling=no width=520 height=360></iframe><br />\n</div>\n\n<div class=\'postTabs_divs\' id=\'postTabs_5_241259\'>\n<span class=\'postTabs_titles\'><b>Openload</b></span><br />\n<iframe src="https://openload.co/embed/JinHdmgLwe4/" scrolling="no" frameborder="0" width="520" height="360" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe></p>\n</div>\n\n');

    //wordPressUpdater(
    //    '_9ZLfapaSx4',
    //    '<iframe test="test" src="https://openload.co/embed/_9ZLfapaSx4/Letterkenny_s01e01.mkv.mp4" scrolling="no" frameborder="0" width="700" height="430" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>'
    //);

    //openLoad.remoteUploadStatus("77577822");
    //console.log(formatDate(new Date()));

    //backupContent('[tab:Openload]\n' +
    //              '<iframe src="https://openload.co/embed/_9ZLfapaSx4/Letterkenny_s01e01.mkv.mp4" scrolling="no" frameborder="0" width="700" height="430" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>\n' +
    //              '[tab:TheVid]\n' +
    //              'Letterkenny s01e01<br/> <iframe src="https://thevideo.me/embed-enegyk1zfmnd.html" width="640" height="360" style="width:640px; height:360px;" frameborder="0" allowfullscreen></iframe>\n' +
    //              '[tab:Thevid]\n' +
    //              '<iframe width="600" height="360" src="http://thevideo.me/embed-96xpnc5nsl9o.html" frameborder="0" allowfullscreen></iframe>\n' +
    //              '[tab:Vidup]"', '124163');



    refreshCatalog();
    //readAbusesList();

    //  setInterval(refreshCatalog, config.refreshDB_interval_sec * 1000);
//    setInterval(processDmcaMailbox, config.checkEmail_interval * 1000);

    //openLoad.remoteUpload({'linkToUpload': 'https://openload.co/f/PNY14r8BS1E/Letterkenny_S02E06_-_Finding_Stormy_a_Stud.mov.mp4',
    //                        'fileKey': 'test_file_fey'}, testUpload);
}
//
//function testUpload(fileKeyForSearch, newEmbedLink) {
//    console.log(fileKeyForSearch);
//    console.log(newEmbedLink);
//}


function wait(ms) {
//logger.info("-------- before wait.")
    var start = new Date().getTime();
    var end = start;
    while (end < start + ms) {
        end = new Date().getTime();
    }
//logger.info("-------- after wait.")
}


