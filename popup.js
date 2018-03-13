function hello() {

}

function buttonClicked(event) {
    var button = event.currentTarget;
    broadcastButtonClickedMsg(button.getAttribute('data-btn-name'));
}

function broadcastButtonClickedMsg(buttonName) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id,
            {
                msg: "popupButtonClicked",
                btnName: buttonName
            }, function(response) {
                if (response === false)
                    alert("This website does not contain a supported video");
                else
                    console.log("The video player is loaded");
        });
      });
}

Array.from(document.getElementsByClassName('button')).forEach(function(element) {
    element.addEventListener('click', buttonClicked);
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(request);
        if (request.msg === "addSub") {
            //  To do something
            console.log(request.sub);
        }
    }
);