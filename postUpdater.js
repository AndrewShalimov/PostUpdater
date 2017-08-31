var inbox = require("inbox");
var htmlToText = require('html-to-text');
var mimeLib = require("mimelib");
var googleReader = require('./googleSheetReader');
var openLoad = require('./openload');
var fs = require('fs');
var wpAPI = require( 'wpapi' );
var logger = require('./log');
const emailSender = require('emailjs');
var http = require('request');

var config;
var counter = 0;
var mailClient;
var wp;
var postsData = [];
var successPosts = [];
var failedFileNames = [];
var tabMode = 'openload';


fs.readFile('app_config.json', function processClientSecrets(err, content) {
    if (err) {
        logger.error('Error configuration file: ' + err);
        return;
    }
    config = JSON.parse(content);
    process.argv.forEach(function (val, index, array) {
        console.log(index + ': ' + val);
        if (val.toLowerCase().indexOf('tabmode=') > -1) {
            tabMode = val.split('=')[1].toLowerCase();
        }
    });
    startMain();
});


function getPostsNewData() {
    googleReader.getPostsData(processPostsUpdate);
}

function processPostsUpdate(postsDataFromSheet) {
    postsData = postsDataFromSheet.map(function(post) {return {"iFrame":post[0], "link":post[1], "postID": 0, "content": "", "complete": false};});
    for (var i = 0; i < postsData.length; i++) {
        //console.log(postsData[i].iFrame + "  " + postsData[i].link + "  " + postsData[i].postID);
    }
    var links = postsDataFromSheet.map(function(post) {return post[1];});

    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var requestData = {
            method: 'GET',
            uri: link,
            timeout: 1000
        };
        http.get(
            requestData,
            function (error, response, body) {
                //if (!error && response.statusCode == 200) {
                    putContent(this.uri.href, body);
                //}
            }
        );
    }



    //async.eachSeries(links, function iteratee(item, putContent) {
    //    //if (inCache(item)) {
    //    //    async.setImmediate(function() {
    //    //        callback(null, cache[item]);
    //    //    });
    //    //} else {
    //    //    doSomeIO(item, callback);
    //    //    //...
    //    //}
    //
    //});
}

function putContent(key, content) {
    //console.log("key:" + JSON.stringify(key));
    //console.log("key:" + key);
    //console.log("content:" + content);
    var contentItem = postsData.filter(function ( obj ) {
        return obj.link === key;
    })[0];
    contentItem.content = content;
    var pattern = "var postTabs = ";
    var startIndex = content.indexOf(pattern) + pattern.length;
    var postTabs = "";
    for (var endIndex = startIndex; endIndex < content.length; endIndex++) {
        if (content[endIndex] == "\n") {
            postTabs = content.slice(startIndex, endIndex - 1);
            break;
        }
    }
    //console.log(JSON.parse(postTabs).post_ID + "; " + key);
    var contentItemIndex = postsData.indexOf(contentItem);
    var embedLink = "";
    if (tabMode == "openload") {
        embedLink = "[tab:Openload]" + "\n" + contentItem.iFrame + "\n";
    } else {
        embedLink = "[tab:TheVid]" + "\n" + contentItem.iFrame + "\n";
    }
    var postID = JSON.parse(postTabs).post_ID;
    wordPressUpdater(Number(postID), embedLink, "", contentItemIndex);
}


function checkForComplete() {
    if (postsData.length == 0) {
        return;
    }
    for (var i = 0; i < postsData.length; i++) {
        if(!postsData[i].complete) {
            return;
        }
    }
    goToFinish();
}

function goToFinish() {
    if (successPosts.length > 0) {
        sendMail('Posts updated OK', successPosts.join('\n'));
    }
    if (failedFileNames.length > 0) {
        sendMail('Posts failed', failedFileNames.join('\n'), ex);
    }
}

function ex() {
    logger.info("--------------------------------- Finish!");
    process.exit();
}

function wordPressUpdater(postId, newEmbedLink, error, contentIndex) {
    if (error) {
        logger.info(error);
        failedFileNames.push(error);
        postsData[contentIndex].complete = true;
        return;
    }

    wp.posts()
        .param('context', 'edit')
        .id(postId)
        .perPage(1)
        .get()
        .then(function (post) {
            if (post) {
                updatePost(post, newEmbedLink, contentIndex);
            } else {
                var infoLine = "Post with ID " + postId + " was NOT found in WordPress.";
                logger.info(infoLine);
                failedFileNames.push(infoLine);
                postsData[contentIndex].complete = true;
                return;
            }
        },
        function (err) {
            logger.error(err);
            postsData[contentIndex].complete = true;
        }
    );
}

function updatePost(post, newEmbedLink, contentIndex) {
    backupContent(post.content.raw, post.id);
    var newContent = post.content.raw;
    var postId = post.id;
    newContent = newEmbedLink + newContent;
postsData[contentIndex].complete = true;
console.log(newContent);
    //wp.posts().id(postId).update({
    //    content: newContent
    //}).then(
    //    function (response) {
    //        var infoLine = "Post " + postId + " updated OK.";
    //        logger.info(infoLine);
    //        successPosts.push(infoLine);
    //        postsData[contentIndex].complete = true;
    //        return;
    //    },
    //    function (error) {
    //        logger.error(error);
    //        failedFileNames.push("Failed to update WordPress post. PostID: " + postId + ". " + error);
    //        postsData[contentIndex].complete = true;
    //    });
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
        from:    '"Posts updater  script" <' + config.mailServer.user + '>',
        to:      config.mailServer.adminRecipients.join(),
        subject: subject
    }, function (err, message) {
        if (err) {
            logger.error(err);
        }
        if(callback) {
            callback;
        };
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

    getPostsNewData();
    setInterval(checkForComplete, 1000);
}




