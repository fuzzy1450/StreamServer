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

