function waitForLoad(){
	const queryString = window.location.search
	const urlParams = new URLSearchParams(queryString)
	
	let broadcastID = urlParams.get('bcID')
	let redirectURI = urlParams.get('uri')
	
	console.log("Awaiting Stream Load")
	
	return fetch(`/loadStream/${broadcastID}/${redirectURI}`, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
            window.location.href = `http://youtube.com/watch?v=${redirectURI}`;
        } else {
			throw new Error('Did not recieve a URL')
		}
	})
	.catch(function(err){
		console.log(err)
	})
}