const schedule = require('node-schedule')


class StreamManager{
	constructor(){
		this.Streams = {}
		this.Cameras = {}
		
		const nightlyCleanup = schedule.scheduleJob('0 1 * * *', this.KillAllStreams);
	}
	
	addStream(camName, id, proc){
		this.Streams[camName] = {camName: camName, id: id, proc: proc}
		this.setLive(camName)
	}
	
	getStream(camName){
		return this.Streams[camName]
	}
	
	isLive(camName){
		if(this.Cameras[camName]) {
			return this.Cameras[camName].streaming
		} else {
			console.log(`UNK1 camName: ${camName}`)
			return false
		}
	}
	
	setLive(camName){
		if(this.Cameras[camName]) {
			this.Cameras[camName].streaming=true
		} else {
			console.log(`UNK2 camName: ${camName}`)
			return false
		}
	}
	
	setUnLive(camName){
		if(this.Cameras[camName]) {
			this.Cameras[camName].streaming=false
		} else {
			console.log(`UNK3 camName: ${camName}`)
			return false
		}
	}
	
	addCamera(CamObj){
		this.Cameras[CamObj.name] = CamObj
		console.log(this.Cameras[CamObj.name])
		console.log(this.Cameras[CamObj.name].streaming)
	}
	
	getCamera(camName){
		return this.Cameras[camName]
	}
	
	
	getLiveStreams(){ // gets a list of all active streams. returns [ {name, id} ]
		let streams = []
		for (i in this.Streams){
			streams.push({name:this.Streams[i].camName, id:this.Streams[i].id })
		}
		return streams
	}

	
	getIdList(){ // gets a list of all active stream IDs (youtube URIs)
		let IDs = []
		for (i in this.Streams){
			IDs.push(this.Streams[i].id)
		}
		return IDs
	}
	
	killStream(camName){
		
		console.log(`Killing Stream [${camName}]`);
		this.Streams[camName].proc.stdin.pause();
		this.Streams[camName].proc.kill();
		this.setUnLive(camName)
		delete this.Streams[camName]
	}
	
	KillAllStreams(){
		console.log("Killing All Streams...")
		for(i in this.Streams){
			this.killStream(i)
		}
		console.log("All Streams Killed")
	}
	
}


const SM = new StreamManager()

const Cameras = require("etc/Cameras.json"); // load cameras from the JSON
for (i in Cameras) {
	SM.addCamera(Cameras[i])
}


exports.StreamManager = SM
