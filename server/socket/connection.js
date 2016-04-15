export default function (app) {
    app.io.on('connection', (socket) => {
        console.log('Connection from ' + socket.request.connection.remoteAddress + ', id ' + socket.id);
    });
};