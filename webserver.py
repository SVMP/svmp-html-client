from tornado import web, ioloop, websocket
import time
import socket
import protocols

def main():
    app = web.Application([(r'/ws', SocketPassthrough),
                           (r'/static/(.*)', web.StaticFileHandler, {"path":
                               "./static"}),
                           (r'/(index\.html)?', IndexHandler)])
    app.listen(8080, address='127.0.0.1')
    ioloop.IOLoop.instance().start()

class IndexHandler(web.RequestHandler):
    def get(self, dummy):
        self.render("templates/index.html")

class SocketPassthrough(websocket.WebSocketHandler):
    def open(self):
        self.set_nodelay(True)
        self.keepalive = ioloop.PeriodicCallback(self.ping_wrap, 30000)
        self.keepalive.start()
        self.connected = False
        print('Client acquired')

    def on_close(self):
        self.keepalive.stop()
        print('Client lost')

    def on_message(self, message):
        cont = protocols.container_pb2.Container()
        cont.ParseFromString(message)
        if cont.ctype == protocols.container_pb2.Container.CONNECT:
            host = cont.proxyhost
            port = cont.proxyport
            # TODO: Do connect
            self.connected = True
        elif cont.ctype == protocols.container_pb2.Container.REQUEST:
            # TODO: Send request
            pass
        else:
            print('Bad message received!')

    def select_subprotocol(self, subprotocols):
        pass

    def on_pong(self, data):
        pass

    def ping_wrap(self):
        #print('sending ping')
        self.ping(str(time.time()))

if __name__ == '__main__':
    main()
