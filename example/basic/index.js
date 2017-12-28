const Server = require('logux-server').Server

const app = new Server(
  Server.loadOptions(process, {
    subprotocol: '1.0.0',
    supports: '1.x',
    root: __dirname
  })
)

let increment = 0;

app.auth((userId, token) => {
  return true;
})

app.type('increment', {
    access() {
        return true;
    },
    process() {
        return ++increment;
    }
});

app.listen()
