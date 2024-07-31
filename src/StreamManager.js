const schedule = require('node-schedule')


class StreamManager{
	constructor(){
		this.Streams = {}
		
		const nightlyCleanup = schedule.scheduleJob('* 1 * * *', this.KillAllStreams);
	}
	
	addStream(id, proc){
		this.Streams[id] = proc
	}
	
	getStream(id){
		return this.Streams[id]
	}
	
	getIdList(){
		return Object.keys(this.Streams)
	}
	
	killStream(id){
		console.log('Killing Stream [${i}]');
		this.Streams[id].stdin.pause();
		this.Streams[id].kill();
		delete this.Streams[id]
	}
	
	KillAllStreams(){
		console.log("Killing All Streams...")
		for(i in this.Streams){
			this.killStream(i)
		}
		console.log("All Streams Killed")
	}
	
}

exports.StreamManager = new StreamManager()
