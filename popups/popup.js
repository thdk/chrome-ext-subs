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