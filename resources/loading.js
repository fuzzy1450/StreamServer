function delay(t, val) {
    return new Promise(resolve => setTimeout(resolve, t, val));
}

function fadeOut(id){
	var fadeTarget = document.getElementById(id);
	var fadeEffect = setInterval(function () {
        if (!fadeTarget.style.opacity) {
            fadeTarget.style.opacity = 1;
        }
        if (fadeTarget.style.opacity > 0) {
            fadeTarget.style.opacity -= 0.1;
        } else {
            clearInterval(fadeEffect);			
			fadeTarget.innerHTML = "Almost Finished!"
			fadeIn(id)
        }
    }, 150);
}

function fadeIn(id){
	var fadeTarget = document.getElementById(id);
	var fadeEffect = setInterval(function () {
        if (!fadeTarget.style.opacity) {
            fadeTarget.style.opacity = 0;
        }
        if (fadeTarget.style.opacity < 1) {
            fadeTarget.style.opacity += 0.1;
        } else {
            clearInterval(fadeEffect);
        }
    }, 150);
}

function ChangeText(){
	fadeOut("load_tip")
}

function waitForLoad(){
	const queryString = window.location.search
	const urlParams = new URLSearchParams(queryString)
	
	let broadcastID = urlParams.get('bcID')
	let camName = urlParams.get('CN')
	
	console.log("Awaiting Stream Load")
	
	return fetch(`/loadStream/${broadcastID}`, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			ChangeText()
			return delay(10000)
			.then( function(){ 
				newPage = new URL(`/streamControl/${camName}`, window.location.href)
				window.location.href = newPage.href
			})
            
        } else {
			throw new Error('Did not recieve a URL')
		}
	})
	.catch(function(err){
		console.log(err)
	})
}
