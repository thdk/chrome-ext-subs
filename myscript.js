var $iframe;
$(function() {
    $iframe = $(".player").find("iframe");
    if ($iframe.length === 0)
        $iframe = $(".video-player").find("span");

    if ($iframe.length !== 0)
    {
        chrome.runtime.sendMessage(
            {
                msg: "videoAvailable",
                source: "ceskatelevize"
            });
    }

    // TODO: use a config setting for the iframe source
    document.querySelector("body").insertAdjacentHTML("beforeend", `<iframe id="rst-iframe" src="https://czech-subs-1520975638509.firebaseapp.com/"/>`);

});


function openPlayer() {

    if ($iframe.length !== 0)
    {
        var src = $iframe.attr("src") ? $iframe.attr("src") : $iframe.attr("data-url");
        location.replace(src.replace("autoStart=false", "autoStart=true"));
        return true;
    }

    return false;
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch(request.msg) {
            case "openPlayer":
                openPlayer();
                break;
            case "onBrowserAction":
                sendResponse("site");
                break;
        }
});
