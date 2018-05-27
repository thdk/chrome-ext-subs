let API_KEY;
let logoutButtonEl;
let activateButtonEl;
let deactivateButtonEl;

// get the oauth client id from the manifest file
const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;

window.onload = function () {
    logoutButtonEl = document.querySelector("#logoutButton");
    activateButtonEl = document.querySelector("#activateButton");
    deactivateButtonEl = document.querySelector("#deactivateButton");

    chrome.runtime.sendMessage({msg: "openpopup"}, response => {
        console.log(`message from background: ${JSON.stringify(response)}`);
        toggleActivateUI(response.isActive);
    });

    logoutButtonEl.addEventListener("click", e => {
        firebase.auth().signOut();
    });

    activateButtonEl.addEventListener("click", e => {
        // toggleActivateUI(true);
        chrome.runtime.sendMessage({ msg: 'activate' });
        window.close();
    });

    deactivateButtonEl.addEventListener("click", e => {
        // toggleActivateUI(false);
        chrome.runtime.sendMessage({ msg: 'deactivate' });
        window.close();
    });

    loadConfigAsync().then(() => {
        firebase.initializeApp({
            apiKey: API_KEY,
            authDomain: 'czech-subs-1520975638509.firebaseapp.com',
            projectId: 'czech-subs-1520975638509'
        });

        firebase.auth().onAuthStateChanged(user => {
            document.querySelector(".loggedIn").style.display = 'none';
            document.querySelector(".login").style.display = 'none';

            if (user) showLoggedIn(); else showLogin();
        });
    });
};

function toggleActivateUI(isActive) {
    if (isActive) {
        activateButtonEl.parentElement.style.display = 'none';
        deactivateButtonEl.parentElement.style.display = 'block';
    }
    else {
        deactivateButtonEl.parentElement.style.display = 'none';
        activateButtonEl.parentElement.style.display = 'block';
    }
}

function showLoggedIn() {
    document.querySelector(".loggedIn").style.display = 'block';
}

function showLogin() {
    document.querySelector(".login").style.display = 'block';
    //ui config for firebaseUI
    const uiConfig = {
        // Url to redirect to after a successful sign-in.
        // 'signInSuccessUrl': 'chrome-extension://lbjdcodhahjohdkbigjhgmhikeflepdf/src/html/index.html?1',
        'callbacks': {
            uiShown: function () {
                // The widget is rendered.
                // Hide the loader.
                document.getElementById('loader').style.display = 'none';
            },
            signInSuccess: (authResult, redirectUrl) => {
                window.close();
                return false;
            }
        },
        // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
        signInFlow: 'popup',
        'signInOptions': [
            // Leave the lines as is for the providers you want to offer your users.
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
        ],
        // Terms of service url.
        'tosUrl': 'https://www.google.com',
        'credentialHelper': CLIENT_ID && CLIENT_ID != 'YOUR_OAUTH_CLIENT_ID' ?
            firebaseui.auth.CredentialHelper.GOOGLE_YOLO :
            firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM
    };

    //launch the firebaseUI flow
    var ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', uiConfig);
}

// http makes an HTTP request and calls callback with parsed JSON.
function http(method, url, body, cb) {
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

function loadConfigAsync() {
    return new Promise((resolve, reject) => {
        http('GET', chrome.runtime.getURL('../../config.json'), '', obj => {
            API_KEY = obj.key;
            resolve();
        });
    });
}