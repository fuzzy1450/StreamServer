function showLoadingBox(){
	document.getElementById("loadingPane").style.display="block"
}


function delay(t, val) {
    return new Promise(resolve => setTimeout(resolve, t, val));
}

function dots(e, n, m, ms){
	e.innerHTML = '.'.repeat(m%4)
	
	if(n < m){
		console.log("ran out of dots")
		return
	} else {
		return delay(ms)
		.then(function(){
			dots(e, n, m+1, ms)
		})
	}
}



function vid_preview(){
	let e = document.getElementById("loadingSnapshot")
	let uri = document.getElementById("loadingSnapshot").src.split("?")[0]
	
	if (e.checkVisibility()) {
		return delay(250)
		.then(function(){
			e.src=uri +"?d=" + new Date().getTime()
		})
	}
}

function start_load_helper(){
	showLoadingBox()
	dots(document.getElementById("dots"), 1048576, 0, 250) // thats 36 hours of dots
	
	vid_preview()
	
}

function loadStream(camName){
	
	console.log("Awaiting Stream Load")
	
	start_load_helper()
	
	return fetch(`/golive/${camName}`, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			window.location.reload()
        } else {
			throw new Error('Did not recieve a URL')
		}
	})
	.catch(function(err){
		console.log("Error Loading The Stream")
		throw err
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
		console.log("Error Killing The Stream")
		throw err
	})
}

function notify(txt){
	NotificationText = document.getElementById("notificationText")
	let NotificationBox = document.getElementById("notificationBox")
	
	NotificationText.innerHTML = txt;
	NotificationBox.style.opacity = 1
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

