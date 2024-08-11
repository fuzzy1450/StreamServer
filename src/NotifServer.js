const {FtpSrv, FileSystem} = require('ftp-srv');
const devnull = require('dev-null');

devnull._destroy = function () {
	return;
}

class DummyFS extends FileSystem {
	constructor() {
		super()
	}

	get(fileName) {
		return {}
	}
	
	list(){
		return []
	}
	chdir(){
		return
	}
	mkdir(){
		return
	}
	write(){
		return {
			stream: devnull(),
			clientPath: "//"
		}
	}
	read(){
		return {
			stream: devnull(),
			clientPath: "//"
		}
	}
	delete(){
		throw new Error("Not allowed to delete files - and its a sin to try")
	}
	rename(){
		return
	}
	chmod(){
		return
	}
	getUniqueName(){
		return "JohnDoe"
	}
}



const port=21;
const ftpServer = new FtpSrv({
    url: "ftp://192.168.50.235:" + port,
	pasv_url: ()=>{return "192.168.50.235"}
});


ftpServer.on('login', ({ connection, username, password }, resolve, reject) => { 
	let camName = username
	connection.on("STOR", (error, filePath) => {
		console.log(`File Store Attempted - Motion Detected on camera ${camName}`)
		//TODO - signal the program that motion was detected on this camera
	});
	
	
	
	if(password === 'superPass'){
		resolve({fs: new DummyFS()}) 
	}
    return reject(new errors.GeneralError('Request Type Not Permitted', 534));
});


ftpServer.listen().then(() => { 
    console.log('Ftp server is starting...')
});



exports.NotifServer = ftpServer

