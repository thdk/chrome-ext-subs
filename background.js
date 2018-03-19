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
    console.log("start request to translate: " + text);
  var url = 'https://translation.googleapis.com/language/translate/v2?key=' + API_KEY;
  var data = {
    q: text,
    target: 'en',
    format: 'text',
    source: 'cs',
    model: 'nmt',
    key: API_KEY
  };
  http('POST', url, JSON.stringify(data), cb);
};

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(request);
        console.log(request.subId);
      console.log(sender.tab ?
                  "from a content script:" + sender.tab.url :
                  "from the extension");

        switch(request.msg) {
            case "popupButtonClicked":
                switch(request.btnName) {
                    case "openPlayer":
                        broadcastActiveTabMessage({
                            msg: "openPlayer"
                        });
                        break;
                    case "saveSubtitles":
                        saveSubtitles();
                    break;
                }
            break;
            case "newSubTitle":
                var newSub = addSubtitle(request.sub, sender.tab.id);
                publishSub(sender.tab.id, newSub);
                break;
             case "videoPaused":
                console.log("video paused");
                break;
            case "translationRequested":
                var subId = request.subId ? request.subId : subs[sender.tab.id].subtitles.length -1;
                console.log("receiving sub with id " +  subId + " for tab: " + sender.tab.id);
                var subToTranslate = subs[sender.tab.id].subtitles.filter(s => s.id === subId)[0];
                translate(subToTranslate.subtitle, function(response) {
                    var translation = response.data.translations[0].translatedText;
                    sendResponse(translation);
                    subToTranslate.translation = translation;
                    chrome.tabs.sendMessage(sender.tab.id, {
                        msg: "subtitleTranslated",
                        sub: subToTranslate
                    });
                });
                return true;
            break;
            case "videoAvailable":
             chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.pageAction.show(tabs[0].id);
                chrome.pageAction.setPopup({tabId: tabs[0].id, popup:"popups/site.html"});
             });
                break;
            case "videoLoaded":
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.pageAction.show(tabs[0].id);
                chrome.pageAction.setPopup({tabId: tabs[0].id, popup:"popups/player.html"});
             });
            break;

        }
    });

function addSubtitle(subtitle, tabId) {
    var sub;
    var tabSubs = subs[tabId];
    if (tabSubs) {
        // if the sentence is not finished yet, add it to the last subtile
        var lastSub = tabSubs.subtitles[tabSubs.subtitles.length - 1];
        if (lastSub && !lastSub.subtitle.match(/[?.!]$/)) {
            lastSub.subtitle += " " + subtitle;
            sub = { subtitle: lastSub.subtitle, id: lastSub.id };
        } else {
            sub = {subtitle: subtitle, id: tabSubs.nextId};
            tabSubs.subtitles.push(sub);
            tabSubs.nextId ++;
        }
    } else {
        sub = {subtitle: subtitle, id: 0};
        tabSubs = new Array(sub);
        subs[tabId] = { subtitles: tabSubs, nextId: 1};
    }

    return sub;
}

function saveSubtitles() {
    var dump = "";
    subs.forEach(t => {
        t.subtitles.forEach(s => {
        if(s.translation)
            dump += s.subtitle + "\t" + s.translation + "\n";
        });
    });

    copyToClipboard(dump);

    chrome.runtime.sendMessage({
        msg: "subtitlesSaved",
    });
}

function publishSub(tabId, sub) {
    chrome.tabs.sendMessage(tabId, {
        msg: "subtitlePublished",
        sub: sub,
    });
}

function broadcastActiveTabMessage(msg) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, msg);
      });
}

function processSub(sub) {
    return sub;
}

// Copies a string to the clipboard. Must be called from within an
// event handler such as click. May return false if it failed, but
// this is not always possible. Browser support for Chrome 43+,
// Firefox 42+, Safari 10+, Edge and IE 10+.
// IE: The clipboard feature may be disabled by an administrator. By
// default a prompt is shown the first time the clipboard is
// used (per session).
function copyToClipboard(text) {
    if (window.clipboardData && window.clipboardData.setData) {
        // IE specific code path to prevent textarea being shown while dialog is visible.
        return clipboardData.setData("Text", text);

    } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
        var textarea = document.createElement("textarea");
        textarea.textContent = text;
        textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
        document.body.appendChild(textarea);
        textarea.select();
        try {
            return document.execCommand("copy");  // Security exception may be thrown by some browsers.
        } catch (ex) {
            console.warn("Copy to clipboard failed.", ex);
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
}