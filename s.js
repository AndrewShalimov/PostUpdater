var inbox = require("inbox");
var htmlToText = require('html-to-text');
var mimeLib = require("mimelib");

var mailServer = {
    "address" : "imap.gmail.com",
    "user" : "shalimandr@gmail.com",
    "password" : "PeremikAndrew8888",
    "path": "[Gmail]/&BBIEQQRP- &BD8EPgRHBEIEMA-"
};

var videoHost = {
    "address" : "https://openload.co/account",
    "user" : "sergeeva.kh@gmail.com",
    "password" : "3055710422"

}


var counter = 0;
//var knownAddressPattern = "dmca@openload.co";

var mailFilter = {
    "from": "sergeeva.kh@gmail.com",
    "subject" : "Your file(s) on openload got deleted due to a DMCA report"
}

var client = inbox.createConnection(false, mailServer.address, {
    secureConnection: true,
    auth: {
        user: mailServer.user,
        pass: mailServer.password
    }
});

client.connect();

client.on("connect", function () {
    checkMailbox();
   // client.listMailboxes(function(error, mailboxes){
   //     for(var i=0, len = mailboxes.length; i<len; i++){
   //         if(mailboxes[i].hasChildren){
   //             mailboxes[i].listChildren(function(error, children){
   //                 console.log(children);
   //             });
   //         }
   //     }
   // });
});


function getMessage(uid, callback) {
    client.listMessagesByUID(uid, uid, callback);
}


function doFilesRestore(message) {
    //check if message was already seen
    //client.removeFlags(message.UID, ["\\Seen"], function(err, flags){
    //    //console.log("Current flags for a message: ", flags);
    //});
    if (message.flags && message.flags.length > 0) {
        for (var i = 0; i < message.flags.length; i++) {
            if (message.flags[i].indexOf("Seen") > -1) {
                return;
            }
        }
    }
    client.addFlags(message.UID, ["\\Seen"], function(err, flags){
        //console.log("Current flags for a message: ", flags);
    });

    var messageStream = client.createMessageStream(message.UID)
    console.log("(" + (counter++) + ")------------------------- message :\n");
    //messageStream.pipe(process.stdout, {end: false});

    var messageBody  = "";
    messageStream.on('data', function (buffer) {
        //var part = buffer.read().toString();
        //message += part;
        //console.log('stream data ' + part);
        messageBody += buffer;
        //messageBody += buffer.toString('utf8');
        //var temp = buffer.toString('utf8').replace(/\n/g, "").replace(/\r/g, "");
        //messageBody += buffer.toString('utf8');
        //messageBody += temp;
    });
    messageStream.on('end',function() {
        //messageBody = messageBody.replace(htStr /g, /\r\n/g );
        //messageBody = messageBody.replace(/https:/g, "\r\nhttps:");
        //messageBody = messageBody.replace(/Therefore we had to disable access to these links/g, "\r\nTherefore we had to disable access to these links");
        //var text = htmlToText.fromString(messageBody, {
        //    wordwrap: 80,
        //    ignoreImage: true
        //});
        var textRaw = mimeLib.decodeQuotedPrintable(messageBody);
        //console.log(textRaw);
        //console.log('------------------------------------------------------------------------------------------------------------------');
        var patternStart = 'we recieved a DMCA Abuse Report for the following files which you uploaded:<br>\r\n';
        var patternEnd = '\r\n<br>\r\nTherefore ';
        var links = textRaw.slice(textRaw.indexOf(patternStart) + patternStart.length, textRaw.indexOf(patternEnd));
        //console.log(links);
        var lines = links.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var quoteStart = '</a>'
            var quoteEnd = '<br>'
            //line = line.slice(0, line.indexOf(pattern));
            //lines[i] = line;
            var textBetween = line.slice(line.indexOf(quoteStart) + quoteStart.length, line.indexOf(quoteEnd)).trim();
            textBetween = textBetween.replace(/<wbr>/g, " ");
            textBetween = textBetween.replace(/ /g, "");
            lines[i] = textBetween;
            console.log(lines[i]);
        }

        //console.log('------------------------------------------------------------------------------------------------------------------');
        //var textResult = htmlToText.fromString(links, {
        //    wordwrap: false,
        //    ignoreImage: true
        //});
        //console.log(textResult);
        //console.log('------------------------------------------------------------------------------------------------------------------');
        //var lines = textResult.split("\n");
        //for (var i = 0; i < lines.length; i++) {
        //    var line = lines[i];
        //    var pattern = ' ['
        //    //line = line.slice(0, line.indexOf(pattern));
        //    //lines[i] = line;
        //    var textBetweenBrackets = line.slice(line.indexOf('['), line.indexOf(']') + 1);
        //    line = line.replace(textBetweenBrackets, '');
        //    lines[i] = line + ":::";
        //    console.log(lines[i]);
        //}
    });
}


function checkMailbox() {
    //console.log("----- Checking mailbox : " + counter++);
    client.openMailbox(mailServer.path, function (error, info) {
        if (error) throw error;

        client.listMessages(-30, function (err, messages) {
            messages.forEach(function (message) {
                //console.log(message.UID + ": " + message.title);
                if (message.title.indexOf(mailFilter.subject) > -1) {
                    doFilesRestore(message);
                }
            });
        });

        //var emailSearchQuery = {
        //    //unseen: false,
        //    header: ["subject", "issues with Icebox B5537"]
        //    //header: ["from:address", mailFilter.from]
        //    //header: ["from", "iceboxauto@yahoo.co.uk"]
        //
        //    //from : {
        //    //    address: mailFilter.from
        //    //}
        //};

        //client.search(emailSearchQuery, function (err, messages) {
        //    if (messages && messages.length > 0) {
        //        messages.forEach(function (uid) {
        //            client.listMessagesByUID(uid, uid, function (message) {
        //                console.log(message.UID + ": " + message.title);
        //            });
        //            //if (message.title.indexOf(knownAddressPattern) > -1) {
        //            //    doFilesRestore();
        //            //}
        //        });
        //    }
        //});

    });
}



//setInterval(checkMailbox, 4 * 1000);




