const schedule = require('node-schedule')


class StreamManager{
	constructor(){
		this.Streams = {}
		this.Cameras = {}
		
		const nightlyCleanup = schedule.scheduleJob('* 1 * * *', this.KillAllStreams);
	}
	
	addStream(camName, id, proc){
		this.Streams[camName] = {camName: camName, id: id, proc: proc}
		this.setLive(camName)
		console.log(this.Streams[camName].proc)
	}
	
	getStream(camName){
		return this.Streams[camName]
	}
	
	isLive(camName){
		return this.Cameras[camName].streaming
	}
	
	setLive(camName){
		this.Cameras[camName].streaming=true
	}
	
	setUnLive(camName){
		this.Cameras[camName].streaming=false
	}
	
	addCamera(CamObj){
		this.Cameras[CamObj.name] = CamObj
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
