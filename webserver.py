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
    app.listen(appport)
    ioloop.IOLoop.instance().start()


class IndexHandler(web.RequestHandler):
    def get(self, dummy):
        self.render("templates/index.html", host=apphost, port=appport)


class SocketPassthrough(websocket.WebSocketHandler):
    def encodeVarint(self, value):
        def getByte(val):
            tmpval = ''
            if val.bit_length() < 7:
                tmpval = bin(val)[2:]
                while len(tmpval) < 7:
                    tmpval = '0' + tmpval
            else:
                tmpval = bin(val)[len(bin(val)) - 7:]
            tmpval = int(tmpval, 2)
            val >>= 7
            if val != 0:
                tmpval |= 1 << 7
            else:
                tmpval &= ~(1 << 7)
            return val, tmpval

        endbytes = []
        value, tmpvalue = getByte(value)
        endbytes.append(tmpvalue)
        while value != 0:
            value, tmpvalue = getByte(value)
            endbytes.append(tmpvalue)
        return ''.join([chr(i) for i in endbytes])

    def wrapResponse(self, responsebytes):
        cont = protocols.container_pb2.Container()
        cont.ctype = protocols.container_pb2.Container.RESPONSE
        cont.response.ParseFromString(responsebytes)
        msg = cont.SerializeToString()
        self.write_message(msg, binary=True)
        self.connstream.read_bytes(1, callback=self.readResponseHeader)

    def readResponseHeader(self, headerByte, readBytes=None):
        headerByte = ord(headerByte)
        readBytes = readBytes or []
        if headerByte & (1 << 7):
            self.connstream.read_bytes(1, lambda x : self.readResponseHeader(x, readBytes + [headerByte]))
        else:
            fullHeader = readBytes + [headerByte]
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
        self.keepalive = ioloop.PeriodicCallback(lambda : self.ping(str(time.time())), 30000)
        self.keepalive.start()
        self.connected = False
        print('Client acquired')

    def on_close(self):
        self.keepalive.stop()
        self.connstream.close()
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
            self.write_message(connack.SerializeToString(), binary=True)
            self.connstream.read_bytes(1, callback=self.readResponseHeader)
        elif cont.ctype == protocols.container_pb2.Container.REQUEST:
            msg = cont.request.SerializeToString()
            self.connstream.write(self.encodeVarint(len(msg)) + msg)
            #self.connstream.read_bytes(1, callback=self.readResponseHeader)
        else:
            print('Bad message received!')

    def select_subprotocol(self, subprotocols):
        pass

    def on_pong(self, data):
        pass


if __name__ == '__main__':
    main()
