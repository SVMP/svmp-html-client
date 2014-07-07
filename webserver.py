from tornado import web, ioloop, websocket, iostream
import time
import socket
import protocols
from ConfigParser import ConfigParser

apphost = appport = None

def main():
    global appport, apphost
    config = ConfigParser()
    config.read('config.cfg')
    apphost = config.get('core', 'host')
    appport = config.getint('core', 'port')
    app = web.Application([(r'/ws', SocketPassthrough),
                           (r'/static/(.*)', web.StaticFileHandler, {"path":
                               "./static"}),
                           (r'/(index\.html)?', IndexHandler)])
    app.listen(appport, address=apphost)
    ioloop.IOLoop.instance().start()

class IndexHandler(web.RequestHandler):
    def get(self, dummy):
        self.render("templates/index.html", host=apphost, port=appport)

class SocketPassthrough(websocket.WebSocketHandler):
    def wrapResponse(self, responsebytes):
        response = protocols.svmp_pb2.Response()
        response.ParseFromString(responsebytes)
        cont = protocols.container_pb2.Container()
        cont.ctype = protocols.container_pb2.Container.RESPONSE
        cont.response = response
        self.send(cont)

    def readResponseHeader(self, headerByte, readBytes=None):
        print type(headerByte)
        if headerByte & (1 << 7):
            self.connstream.read_bytes(1, lambda x : self.readResponseHeader(x, [headerByte] + readBytes if readBytes else []))
        else:
            fullHeader = [headerByte] + readBytes
            varintlist = []
            for i in fullHeader:
                j = bin(i)
                k = j[3:] if len(j) > 9 else j[2:]
                while len(k) < 7:
                    k = ''.join(['0', k])
                varintlist.append(k)
            varintlist = varintlist[::-1]
            varintstr = ''.join(varintlist)
            varint = int(varintstr, 2)
            self.connstream.read_bytes(varint, self.wrapResponse)

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
            self.rawsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
            self.connstream = iostream.IOStream(self.rawsock)
            self.connstream.connect((host, port))
            self.connected = True
            connack = protocols.container_pb2.Container()
            connack.ctype = protocols.container_pb2.Container.CONNECTED
            self.send(connack)
        elif cont.ctype == protocols.container_pb2.Container.REQUEST:
            self.connstream.write(cont.request)
            self.connstream.read_bytes(1, callback=self.readResponseHeader)
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
