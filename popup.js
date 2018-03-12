function hello() {
    console.log("clicked");

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {msg: "printSubs"}, function(response) {
          // console.log(response.farewell);
        });
      });
}

document.getElementById('clickme').addEventListener('click', hello);

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(request);
        if (request.msg === "addSub") {
            //  To do something
            console.log(request.sub);
        }
    }
);