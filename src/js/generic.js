
let lastSub;
let $video;
let subtitleShell;
function load(options) {
    waitForElementAsync(options.videoSelector).then(video => {
        sendMessage("videoAvailable");

        $video = $(video)
        $subtitleShell = $(options.subtitleSelector);
    });
}

function activate() {
    $video.on("timeupdate.remotesubs", function () {
        const currentTime = $video[0].currentTime;
        var subHtml = $subtitleShell.find("span").toArray().map(s => $(s).html());
        var sub = subHtml.join();
        if (lastSub !== sub && sub.trim() !== "") {
            lastSub = sub;
            const multi = subHtml.every(text => text.match(/[?.!]$/));
            for(var i = 0; i < subHtml.length; i++) {
                var subItem = subHtml[i];
                addSubtitle(subItem.replace(/^[-]/, ""), currentTime, i, subHtml.length, subHtml.length > 1 && multi);
            };
        }
    });
}

function deactivate() {
    $video.off("timeupdate.remotesubs");
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.msg) {
            case "togglePlayback":
                const video = $video[0];
                if (video.paused) {
                    video.play();
                    // videoResumed();
                }
                else {
                    video.pause();
                    // videoPaused();
                }
                break;
            case "extensionActivated":
                activate();
                break;
            case "extensionDeactivated":
                deactivate();
                break;
        }
    });

function sendMessage(message) {
    chrome.runtime.sendMessage(
        {
            msg: message
        });
}

function waitForElementAsync(selector) {
    return new Promise(function (resolve, reject) {
        var element = document.querySelector(selector);

        if (element) {
            resolve(element);
            return;
        }

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                var nodes = Array.from(mutation.addedNodes);
                for (var node of nodes) {
                    if (node.matches && node.matches(selector)) {
                        observer.disconnect();
                        resolve(node);
                        return;
                    }
                };
            });
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
    });
}

function addSubtitle(subtitleText, time, lineNumber, totalLines, isMulti) {
    sub = { subtitle: subtitleText, time, isMulti};
    chrome.runtime.sendMessage({
        msg: "newSubTitle",
        sub: sub,
        lineNumber,
        totalLines
    });
}

let fullScreenMode = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;

$(document).on('mozfullscreenchange webkitfullscreenchange fullscreenchange', function () {
    fullScreenMode = !fullScreenMode;
    $("html").toggleClass("thdk-fullscreen", fullScreenMode);
});
