from tornado import web, ioloop, websocket
import time

def main():
    app = web.Application([(r'/ws', SocketPassthrough),
                           (r'/static/(.*)', web.StaticFileHandler, {"path":
                               "./static"}),
                           (r'/(index\.html)?', IndexHandler)])
    app.listen(8080, address='127.0.0.1')
    ioloop.IOLoop.instance().start()

class IndexHandler(web.RequestHandler):
    def get(self):
        self.render("templates/index.html")

class SocketPassthrough(websocket.WebSocketHandler):
    def open(self):
        self.set_nodelay(True)
        self.pingcb = ioloop.PeriodicCallback(self.ping_wrap, 30000)
        self.pingcb.start()
        print('Client acquired')

    def on_close(self):
        self.pingcb.stop()
        print('Client lost')

    def on_message(self, message):
        print('Message received: ' + message)
        self.write_message(message)

    def select_subprotocol(self, subprotocols):
        pass

    def on_pong(self, data):
        print('pong received: ' + data)

    def ping_wrap(self):
        print('sending ping')
        self.ping(str(time.time()))

if __name__ == '__main__':
    main()
