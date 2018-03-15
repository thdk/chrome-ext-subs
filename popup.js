function hello() {

}

function buttonClicked(event) {
    var button = event.currentTarget;
    broadcastButtonClickedMsg(button.getAttribute('data-btn-name'));
}

function broadcastButtonClickedMsg(buttonName) {
    chrome.runtime.sendMessage(
        {
            msg: "popupButtonClicked",
            btnName: buttonName
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