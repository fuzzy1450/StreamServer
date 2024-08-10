const {FtpSrv, FileSystem} = require('ftp-srv');

class DummyFS extends FileSystem {
  constructor() {
  }

  get(fileName) {
    ...
  }
}



const port=21;
const ftpServer = new FtpSrv({
    url: "ftp://0.0.0.0:" + port,
    anonymous: true
});

ftpServer.on('login', ({ connection, username, password }, resolve, reject) => { 
	
	connection.on("STOR", (error, filePath) => {
		if(username === 'superAdmin' && password === 'superPass'){
			return reject(new errors.GeneralError('Upload Recieved; File Not Saved', 550)  
		}
	});
	
    return reject(new errors.GeneralError('Request Type Not Permitted', 534));
});


ftpServer.listen().then(() => { 
    console.log('Ftp server is starting...')
});



exports.NotifServer = ftpServer

