var lastSub;
var $subtitleShell = $("#subtitlesShell");
var $subs;
var $currentTranslation;
var $video;

var $subsById = new Array();

let textSelection = { text: ''};

const settings = {
    scrollIntoView: true,
    translateOnPause: true,
    showSubsFromOldToNew: true
}

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
                if (video.paused) {
                    video.play();
                    videoResumed();
                }
                else {
                    video.pause();
                    videoPaused();
                }
            }
        });

        $(document).on("keyup", function(event) {
            if (event.keyCode === 17 && textSelection.text) {
                requestTranslation($subsById[textSelection.subId], textSelection.subId, textSelection.text);
                textSelection.subId = -1;
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
                $parent.find(".translation").addClass("ignored");
                $icon.html("T");
            } else {
                $icon.html("I");
                requestTranslation($parent, subId, null);
            }

            $icon.toggleClass('none', hasTranslation);
        });

        $subs.on("click", ".subtitle-wrapper .translation .extra", (e) => {
            const $extra = $(e.currentTarget);
            const subId = +$extra.parents(".subtitle-wrapper").attr("data-sub-id");
            const $sub = $subsById[subId];
            const $original = $extra.find(".extra-original");
            chrome.runtime.sendMessage(
                {
                    msg: "deleteExtraTranslation",
                    text: $original.html().trim(),
                    subId: subId
                });
            $extra.remove();
        });

        $subs.on("click", ".subtitle-wrapper .original p span", (e) => {
            var $span = $(e.currentTarget);
            var $parent = $span.parents(".subtitle-wrapper");
            var subId = parseInt($parent.attr("data-sub-id"));
            var text = $span.html().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
            // wait for more text
            if (e.ctrlKey) {
                if (textSelection.subId !== subId)
                    textSelection.text = text;
                else
                    textSelection.text += " " + text;

                textSelection.subId = subId;

                if (!$subsById[subId])
                    $subsById[subId] = $parent;

                return;
            }

            requestTranslation($parent, subId, text);
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

function addTranslationTodom(sub) {
    const $sub = $subsById[sub.id];
    if (!$sub)
        return;

    if (sub.translation || sub.extras) {
        var $translation = $sub.find(".translation").removeClass("ignored").show();
        $translation.find("p").html(sub.translation);
        if (sub.extras) {
            const extras = sub.extras.map(ex => {
                return $(`
                    <div class="extra">
                        <div class="extra-original">
                            ${ex.original}
                        </div>
                        <div class="extra-translation">
                            ${ex.translation}
                        </div>
                        <div class="clear"></div>
                    </div>
                    `);
            });
            $translation.find(".extra").remove();
            $translation.append(extras);
        }
    }
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
                <p>${sub.translation || ""}</p>
            </div>
        </div>`);

    const allowWordTranslation = true;
    if (allowWordTranslation)
        $sub.find(".original p")
            .empty()
            .append(
                sub.subtitle.split(' ')
                    .map(s => {
                        return `<span>${s}</span> `;
                    })
                );

    if (!sub.translation)
        $sub.find(".translation").hide();

    if (!continueLastSub)
        $subs.append($sub);
    else
        $lastSubtitle.replaceWith($sub);

    // make a dom cache for the subtitle elements
    $subsById[sub.id] = $sub;

    if (settings.scrollIntoView)
        $sub[0].scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
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
                addTranslationTodom(request.sub);

                if ($video[0].paused)
                    $currentTranslation.html(request.sub.translation);

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
        requestTranslation();
        chrome.runtime.sendMessage({
            msg: "videoPaused",
        });
    }

    function videoResumed() {
        $currentTranslation.empty();
    }

    function requestTranslation($sub, subId = null, text = null, callback = null) {
        if (!$subsById[subId] && $sub)
            $subsById[subId] = $sub;

        chrome.runtime.sendMessage({
            msg: "translationRequested",
            subId: subId,
            text
        });
    }

    function ignoreTranslation(subId) {
        chrome.runtime.sendMessage({
            msg: "ignoreSubtitleTranslation",
            subId
        });
    }
