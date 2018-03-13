var subs = new Array();
var API_KEY = '';

// http makes an HTTP request and calls callback with parsed JSON.
var http = function (method, url, body, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (xhr.status >= 400) {
      // notify('API request failed');
      console.log('XHR failed', xhr.responseText);
      return;
    }
    cb(JSON.parse(xhr.responseText));
  };
  xhr.send(body);
};

// Fetch the API key from config.json on extension startup.
http('GET', chrome.runtime.getURL('config.json'), '', function (obj) {
  API_KEY = obj.key;
  document.dispatchEvent(new Event('config-loaded'));
});

// detect makes a Cloud Vision API request with the API key.
var translate = function (text, cb) {
console.log(API_KEY);
  var url = 'https://translation.googleapis.com/language/translate/v2?key=' + API_KEY;
  var data = {
    q: text,
    target: 'en',
    format: 'text',
    source: 'cs',
    model: 'base',
    key: API_KEY
  };
  http('POST', url, JSON.stringify(data), cb);
};




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
             case "videoPaused":
                var lastSubId = subs[sender.tab.id].length -1;
                translate(subs[sender.tab.id][lastSubId], function(response) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        msg: "subtitleTranslated",
                        sub: response.data.translations[0].translatedText,
                        subId: lastSubId
                    });
                });

                // sendResponse({
                //     subtitleId: lastSubId,
                //     sub: subs[sender.tab.id][lastSubId],
                //     translatedSub: 'Thomas is an idiot'
                // })
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