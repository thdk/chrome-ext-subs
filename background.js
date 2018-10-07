var subs = new Array();
var API_KEY = '';
const settings = {
    realTime: false
};
let database = null;
let dbSubtitlesRef = null;
let dbSessionRef = null;

let lastSubRef = null;
let lastSubText = null;


let isActive = false;

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

// TODO: remove below code,
// but use the chrome identy on load of the extension to login if available
chrome.pageAction.onClicked.addListener(() => {

    console.log("pageaction");
    if (firebase.auth().currentUser) {
        // firebase.auth().signOut();
    }
    else {
        chrome.identity.getAuthToken({ interactive: false }, token => {
            if (chrome.runtime.lastError)
                console.log(chrome.runtime.lastError.message);

            if (!token) {
                // chrome.tabs.create({ url: 'src/html/index.html' });
                setPageActionPopup('login');
                return;
            } else {
                chrome.identity.getAuthToken({ interactive: true }, token => {
                    if (chrome.runtime.lastError) {
                        alert(chrome.runtime.lastError.message);
                        return;
                    }
                    // chrome.identity.getProfileUserInfo(userInfo => {
                    firebase.auth().signInAndRetrieveDataWithCredential(firebase.auth.GoogleAuthProvider.credential(null, token));
                    // })
                });
            }
        });
    }
});

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
                }
                break;
            case "newSubTitle":
                publishSub(sender.tab.id, request.sub, request.lineNumber, request.totalLines);
                if (settings.realTime)
                    translationRequested(request.sub, sender.tab.id);
                break;
            case "videoPaused":
                break;
            case "translationRequested":
                translationRequested(request.sub, sender.tab.id, request.text);
                return true;
                break;
            case "videoAvailable":
                switch (request.source) {
                    case 'ceskatelevize':
                        setPageActionPopup("site", sender.tab);
                        break;
                    default:
                        setPageActionPopup("generic", sender.tab);
                }
                break;
            case "videoLoaded":
                setPageActionPopup("player");
                break;
            case "loggedIn": {
                console.log("logged in message received");
                // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                //     chrome.pageAction.setPopup({ tabId: tabs[0].id, popup: "../../popups/hello.html" });
                // });
                break;
            }
            case "activate": {
                activate();
                break;
            }
            case "deactivate": {
                deactivate();
                break;
            }
            case "openpopup": {
                console.log("open popup message received");
                sendResponse({ isActive: isActive });
                break;
            }
        }
    });

function setPageActionPopup(popupName, tab) {
        chrome.pageAction.show(tab.id);
        if (popupName !== 'generic') {
            if (popupName === 'login') {
                chrome.pageAction.setPopup({ tabId: tab.id, popup: "src/html/index.html" });
            }
            else
                chrome.pageAction.setPopup({ tabId: tab.id, popup: "popups/" + popupName + ".html" });
        }
}

function activate() {
    // check authentication before activation
    const unsubscribeOAuthStateChanged = firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // add a new Session document to the session collection in cloud firestore
            dbSessionRef = database.collection("sessions").doc();
            dbSessionRef.set({
                created: firebase.firestore.FieldValue.serverTimestamp(),
                uid: user.uid,
                isWatching: true
            })
                .then(function () {
                    console.log("Document successfully written!");
                })
                .catch(function (error) {
                    console.error("Error writing document: ", error);
                });

            dbSessionRef.onSnapshot(doc => {
                broadcastAllTabsMessage({ msg: "togglePlayback", play: doc.data().isWatching });
            });

            dbSubtitlesRef = dbSessionRef.collection("subtitles");

            isActive = true;
            broadcastActiveTabMessage({
                msg: "extensionActivated"
            });

            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length) {
                    chrome.pageAction.setIcon({
                        tabId: tabs[0].id,
                        path: "src/images/icon-active.png"
                    });
                }
                else {
                    console.log("Cant update page action icon. No tabs found.");
                }
            });
        } else {
            // User is signed out.
            console.log("out");
        };

        unsubscribeOAuthStateChanged();
    });
}

function deactivate() {
    isActive = false;
    broadcastActiveTabMessage({
        msg: "extensionDeactivated"
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.pageAction.setIcon({
            tabId: tabs[0].id,
            path: "src/images/icon.png"
        });
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


function publishSub(tabId, sub, lineNumber, totalLines) {
    sub.isMulti = false;

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
        sub.isMulti = totalLines > 1;
    }

    // if a subtitle is spread over multiple lines,
    // the next part will be followed immediately after this
    // so better to wait and save them at once
    if ((totalLines > 1 && lineNumber != totalLines - 1) || lastSubRef == null) {
        storeAsync(subRef, sub).then(s => {
            chrome.tabs.sendMessage(tabId, {
                msg: "subtitlePublished",
                sub: s,
            });
        });
    }
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
        return waitAsync(500).then(() => storeAsync(subRef, sub));
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
    // TODO: better to use tab property of the sender argument of onMessage
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length) {
            chrome.tabs.sendMessage(tabs[0].id, msg);
        }
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