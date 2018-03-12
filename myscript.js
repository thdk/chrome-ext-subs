var subs = new Array();
var resultSubs = new Array();
var currentSubs = new Array();
var treshhold = 1;
var treshholdRemaining = 0;
var lastSub;
var $subtitleShell = $("#subtitlesShell");
var $subs;
var $video

$(function() {
    init();
});

function init() {
    $video = $("video");
    if ($video.length === 0)
        $video = $(".player").find("iframe").contents().find("#video");

    var $iframe = $(".player").find("iframe");
    if ($iframe.length === 0)
        $iframe = $(".video-player").find("span");

    if ($iframe.length === 0 && $video.length === 0)
        return;

    if ($video.length === 0)
    {
        var src = $iframe.attr("src") ? $iframe.attr("src") : $iframe.attr("data-url");
        location.replace(src.replace("autoStart=false", "autoStart=true"));
    }
    else {

        $(document).on("keypress", function(event) {
            console.log(event.keyCode);
            if (event.keyCode === 115) {
                console.log("S key pressed");
                if (treshholdRemaining === 0) {
                    console.log("get last " + treshhold + " from subs array:");
                    console.log(subs);
                    currentSubs = subs.splice(-treshhold, treshhold);
                    console.log(currentSubs);
                    console.log(subs);
                }

                treshholdRemaining = treshhold;
            } else if (event.keyCode === 32) {
                var video = $video[0];
                if (video.paused)
                    video.play();
                else
                    video.pause();
            }
        });



        $video.on("timeupdate", function() {
                    var sub = $subtitleShell.find("span").toArray().map(s => $(s).html()).join(' ').trim();
                    if (lastSub !== sub && sub.trim() !== "") {
                        lastSub = sub;
                        addSub(sub);
                        // addSubToDom(sub);
                        if (treshholdRemaining === 0) {
                            console.log("new sub pushed into subs: " + sub);
                            subs.push(sub);
                        }
                        else{
                            console.log("new subs pusshed into currentsubs: " + sub);
                            currentSubs.push(sub);
                            treshholdRemaining--;
                            if (treshholdRemaining === 0)
                                resultSubs.push(currentSubs.slice());
                        }
                    }
                });
        }

        createDom();
}

function createDom() {
    const $video = $("#ctPlayer1");
    $video.addClass("thdk-video");
    const $template = $(`<div class="hidescrollbar-wrapper thdk-subs-wrapper">
        <div class="thdk-subs hidescrollbar"></div>
    </div>`);
    $template.insertAfter($video);
    $subs = $template.find(".thdk-subs");
    $("body").append(`<div id="thdk-bg"></div>`);
}

function addSubToDom(subText) {
    const $sub = $(`<p>${subText}</p>`);
    $subs.append($sub);
    $sub[0].scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(request);
      console.log(sender.tab ?
                  "from a content script:" + sender.tab.url :
                  "from the extension");

        switch(request.msg) {
            case "printSubs":
                printSubs();
                break;
            case "subtitlePublished":
                addSubToDom(request.sub);
                break;
        }
    });

    function addSub(sub) {
        chrome.runtime.sendMessage({
            msg: "newSubTitle",
            sub: sub
        });
    }


function printSubs() {
    var printedSubs = "";
    for(var i = 0; i < resultSubs.length; i ++) {
        var result = resultSubs[i];
        for(var j = 0; j < result.length; j ++) {
            printedSubs += result[j] + "\n";
        }
        printedSubs += "\n\n";
    }

    console.log(printedSubs);
}
