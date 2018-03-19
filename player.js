var selectedSubIds = new Array();
var lastSub;
var $subtitleShell = $("#subtitlesShell");
var $subs;
var $currentTranslation;
var $video

$(function() {

    init();
});

function init() {
    $video = $("video");
    if ($video.length === 0)
        $video = $(".player").find("iframe").contents().find("#video");

    if ($video.length === 0)
        return;

        $(document).on("keypress", function(event) {
            if (event.keyCode === 32) {
                var video = $video[0];
                if (video.paused)
                    video.play();
                else {
                    video.pause();
                    videoPaused();
                }
            }
        });

        $video.on("timeupdate", function() {
            var subHtml = $subtitleShell.find("span").toArray().map(s => $(s).html());
            var sub = subHtml.join();
            if (lastSub !== sub && sub.trim() !== "") {
                lastSub = sub;
                subHtml.forEach(subItem => {
                    addSub(subItem.replace(/^[-]/, ""));
                });
            }
        });

        createDom();

        $subs.on("click", ".subtitle-wrapper .translate", (e) => {
            var $icon = $(e.currentTarget);
            var $parent = $icon.parent();
            var subId = parseInt($parent.attr("data-sub-id"));
            var hasTranslation = !$icon.hasClass("none");
            if (hasTranslation) {
                ignoreTranslation(subId);
            } else {
                requestTranslation(subId, (translation) => {
                    $parent.find(".translation").show().find("p").html(translation);
                    $icon.removeClass('none');
                });
            }
        });


        chrome.runtime.sendMessage(
            {
                msg: "videoLoaded"
            });
}

function createDom() {
    const $video = $("#ctPlayer1");
    $video.addClass("thdk-video");
    const $template = $(`
    <div class="hidescrollbar-wrapper thdk-subs-wrapper">
        <div class="thdk-subs hidescrollbar">
        </div>
    </div>
    <div class="extra-panel">
        <div id="currentSubTranslation" class="center-text sub"></div>
    </div>`);
    $template.insertAfter($video);
    $subs = $template.find(".thdk-subs");
    $currentTranslation = $template.find("#currentSubTranslation");
    $("body").append(`<div id="thdk-bg"></div>`);
}

function addSubToDom(sub) {
    var $lastSubtitle = $subs.find('.subtitle-wrapper:last-child');
    var continueLastSub = $lastSubtitle && parseInt($lastSubtitle.attr("data-sub-id")) === sub.id;
    const $sub = $(`
        <div class="subtitle-wrapper" data-sub-id="${sub.id}">
            <div class="translate none icon">T</div>
            <div class="original">
                <p>${sub.subtitle}</p>
            </div>
            <div class="translation">
                <p>${sub.translation}</p>
            </div>
        </div>`);

    if (!sub.translation)
        $sub.find(".translation").hide();

    if (!continueLastSub)
        $subs.append($sub);
    else
        $lastSubtitle.replaceWith($sub);

    $sub[0].scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(sender.tab ?
                  "from a content script:" + sender.tab.url :
                  "from the extension");

        switch(request.msg) {
            case "subtitlesSaved":
                if (request.copyResult)
                    alert("Subtiles have been copies to the clipboard");
                else
                    alert("Subtiles could not be copied to the clipboard");
                break;
            case "subtitlePublished":
                addSubToDom(request.sub);
                break;
            case "subtitleTranslated":
                selectedSubIds.push(request.sub.id);
                break;
            case "onBrowserAction":
                sendResponse("player");
                break;
        }
    });

    function addSub(sub) {
        chrome.runtime.sendMessage({
            msg: "newSubTitle",
            sub: sub
        });
    }

    function videoPaused() {
        chrome.runtime.sendMessage({
            msg: "videoPaused",
        });

        requestTranslation(null, function(data) {
            $currentTranslation.html(data);
        });
    }

    function requestTranslation(subId = null, callback = null) {
        chrome.runtime.sendMessage({
            msg: "translationRequested",
            subId
        }, function(response) {
            callback(response);
        });
    }

    function ignoreTranslation(subId) {
        selectedSubIds = selectedSubIds.filter(id => id !== subId);
    }
