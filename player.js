let lastSub;
const $subtitleShell = $("#subtitlesShell");
let $subs;
let $currentTranslation;
let $video;
let subs = {};

var $subsById = new Array();

let textSelection = { text: ''};
let currentSubId = -1;

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

        $video.on("pause", (e) => {
            console.log("video paused");
            $video[0].pause();
            videoPaused();
        });

        $video.on("play", (e) => {
            console.log("video played");
            $video[0].play();
            videoResumed();
        });

        $(document).on("keydown", function(event) {
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
            else if (event.keyCode === 38) {
                getPreviousTranslation();
            }
            else if (event.keyCode === 40) {
                getNextTranslation();
            }
        });

        $(document).on("keyup", function(event) {
            if (event.keyCode === 17 && textSelection.text) {
                requestTranslation(textSelection.subId, textSelection.text);
                textSelection.subId = -1;
            }
        });

        $video.on("timeupdate", function() {
            var subHtml = $subtitleShell.find("span").toArray().map(s => $(s).html());
            var sub = subHtml.join();
            if (lastSub !== sub && sub.trim() !== "") {
                lastSub = sub;
                subHtml.forEach(subItem => {
                    addSubtitle(subItem.replace(/^[-]/, ""));
                });
            }
        });

        createDom();

        $subs.on("click", ".subtitle-wrapper .translate", (e) => {
            var $icon = $(e.currentTarget);
            var $parent = $icon.parent();
            var subId = $parent.attr("data-sub-id");
            var hasTranslation = !$icon.hasClass("none");
            if (hasTranslation) {
                ignoreTranslation(subId);
                $parent.find(".translation").addClass("ignored");
                $icon.html("T");
            } else {
                $icon.html("I");
                requestTranslation(subId, null);
            }

            $icon.toggleClass('none', hasTranslation);
        });

        $subs.on("click", ".subtitle-wrapper .translation .extra", (e) => {
            const $extra = $(e.currentTarget);
            const subId = +$extra.parents(".subtitle-wrapper").attr("data-sub-id");
            const $sub = $subsById[subId];
            const $original = $extra.find(".extra-original");
            deleteExtraTranslation(subId, $original.html());
            $extra.remove();
        });

        $subs.on("click", ".subtitle-wrapper .original p span", (e) => {
            var $span = $(e.currentTarget);
            var $parent = $span.parents(".subtitle-wrapper");
            var subId = $parent.attr("data-sub-id");
            var text = $span.html().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
            // wait for more text
            if (e.ctrlKey) {
                if (textSelection.subId !== subId)
                    textSelection.text = text;
                else
                    textSelection.text += " " + text;

                textSelection.subId = subId;

                return;
            }

            requestTranslation(subId, text);
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
        $sub.find(".translate").removeClass('none').html('I');
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
    const $lastSubtitle = $subs.find('.subtitle-wrapper:last-child');
    const continueLastSub = $lastSubtitle && $lastSubtitle.attr("data-sub-id") === sub.id;
    const $sub = $(`
        <div class="subtitle-wrapper" data-sub-id="${sub.id}">
            <div class="translate icon none">T</div>
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
                subs.subtitles.push(request.sub);
                addSubToDom(request.sub);
                break;
            case "subtitleTranslated":
                const translatedSub = updateSubtitle(request.sub);
                addTranslationTodom(translatedSub);

                if ($video[0].paused) {
                    console.log("paused");
                    console.log(translatedSub);
                    fillCurrentTranslation(translatedSub);
                }
                else {
                    console.log($video[0]);
                    console.log("not paused");
                    console.log(translatedSub);
                }

                break;
            case "onBrowserAction":
                sendResponse("player");
                break;
            case "togglePlayback":
                var video = $video[0];
                if (video.paused) { // if (request.play) {
                    video.play();
                    videoResumed();
                }
                else {
                    video.pause();
                    videoPaused();
                }
                break;
        }
    });

    function getNextTranslation() {
        const nextSub = subs.subtitles.filter(s => s.id === currentSubId + 1)[0];
        if (!nextSub.translation)
            requestTranslation(nextSub.id);

        fillCurrentTranslation(nextSub);
    }

    function getPreviousTranslation() {
        const prevSub = subs.subtitles.filter(s => s.id === currentSubId - 1)[0];
        if (!prevSub.translation)
            requestTranslation(prevSub.id);

        fillCurrentTranslation(prevSub);
    }

    function fillCurrentTranslation(sub) {
        currentSubId = sub.id;
        $currentTranslation.empty().append(`<p class="original">${sub.subtitle}</p><p class="translation">${sub.translation || ''}`);
    }

    function updateSubtitle(sub) {
        const subMemory = subs.subtitles.filter(s => s.id === sub.id)[0];
        subMemory.translation = sub.translation;
        if (sub.extras) {
            if (!subMemory.extras)
                subMemory.extras = [];

            sub.extras.forEach(e => {
                if (!subMemory.extras.filter(ex => ex.original === e.original).length)
                    subMemory.extras.push(e);
            });
        }

        return subMemory;
    }

    function addSubtitle(subtitleText) {
        let sub;
        if (!subs.subtitles) {
            subs.subtitles = [];
        }

        sub = {subtitle: subtitleText};
        chrome.runtime.sendMessage({
            msg: "newSubTitle",
            sub: sub
        });
    }

    function cloneSub(sub) {
        return {
            subtitle: sub.subtitle,
            id: sub.id,
            extras: sub.extras,
            translation: sub.translation
        };
    }

    function videoPaused() {
        requestTranslation();
        $("#pauseBtn").toggleClass('inactive', true);
        $("#playBtn").toggleClass('inactive', false);
        chrome.runtime.sendMessage({
            msg: "videoPaused",
        });
        focusDocument();
    }

    function videoResumed() {
        $currentTranslation.empty();
        $("#pauseBtn").toggleClass('inactive', false);
        $("#playBtn").toggleClass('inactive', true);
        focusDocument();
    }

    function focusDocument() {
        // Give the document focus
        window.focus();

        // Remove focus from any focused element
        if (document.activeElement) {
            document.activeElement.blur();
        }
    }

    function requestTranslation(subId = null, text = null) {
        subId = (subId !== undefined && subId !== null) ? subId : subs.subtitles.length -1;
        const subToTranslate = subs.subtitles.filter(s => s.id === subId)[0];
        chrome.runtime.sendMessage({
            msg: "translationRequested",
            sub: subToTranslate,
            text
        });
    }

    function deleteExtraTranslation(subId, text) {
        var sub = subs.subtitles.filter(s => s.id === subId)[0];
        sub.extras = sub.extras.filter(e => e.original !== text);
    }

    function ignoreTranslation(subId) {
        subs.subtitles.filter(s => s.id === subId)[0].translation = null;
    }
