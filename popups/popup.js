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

        // temporary hard coded to avoid close of popup as a link is shown in popup after button click
        if (buttonName !== "saveSubtitles")
            window.close();
}

function newGoogleSheet(){
    chrome.tabs.create({ url: "https://docs.google.com/spreadsheets/create"});
}

Array.from(document.getElementsByClassName('button')).forEach(function(element) {
    element.addEventListener('click', buttonClicked);
});
document.getElementById('openSheetsLink').addEventListener('click', function(e) {
    e.preventDefault();
    newGoogleSheet();
})

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.msg === "subtitlesSaved") {
            document.getElementsByClassName("info")[0].style.display='';
        }
    }
);