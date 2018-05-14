var subs = new Array();
var API_KEY = '';
const settings = {
    realTime: false
};
let database = null;
let dbSubtitlesRef = null;
let dbUsersRef = null;

let lastSubRef = null;
let lastSubText = null;

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

    // todo: make async!
    firebase.initializeApp({
        apiKey: API_KEY,
        authDomain: 'czech-subs-1520975638509.firebaseapp.com',
        projectId: 'czech-subs-1520975638509'
    });

    // Initialize Cloud Firestore through Firebase
    database = firebase.firestore();
    const fireBaseSettings = {
        timestampsInSnapshots: true
    };
    database.settings(fireBaseSettings);

    dbSubtitlesRef = database.collection("subtitles");
    dbUserRef = database.collection("users").doc('thomas');
    dbUserRef.set({
        isWatching: true
    });

    dbUserRef.onSnapshot(doc => {
        broadcastAllTabsMessage({msg: "togglePlayback", play: doc.data().isWatching });
    });
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
    function (request, sender, sendResponse) {
        switch (request.msg) {
            case "popupButtonClicked":
                switch (request.btnName) {
                    case "openPlayer":
                        broadcastActiveTabMessage({
                            msg: "openPlayer"
                        });
                        break;
                    case "saveSubtitles":
                        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                            saveSubtitles(tabs[0].id);
                        });
                        break;
                }
                break;
            case "newSubTitle":
                publishSub(sender.tab.id, request.sub);
                if (settings.realTime)
                    translationRequested(request.sub, sender.tab.id);
                break;
            case "updateSubTitle":
                publishSub(sender.tab.id, request.sub);
                if (settings.realTime)
                    translationRequested(request.sub, sender.tab.id);
            case "videoPaused":
                break;
            case "translationRequested":
                translationRequested(request.sub, sender.tab.id, request.text);
                return true;
                break;
            case "videoAvailable":
                setPageActionPopup("site");
                break;
            case "videoLoaded":
                setPageActionPopup("player");
                break;
        }
    });

function setPageActionPopup(popupName) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.pageAction.show(tabs[0].id);
        chrome.pageAction.setPopup({ tabId: tabs[0].id, popup: "popups/" + popupName + ".html" });
    });
}

function translationRequested(sub, tabId, text = null) {
    var textToTranslate = text || sub.subtitle;
    translate(textToTranslate, (response) => {
        var translation = response.data.translations[0].translatedText;
        if (text) {
            // just a single / few word(s) were translated
            const extra = { original: text, translation };
            if (sub.extras)
                sub.extras.push(extra);
            else
                sub.extras = [extra];
        } else {
            // complete subtitle was translated
            sub.translation = translation;
        }
        chrome.tabs.sendMessage(tabId, {
            msg: "subtitleTranslated",
            sub: sub
        });

        storeAsync(dbSubtitlesRef.doc(sub.id), sub);
    });
}

function saveSubtitles(subs) {
    var dump = "";
    subs.subtitles.forEach(s => {
        if (s.translation || s.extras) {
            if (s.translation)
                dump += s.subtitle + "\t" + s.translation + "\n";
            if (s.extras)
                s.extras.forEach(e => dump += e.original + "\t" + e.translation + "\n");

            dump += "\n";
        }
    });

    copyToClipboard(dump);

    chrome.runtime.sendMessage({
        msg: "subtitlesSaved",
    });
}

function publishSub(tabId, sub) {
    var subRef = null;
    if (lastSubRef) {
        subRef = lastSubRef;
        sub.subtitle = lastSubText + " " + sub.subtitle;
    }
    else {
        subRef = dbSubtitlesRef.doc();
    }

    if (!sub.subtitle.match(/[?.!]$/)) {
        lastSubRef = subRef;
        lastSubText = sub.subtitle;
    }
    else {
        lastSubRef = null;
        lastSubText = null;
    }

    storeAsync(subRef, sub).then(s => {
        chrome.tabs.sendMessage(tabId, {
            msg: "subtitlePublished",
            sub: s,
        });
    });
}

function waitAsync(delayInMs, resolveWith) {
    return new Promise((resolve, reject) => {
        base.setTimeout(delayInMs, () => resolve(resolveWith));
    });
}

function storeAsync(subRef, sub) {
    // wait for database to be initialized
    if (database == null) {
        console.log("database not ready. retry in 500ms");
        return waitAsync(500, sub).then((s) => storeAsync(s));
    }

    return new Promise((resolve, reject) => {
        if (!sub.id) {
            sub.created = firebase.firestore.FieldValue.serverTimestamp();
            return subRef.set(sub)
                .then(() => {
                    console.log("Document written with ID: ", subRef.id);
                    sub.id = subRef.id;
                    resolve(sub);
                })
                .catch(function (error) {
                    console.error("Error adding document: ", error);
                    reject(error);
                });
        }
        else {
            return subRef.update(sub)
                .then(function () {
                    console.log("Document successfully updated!");
                });
        }
    });
}

function broadcastActiveTabMessage(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, msg);
    });
}

function broadcastAllTabsMessage(msg) {
    chrome.tabs.query({}, tabs => {
        for (i = 0; i < tabs.length; i++) {
            chrome.tabs.sendMessage(tabs[i].id, msg);
        }
    });
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