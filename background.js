var subs = new Array();

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
    console.log(request);
      console.log(sender.tab ?
                  "from a content script:" + sender.tab.url :
                  "from the extension");

        switch(request.msg) {
            case "newSubTitle":
                console.log("background js received message for new SubTitle");
                var newSub = addSubtitle(request.sub, sender.tab.id);
                publishSub(sender.tab.id, newSub);
                break;
        }
    });


function addSubtitle(sub, tabId) {
    var tabSubs = subs[tabId];
    if (tabSubs) {
        tabSubs.push(sub);
    } else {
        tabSubs = new Array({sub});
        subs[tabId] = tabSubs;
    }
    console.log(subs);

    return sub;
}

function publishSub(tabId, sub) {
    chrome.tabs.sendMessage(tabId, {
        msg: "subtitlePublished",
        sub: sub
    });
}

function processSub(sub) {
    return sub;
}