(function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {msg: 'onBrowserAction'}, (response) => {
        if (response === "site" || response === "player"){ 
            console.log(response);
            Array.from(document.getElementsByClassName('container')).forEach(function(containerEl) {
                if (containerEl.classList.contains(response))
                    containerEl.style.display='';
                else
                    containerEl.style.display='none';
            });
        }
        else {
            console.log("nothing");
        }
      });
    });
 })();

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
        console.log('request.msg');
        if (request.msg === "subtitlesSaved") {
            document.getElementsByClassName("info")[0].style.display='';
        }
    }
);