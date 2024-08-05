function showLoadingBox(){
	document.getElementById("loadingPane").style.display="block"
}


function delay(t, val) {
    return new Promise(resolve => setTimeout(resolve, t, val));
}

function loadStream(camName){
	
	console.log("Awaiting Stream Load")
	
	showLoadingBox()
	
	return fetch(`/golive/${camName}`, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			window.location.reload()
        } else {
			throw new Error('Did not recieve a URL')
		}
	})
	.catch(function(err){
		console.log(err)
		// TODO: Handle this mf error
	})
}

function killStream(camName){
	
	console.log("Awaiting Stream Death")
	
	return fetch(`/takedown/${camName}`, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			window.location.reload()
        } else {
			throw new Error('Did not recieve a URL')
		}
	})
	.catch(function(err){
		console.log(err)
		// TODO: Handle *this* mf error
	})
}

function notify(txt){
	NotificationText = document.getElementById("notificationText")
	let NotificationBox = document.getElementById("notificationBox")
	
	NotificationText.innerHTML = txt;
	NotificationBox.style.display="block";
	
	return delay(1000)
	.then(function(){
		fadeout(200, NotificationBox)
	})
	
}

function fadeout(ms, e){
	if(e.style.opacity - 0.1 < 0){
		e.style.display = "none"
		e.style.opacity = 1;
	} else {
		e.style.opacity -= 0.1
		return delay(ms)
		.then(function(){
			fadeout(ms, e)
		})
	}
}

function copyText() {
  var copyText = document.getElementById("url_field");


  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices


  navigator.clipboard.writeText(copyText.value);

  // Alert the copied text
  notify("Copied the URL");
}

